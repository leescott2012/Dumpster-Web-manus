/**
 * Label Health — state + the one-time free first scan.
 *
 * Only the FIRST ~100 photos an account uploads are scanned automatically and
 * free (server-enforced, shared/aiLabelCost.ts). Once the server says the free
 * scan is used up (402 free_scan_used) auto-scan stops for the session and
 * labeling is the paid Scan button only (1 credit/photo, user-initiated).
 * While it lasts: runs on app open / photo changes (debounced, one run / 10 min),
 * ≤3 requests of ≤6 photos (the server's burst limit and per-request cap).
 * No second-opinion audits. Other quota answers (429/503) pause quietly.
 *
 * Videos are device-only by owner decision — filtered out before any request.
 * Only { id, url } is ever sent: no EXIF/GPS.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiFetch } from "@/lib/creditSync";
import { getAuthHeaders } from "@/lib/supabase";
import { compressDataUrlForVision } from "@/lib/imageDownscale";
import { logBug } from "@/lib/bugLogger";
import { track } from "@/lib/analytics";
import type { Photo } from "@/lib/photoData";
import type { PhotoLabel } from "@/lib/aiLabel";
import {
  addSnapshot, computeHealth, dayKey, isValidCategory, isGenericLabel, isVideoLike,
  loadStore, saveStore, type LabelHealthStore, type LabelInfo,
} from "@/lib/labelHealth";
import { FREE_SCAN_USED_CODE } from "@shared/aiLabelCost";

var BATCH = 6;
var REQUESTS_PER_RUN = 3;
var RUN_EVERY_MS = 10 * 60 * 1000;
var RELABEL_COOLDOWN_MS = 7 * 864e5; // don't keep re-labeling the same stubborn suspect

export type FixStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "paused"; until: number; daily: boolean };

class QuotaError extends Error {
  daily: boolean;
  freeUsed: boolean;
  constructor(daily: boolean, freeUsed?: boolean) { super("quota"); this.daily = daily; this.freeUsed = !!freeUsed; }
}

// Free auto-scan request, same endpoint as aiLabel.ts autoScanPhotos, but
// surfaces the HTTP status so quota exhaustion can pause instead of error.
async function requestLabels(photos: Photo[]): Promise<PhotoLabel[]> {
  var safe = photos.filter(function(p) { return !isVideoLike(p); });
  if (safe.length === 0) return [];
  var body = await Promise.all(safe.map(async function(p) {
    return { id: p.id, url: p.url.startsWith("data:") ? await compressDataUrlForVision(p.url, 1568, 0.82) : p.url };
  }));
  var headers = await getAuthHeaders();
  var res = await aiFetch("/api/ai-label", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, headers),
    body: JSON.stringify({ photos: body, auto: true }),
  });
  if (res.status === 402 || res.status === 429 || res.status === 503) {
    var code = "";
    try { code = (await res.json()).code || ""; } catch { /* ignore */ }
    throw new QuotaError(code !== "rate_limit_exceeded", code === FREE_SCAN_USED_CODE);
  }
  if (!res.ok) throw new Error("Label request failed (" + res.status + ")");
  var data = await res.json();
  return Array.isArray(data.labels) ? data.labels : [];
}

