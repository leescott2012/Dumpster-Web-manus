/**
 * videoStore — device-only Video Pool (IndexedDB "dumpster-videos").
 *
 * HARD RULE: videos are device-only by owner decision. Nothing in this file
 * talks to the network, and nothing outside it may send video bytes, blob
 * URLs, or thumbnails to Supabase / any /api route. ONE owner-approved exception
 * (2026-10-25): lib/videoLabel.ts sends a single poster still to the paid label scan. See notVideo() below,
 * which every cloud/AI payload builder filters through.
 *
 * Two object stores so tag/trim edits rewrite a tiny meta record instead of
 * re-copying the whole video blob:
 *   meta:  { id, name, duration, thumbDataUrl, tags, addedAt, trimStart?, trimEnd? }
 *   blobs: id -> Blob
 * If IndexedDB is unavailable, everything falls back to an in-memory map
 * (session-only) with one console.warn. Nothing here throws.
 */

export interface VideoMeta {
  id: string;
  name: string;
  duration: number;      // seconds (0 if unknown)
  thumbDataUrl: string;  // "" if extraction failed
  tags: string[];
  addedAt: number;
  trimStart?: number;    // seconds, non-destructive
  trimEnd?: number;
}
export interface VideoRecord extends VideoMeta { blob: Blob; }

// videos are device-only by owner decision — every cloud sync / AI payload
// filters through this. Category "Video" covers device uploads, trimmed
// copies, and IG-scraped videos alike.
export function notVideo(p: { category: string }): boolean {
  return p.category !== "Video";
}

var DB_NAME = "dumpster-videos";
var META = "meta";
var BLOBS = "blobs";

var _db: Promise<IDBDatabase | null> | null = null;
var _mem: Map<string, VideoRecord> | null = null; // fallback when IDB is unavailable
// Sync thumb lookup so PhotoCard can show a poster anywhere a video appears.
var _thumbs: Record<string, string> = {};
export function videoThumb(id: string): string { return _thumbs[id] || ""; }

function openDb(): Promise<IDBDatabase | null> {
  if (_db) return _db;
  _db = new Promise(function (resolve) {
    try {
      if (typeof indexedDB === "undefined") throw new Error("no indexedDB");
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
        if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { fallback(); resolve(null); };
      req.onblocked = function () { fallback(); resolve(null); };
    } catch { fallback(); resolve(null); }
  });
  return _db;
}

function fallback() {
  if (_mem) return;
  _mem = new Map();
  console.warn("[videoStore] IndexedDB unavailable — videos kept in memory for this session only");
}

function done(tx: IDBTransaction): Promise<boolean> {
  return new Promise(function (resolve) {
    tx.oncomplete = function () { resolve(true); };
    tx.onerror = tx.onabort = function () { resolve(false); };
  });
}

/** Read duration + a first-frame JPEG thumbnail via a hidden <video> + canvas. */
function probe(blob: Blob): Promise<{ duration: number; thumb: string }> {
  return new Promise(function (resolve) {
    var url = URL.createObjectURL(blob);
    var v = document.createElement("video");
    var finished = false;
    function finish(duration: number, thumb: string) {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      resolve({ duration: isFinite(duration) && duration > 0 ? duration : 0, thumb: thumb });
    }
    var timer = setTimeout(function () { finish(v.duration, ""); }, 8000);
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadedmetadata = function () {
      var d = v.duration;
      try { v.currentTime = isFinite(d) && d > 0 ? Math.min(0.1, d / 2) : 0; } catch { /* keep going */ }
    };
    v.onseeked = function () {
      var thumb = "";
      try {
        var w = v.videoWidth, h = v.videoHeight;
        if (w && h) {
          var scale = Math.min(1, 360 / Math.max(w, h));
          var c = document.createElement("canvas");
          c.width = Math.round(w * scale);
          c.height = Math.round(h * scale);
          var ctx = c.getContext("2d");
          if (ctx) { ctx.drawImage(v, 0, 0, c.width, c.height); thumb = c.toDataURL("image/jpeg", 0.7); }
        }
      } catch { /* tainted/decoder issue — no thumb */ }
      clearTimeout(timer);
      finish(v.duration, thumb);
    };
    v.onerror = function () { clearTimeout(timer); finish(0, ""); };
    v.src = url;
  });
}

