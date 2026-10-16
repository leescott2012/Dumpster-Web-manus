/*
 * VideoSheet — play + non-destructive trim for a device-only pool video.
 * Two-handle in/out slider, preview loops only the selected range, trim saved
 * to videoStore. "Save trimmed copy" records a real file on-device (never
 * uploaded) and adds it to the pool as a new video; the original is kept.
 */
import { useEffect, useRef, useState } from "react";
import { X, Scissors, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtTime, trimRange, recordTrimmedCopy, downloadBlob, type VideoMeta } from "@/lib/videoStore";

var MIN_GAP = 0.5; // seconds

interface VideoSheetProps {
  video: VideoMeta;
  url: string;
  onClose: () => void;
  onTrim: (start: number | undefined, end: number | undefined) => void; // undefined/undefined = reset
  onTrimmedCopy: (blob: Blob, duration: number) => Promise<string>;   // resolves to the copy's file name
}

export default function VideoSheet({ video, url, onClose, onTrim, onTrimmedCopy }: VideoSheetProps) {
  var vidRef = useRef<HTMLVideoElement>(null);
  var [dur, setDur] = useState(video.duration);
  var initial = trimRange(video);
  var [start, setStart] = useState(initial[0]);
  var [end, setEnd] = useState(initial[1]);
  var [progress, setProgress] = useState<number | null>(null);
  var [copy, setCopy] = useState<{ blob: Blob; name: string } | null>(null);

  // Persist trim (debounced). Full range = no trim.
  var first = useRef(true);
  useEffect(function() {
    if (first.current) { first.current = false; return; }
    if (!dur) return;
    var t = setTimeout(function() {
      if (start <= 0.05 && end >= dur - 0.05) onTrim(undefined, undefined);
      else onTrim(start, end);
    }, 400);
    return function() { clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, dur]);

  var handleMeta = function() {
    var el = vidRef.current;
    if (!el) return;
    if (!dur && isFinite(el.duration) && el.duration > 0) { setDur(el.duration); setEnd(el.duration); }
    el.currentTime = start;
  };
  // Loop only [start, end]. ponytail: timeupdate fires ~4x/s, so the loop can
  // overshoot `end` by up to ~250ms in preview; the saved copy is exact-ish (rAF).
  var handleTime = function() {
    var el = vidRef.current;
    if (!el) return;
    if (el.currentTime >= end || el.currentTime < start - 0.25) {
      el.currentTime = start;
      if (el.paused) el.play().catch(function() {});
    }
  };
  var seek = function(t: number) { if (vidRef.current) vidRef.current.currentTime = t; };

  var onStart = function(v: number) { var s = Math.min(v, end - MIN_GAP); setStart(Math.max(0, s)); seek(Math.max(0, s)); };
  var onEnd = function(v: number) { var e = Math.max(v, start + MIN_GAP); setEnd(Math.min(dur, e)); seek(Math.max(start, Math.min(dur, e) - 1)); };
  var reset = function() { setStart(0); setEnd(dur); seek(0); };

  var saveCopy = function() {
    if (progress !== null) return;
    setProgress(0);
    setCopy(null);
    var len = end - start;
    // Must run synchronously in this click so iOS allows playback with sound.
    recordTrimmedCopy(url, start, end, setProgress)
      .then(function(res) { return onTrimmedCopy(res.blob, len).then(function(name) { return { blob: res.blob, name: name }; }); })
      .then(function(c) { setCopy(c); toast("Trimmed copy added to your pool (saved on this device)"); })
      .catch(function(e) {
        toast("Couldn't make a trimmed copy" + (e && e.message ? " — " + e.message : "") + ". Your original is untouched.");
      })
      .then(function() { setProgress(null); });
  };

  var pct = function(t: number) { return dur ? (t / dur) * 100 : 0; };
  var btn: React.CSSProperties = {
    background: "transparent", border: "1px solid #2a2a2a", borderRadius: "100px",
    padding: "7px 14px", fontSize: "12px", color: "#bbb", cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", gap: "6px",
  };
  var recording = progress !== null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", zIndex: 450 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 451,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a", borderRadius: "20px 20px 0 0",
        maxHeight: "90vh", overflowY: "auto", padding: "12px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.name}</div>
            <div style={{ fontSize: 11, color: "#8a8a8a" }}>Stays on this device — never uploaded</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <video ref={vidRef} src={url} autoPlay muted playsInline controls
          onLoadedMetadata={handleMeta} onTimeUpdate={handleTime}
          style={{ width: "100%", maxHeight: "45vh", borderRadius: 10, background: "#000", display: "block" }}
        />

        {dur > 0 ? (
          <div style={{ marginTop: 16 }}>
            <div className="dual-range">
              <div style={{ position: "absolute", left: 0, right: 0, top: 11, height: 6, borderRadius: 3, background: "#222" }} />
              <div style={{ position: "absolute", top: 11, height: 6, borderRadius: 3, background: "var(--accent)", left: pct(start) + "%", width: (pct(end) - pct(start)) + "%" }} />
              <input type="range" min={0} max={dur} step={0.1} value={start} aria-label="Trim start"
                disabled={recording} onChange={function(e) { onStart(parseFloat(e.target.value)); }} />
              <input type="range" min={0} max={dur} step={0.1} value={end} aria-label="Trim end"
                disabled={recording} onChange={function(e) { onEnd(parseFloat(e.target.value)); }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8a8a8a", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
              <span>In {fmtTime(start)}</span>
              <span style={{ color: "#fff", fontWeight: 700 }}>{fmtTime(end - start)}</span>
              <span>Out {fmtTime(end)}</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 12, color: "#8a8a8a" }}>Loading length…</div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginTop: 16 }}>
          <button onClick={reset} disabled={recording || !dur} style={btn}>Reset</button>
          <button onClick={saveCopy} disabled={recording || !dur}
            style={Object.assign({}, btn, { background: "var(--accent)", border: "1px solid var(--accent)", color: "#000", fontWeight: 700, opacity: recording ? 0.85 : 1 })}>
            {recording ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />}
            {recording ? "Recording " + Math.round((progress || 0) * 100) + "%" : "Save trimmed copy"}
          </button>
          {copy && (
            <button onClick={function() { downloadBlob(copy!.blob, copy!.name); }} style={btn}>
              <Download size={13} />Download copy
            </button>
          )}
        </div>
        {recording && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 4, borderRadius: 2, background: "#222", overflow: "hidden" }}>
              <div style={{ height: "100%", width: Math.round((progress || 0) * 100) + "%", background: "var(--accent)", transition: "width 0.2s" }} />
            </div>
            <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 6 }}>Records in real time — {fmtTime(end - start)} clip takes about that long. Keep this tab open.</div>
          </div>
        )}
      </div>
    </>
  );
}