export function useLabelHealth(opts: {
  photos: Photo[];
  signedIn: boolean;
  applyPhotoLabels: (labels: Array<{ id: string; category: string; label: string }>) => void;
  /** Called once when the server says the one-time free scan is used up. */
  onFreeScanUsed?: () => void;
}) {
  var { photos, signedIn, applyPhotoLabels, onFreeScanUsed } = opts;
  var [store, setStore] = useState<LabelHealthStore>(loadStore);
  var storeRef = useRef(store);
  storeRef.current = store;
  var photosRef = useRef(photos);
  photosRef.current = photos;
  var [fix, setFix] = useState<FixStatus>({ kind: "idle" });
  var fixRef = useRef(fix);
  fixRef.current = fix;
  var lastRunRef = useRef(0);
  // In memory on purpose: the server is the source of truth, and this is per account, not per device.
  var [freeDone, setFreeDone] = useState(false);
  var freeDoneRef = useRef(false);

  var update = useCallback(function(fn: (s: LabelHealthStore) => LabelHealthStore) {
    setStore(function(prev) {
      var next = fn(prev);
      storeRef.current = next;
      saveStore(next);
      return next;
    });
  }, []);

  var health = useMemo(function() { return computeHealth(photos, store); }, [photos, store]);

  // Daily snapshot for the trend line (upserts today, keeps 30 days).
  useEffect(function() {
    if (health.total === 0) return;
    var today = dayKey(Date.now());
    var last = store.snapshots[store.snapshots.length - 1];
    if (last && last.day === today && last.labeled === health.labeled && last.total === health.total && last.score === health.score) return;
    update(function(s) {
      return Object.assign({}, s, { snapshots: addSnapshot(s.snapshots, { day: today, labeled: health.labeled, total: health.total, score: health.score }) });
    });
  }, [health.labeled, health.total, health.score, store.snapshots, update]);

  /** Apply AI labels, never overwriting a user-set label; records provenance. */
  var applyAi = useCallback(function(labels: PhotoLabel[]) {
    var info = storeRef.current.info;
    var ok = labels.filter(function(l) { return !(info[l.id] && info[l.id].source === "user"); });
    if (ok.length === 0) return ok;
    applyPhotoLabels(ok);
    var now = Date.now();
    update(function(s) {
      var next = Object.assign({}, s.info);
      ok.forEach(function(l) {
        next[l.id] = { source: "ai", labeledAt: now, confidence: typeof l.confidence === "number" ? l.confidence : undefined };
      });
      return Object.assign({}, s, { info: next });
    });
    return ok;
  }, [applyPhotoLabels, update]);

  var handleError = useCallback(function(e: unknown) {
    if (e instanceof QuotaError && e.freeUsed) {
      freeDoneRef.current = true;
      setFreeDone(true);
      setFix({ kind: "idle" });
      if (onFreeScanUsed) onFreeScanUsed();
      return;
    }
    if (e instanceof QuotaError) {
      // A rejected request costs nothing, so a fixed back-off is fine:
      // short for the burst limit, long for the per-user daily cap/credits/budget.
      var until = Date.now() + (e.daily ? 3 * 3600e3 : RUN_EVERY_MS);
      setFix({ kind: "paused", until: until, daily: e.daily });
      return;
    }
    setFix({ kind: "idle" });
    logBug({ source: "auto-relabel", message: "Label Health auto-fix failed: " + (e instanceof Error ? e.message : "unknown"), silent: true });
  }, [onFreeScanUsed]);

  var runFix = useCallback(async function(force: boolean) {
    var f = fixRef.current;
    if (!signedIn || f.kind === "running" || freeDoneRef.current) return;
    if (f.kind === "paused" && Date.now() < f.until) return;
    if (!force && Date.now() - lastRunRef.current < RUN_EVERY_MS) return;
    lastRunRef.current = Date.now();

    var s = storeRef.current;
    var h = computeHealth(photosRef.current, s);
    var byId: Record<string, Photo> = {};
    photosRef.current.forEach(function(p) { byId[p.id] = p; });
    var now = Date.now();
    var unlabeled = h.unlabeled.map(function(p) { return byId[p.id]; });
    var suspects = h.suspects
      .filter(function(x) { var i = s.info[x.photo.id]; return !i || now - i.labeledAt > RELABEL_COOLDOWN_MS || i.audit === "disagree"; })
      .map(function(x) { return byId[x.photo.id]; });
    var queue = unlabeled.concat(suspects).filter(Boolean);
    if (queue.length === 0) return;

    setFix({ kind: "running" });
    var requests = 0;
    var healed: PhotoLabel[] = [];
    try {
      for (var i = 0; i < queue.length && requests < REQUESTS_PER_RUN; i += BATCH, requests++) {
        healed = healed.concat(applyAi(await requestLabels(queue.slice(i, i + BATCH))));
      }
      setFix({ kind: "idle" });
    } catch (e) {
      handleError(e);
    }
    if (healed.length > 0) {
      track("photos_auto_relabeled", { count: healed.length });
      logBug({ source: "auto-relabel", message: "Label Health auto-fixed " + healed.length + " photo label(s) — no charge to the user.", context: { after: healed }, status: "fixed", silent: true });
    }
  }, [signedIn, applyAi, handleError]);

  // App open + pool changes → debounced, throttled background run.
  useEffect(function() {
    if (!signedIn || !store.autoFix || freeDone) return;
    var t = setTimeout(function() { void runFix(false); }, 4000);
    return function() { clearTimeout(t); };
  }, [signedIn, store.autoFix, freeDone, photos, runFix]);

  /** "Fix now" on one photo — only while the free first scan lasts. Resolves to an error message, or null on success. */
  var fixOne = useCallback(async function(photo: Photo): Promise<string | null> {
    var paused = "Auto-fix is paused — try again later.";
    if (freeDoneRef.current) return "Your free first scan is used up — use Scan (1 credit per photo).";
    var f = fixRef.current;
    if (f.kind === "paused" && Date.now() < f.until) return paused;
    try { applyAi(await requestLabels([photo])); return null; }
    catch (e) {
      handleError(e);
      if (e instanceof QuotaError && e.freeUsed) return "Your free first scan is used up — use Scan (1 credit per photo).";
      return e instanceof QuotaError ? paused : "Couldn't fix that label — try again.";
    }
  }, [applyAi, handleError]);

  /** "Looks right" — user verifies the current label (primary accuracy hit). */
  var verify = useCallback(function(photo: Photo) {
    var now = Date.now();
    update(function(s) {
      var prev = s.info[photo.id];
      if (prev && prev.source === "user") return s;
      var info = Object.assign({}, s.info);
      info[photo.id] = Object.assign({}, prev || { labeledAt: now }, { source: "user" as const });
      return Object.assign({}, s, { info: info, checks: s.checks.concat([{ id: photo.id, kind: "verified" as const, at: now }]) });
    });
  }, [update]);

  /** User edit — counts as a miss if it changed an AI label. Locks the label to the user. */
  var editLabel = useCallback(function(photo: Photo, category: string, label: string) {
    var now = Date.now();
    var prev = storeRef.current.info[photo.id];
    var wasAi = !(prev && prev.source === "user") && isValidCategory(photo.category) && !isGenericLabel(photo.alt);
    var changed = category.toUpperCase() !== photo.category.toUpperCase() || label.trim() !== photo.alt.trim();
    applyPhotoLabels([{ id: photo.id, category: category, label: label.trim() }]);
    update(function(s) {
      var info = Object.assign({}, s.info);
      var miss = wasAi && changed;
      info[photo.id] = { source: "user", labeledAt: now, audit: miss ? "corrected" : undefined };
      return Object.assign({}, s, { info: info, checks: miss ? s.checks.concat([{ id: photo.id, kind: "corrected" as const, at: now }]) : s.checks });
    });
  }, [applyPhotoLabels, update]);

  var setAutoFix = useCallback(function(on: boolean) {
    update(function(s) { return Object.assign({}, s, { autoFix: on }); });
  }, [update]);

  return { health: health, store: store, fix: fix, freeDone: freeDone, applyAi: applyAi, runFix: runFix, fixOne: fixOne, verify: verify, editLabel: editLabel, setAutoFix: setAutoFix };
}