/**
 * Save a video (File or recorded Blob) on-device. Never rejects: on any storage
 * failure the returned record still works for this session.
 */
export async function saveVideo(
  file: Blob,
  opts?: { id?: string; name?: string; duration?: number; fallbackThumb?: string }
): Promise<VideoRecord> {
  var o = opts || {};
  var p = await probe(file).catch(function () { return { duration: 0, thumb: "" }; });
  var rec: VideoRecord = {
    id: o.id || "upload-" + Math.random().toString(36).slice(2, 10),
    name: o.name || (file as File).name || "Video",
    duration: o.duration || p.duration,
    thumbDataUrl: p.thumb || o.fallbackThumb || "",
    tags: [],
    addedAt: Date.now(),
    blob: file,
  };
  _thumbs[rec.id] = rec.thumbDataUrl;
  try {
    var db = await openDb();
    if (!db) { _mem!.set(rec.id, rec); return rec; }
    var tx = db.transaction([META, BLOBS], "readwrite");
    var meta: VideoMeta = Object.assign({}, rec) as VideoMeta;
    delete (meta as Partial<VideoRecord>).blob;
    tx.objectStore(META).put(meta);
    tx.objectStore(BLOBS).put(file, rec.id);
    if (!(await done(tx))) console.warn("[videoStore] save failed (quota?) — video is session-only");
  } catch (e) {
    console.warn("[videoStore] save failed — video is session-only", e);
  }
  return rec;
}

export async function listVideos(): Promise<VideoRecord[]> {
  try {
    var db = await openDb();
    if (!db) return Array.from(_mem!.values());
    var tx = db.transaction([META, BLOBS], "readonly");
    var metaReq = tx.objectStore(META).getAll();
    var blobReq = tx.objectStore(BLOBS).getAll();
    var keyReq = tx.objectStore(BLOBS).getAllKeys();
    if (!(await done(tx))) return [];
    var blobs: Record<string, Blob> = {};
    for (var i = 0; i < keyReq.result.length; i++) blobs[String(keyReq.result[i])] = blobReq.result[i];
    var out: VideoRecord[] = [];
    var metas = metaReq.result as VideoMeta[];
    for (var j = 0; j < metas.length; j++) {
      var b = blobs[metas[j].id];
      if (!b) continue; // orphaned meta — skip
      _thumbs[metas[j].id] = metas[j].thumbDataUrl;
      out.push(Object.assign({ blob: b }, metas[j]));
    }
    out.sort(function (a, b2) { return a.addedAt - b2.addedAt; });
    return out;
  } catch (e) {
    console.warn("[videoStore] list failed", e);
    return [];
  }
}

export async function deleteVideo(id: string): Promise<void> {
  delete _thumbs[id];
  try {
    var db = await openDb();
    if (!db) { _mem!.delete(id); return; }
    var tx = db.transaction([META, BLOBS], "readwrite");
    tx.objectStore(META).delete(id);
    tx.objectStore(BLOBS).delete(id);
    await done(tx);
  } catch (e) { console.warn("[videoStore] delete failed", e); }
}

async function patchMeta(id: string, patch: Partial<VideoMeta>): Promise<void> {
  try {
    var db = await openDb();
    if (!db) { var m = _mem!.get(id); if (m) Object.assign(m, patch); return; }
    var tx = db.transaction(META, "readwrite");
    var store = tx.objectStore(META);
    var req = store.get(id);
    req.onsuccess = function () { if (req.result) store.put(Object.assign(req.result, patch)); };
    await done(tx);
  } catch (e) { console.warn("[videoStore] update failed", e); }
}

export function setVideoTags(id: string, tags: string[]): Promise<void> {
  return patchMeta(id, { tags: tags });
}

/** Non-destructive trim. Pass undefined for both to reset. */
export function setVideoTrim(id: string, trimStart: number | undefined, trimEnd: number | undefined): Promise<void> {
  return patchMeta(id, { trimStart: trimStart, trimEnd: trimEnd });
}

/** Effective [start, end] in seconds for a record (trim or full length). */
export function trimRange(v: VideoMeta): [number, number] {
  var s = v.trimStart || 0;
  var e = v.trimEnd != null && v.trimEnd > s ? v.trimEnd : v.duration;
  return [s, e];
}

export function fmtTime(sec: number): string {
  var t = Math.max(0, Math.round(sec));
  var m = Math.floor(t / 60), s = t % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

/**
 * Record [start, end] of a video into a real file, entirely on-device, via
 * captureStream (canvas fallback for Safari) + MediaRecorder. Records in real
 * time. MUST be called synchronously from a click handler: the hidden element
 * and AudioContext are "blessed" by the gesture so iOS lets them play with sound.
 * ponytail: real-time re-encode; a 60s range takes ~60s. WebCodecs if that hurts.
 */
export function recordTrimmedCopy(
  src: string, start: number, end: number, onProgress: (frac: number) => void
): Promise<{ blob: Blob; mime: string }> {
  return new Promise(function (resolve, reject) {
    if (typeof MediaRecorder === "undefined") { reject(new Error("This browser can't record video")); return; }
    var mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(function (m) {
      try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
    }) || "";
    var v = document.createElement("video");
    v.playsInline = true;
    v.preload = "auto";
    v.src = src;
    var blessed = v.play(); // inside the user gesture — unlocks playback on iOS
    if (blessed) blessed.catch(function () { /* paused below anyway */ });

    var ac: AudioContext | null = null;
    var audioTracks: MediaStreamTrack[] = [];
    try {
      var AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new AC();
      var dest = ac.createMediaStreamDestination();
      // Routes element audio into the recording only — nothing plays out loud.
      ac.createMediaElementSource(v).connect(dest);
      audioTracks = dest.stream.getAudioTracks();
    } catch { ac = null; /* video-only copy */ }

    var raf = 0, rec: MediaRecorder | null = null, settled = false;
    var chunks: Blob[] = [];
    var watchdog = setTimeout(function () { fail(new Error("Recording timed out")); }, (end - start) * 2000 + 15000);

    function cleanup() {
      clearTimeout(watchdog);
      cancelAnimationFrame(raf);
      try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* ignore */ }
      if (ac) ac.close().catch(function () {});
    }
    function fail(e: Error) {
      if (settled) return;
      settled = true;
      try { if (rec && rec.state !== "inactive") rec.stop(); } catch { /* ignore */ }
      cleanup();
      reject(e);
    }

    v.onerror = function () { fail(new Error("Couldn't read this video")); };
    v.onloadedmetadata = function () {
      v.pause();
      v.currentTime = start;
    };
    v.onseeked = function () {
      if (rec) return; // only the initial seek starts recording
      try {
        var stream: MediaStream;
        var cap = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
        var canvas: HTMLCanvasElement | null = null;
        if (cap) {
          stream = new MediaStream(cap.call(v).getVideoTracks());
        } else {
          // Safari has no HTMLVideoElement.captureStream — paint frames to a canvas.
          canvas = document.createElement("canvas");
          canvas.width = v.videoWidth || 720;
          canvas.height = v.videoHeight || 1280;
          stream = canvas.captureStream(30);
        }
        for (var i = 0; i < audioTracks.length; i++) stream.addTrack(audioTracks[i]);
        rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onerror = function () { fail(new Error("Recording failed")); };
        rec.onstop = function () {
          if (settled) return;
          settled = true;
          cleanup();
          var type = (rec && rec.mimeType) || mime || "video/webm";
          if (chunks.length === 0) { reject(new Error("Recording came out empty")); return; }
          resolve({ blob: new Blob(chunks, { type: type }), mime: type });
        };
        var ctx = canvas ? canvas.getContext("2d") : null;
        var tick = function () {
          if (ctx && canvas) ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          onProgress(Math.min(1, Math.max(0, (v.currentTime - start) / (end - start))));
          if (v.currentTime >= end || v.ended) {
            if (rec && rec.state === "recording") rec.stop();
            return;
          }
          raf = requestAnimationFrame(tick);
        };
        rec.start(1000);
        if (ac && ac.state === "suspended") ac.resume().catch(function () {});
        v.play().then(function () { raf = requestAnimationFrame(tick); }, function (e) { fail(e instanceof Error ? e : new Error("Playback blocked")); });
        v.onended = function () { if (rec && rec.state === "recording") rec.stop(); };
      } catch (e) {
        fail(e instanceof Error ? e : new Error("Recording failed"));
      }
    };
  });
}

/** Trigger a local download of a blob (never leaves the device). */
export function downloadBlob(blob: Blob, name: string): void {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}
