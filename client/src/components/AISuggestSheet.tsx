/**
 * AutoGenSheet — Auto-generate a dump from the pool.
 *
 * UI is named "Auto Gen" for users; file/class names keep "AISuggest" for
 * backward compat with server action names, Sentry breadcrumbs, etc.
 *
 * Default path: Claude Vision Haiku (smart clustering, costs 15 credits).
 * Fallback path: pure-JS offline algorithm (free, instant) — used silently
 * if any AI failure happens (5MB, 429, 503, 504, network down).
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { aiFetch } from "@/lib/creditSync";
import { toast } from "sonner";
import { getAiHeaders } from "@/lib/supabase";
import { Sparkles, X, RefreshCcw, Plus, Loader2, Minus } from "lucide-react";
import type { Photo } from "@/lib/photoData";
import { buildTasteBlock, loadDumpStyles, loadActiveDumpStyleId, saveActiveDumpStyleId, type DumpStyle } from "@/lib/captionPool";
import { compressDataUrlForVision } from "@/lib/imageDownscale";
import { friendlyError } from "@/lib/friendlyError";
import { offlineAutoGen } from "@/lib/offlineAutoGen";
import AutoGenAdvanced, { EMPTY_FILTERS, applyAutoGenFilters, type AutoGenFilters } from "./AutoGenAdvanced";
import { notVideo } from "@/lib/videoStore";
import { useAuth } from "@/contexts/AuthContext";
import { CREDIT_COSTS } from "@/lib/credits";
import { pickPhotoWindow } from "@/lib/photoWindow";
import { DUMP_STYLE_USED_BY } from "@/lib/captionPool";

export interface SuggestedCluster {
  name: string;
  subtitle: string;
  photoIds: string[];
}

interface AISuggestSheetProps {
  open: boolean;
  onClose: () => void;
  poolPhotos: Photo[];
  onCreateDumps: (clusters: SuggestedCluster[]) => void;
  /** Photo IDs already used in existing dumps — enables Discovery mode. */
  usedPhotoIds?: Set<string>;
  /** Opens the buy-credits overlay (same as Recycle's "Get credits"). */
  onOutOfCredits?: () => void;
}

type Phase = "idle" | "loading" | "result" | "error";

const MAX_PHOTOS = 20;

export default function AISuggestSheet({
  open,
  onClose,
  poolPhotos,
  onCreateDumps,
  usedPhotoIds,
  onOutOfCredits,
}: AISuggestSheetProps) {
  const { user, totalCredits } = useAuth();
  const COST = CREDIT_COSTS.ai_suggest;
  // Signed-out users get the server's 401 message; only gate on a known balance.
  const tooFewCredits = Boolean(user) && totalCredits < COST;
  const [styleSwitched, setStyleSwitched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState<AutoGenFilters>(EMPTY_FILTERS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cluster, setCluster] = useState<SuggestedCluster | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorHint, setErrorHint] = useState("");
  const [slow, setSlow] = useState(false); // >15s in flight → "still working…"
  // Re-evaluate taste block each time the sheet opens so edits in MainMenu are picked up
  const [tasteActive, setTasteActive] = useState(false);
  const [dumpStyles, setDumpStyles] = useState<DumpStyle[]>([]);
  const [activeStyleId, setActiveStyleId] = useState("");
  useEffect(() => {
    if (!open) return;
    setTasteActive(Boolean(buildTasteBlock()));
    setDumpStyles(loadDumpStyles());
    setActiveStyleId(loadActiveDumpStyleId());
    setStyleSwitched(false);
  }, [open]);
  const variationRef = useRef(0);
  // Single-use token from the server for the dump on screen; spent to get the
  // credits back if the user rejects it (new suggestion / close without Create).
  const refundTokenRef = useRef<string | null>(null);
  const refundRejected = useCallback(async () => {
    const token = refundTokenRef.current;
    refundTokenRef.current = null;
    if (!token) return;
    try {
      const r = await aiFetch("/api/ai-suggest-refund", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, await getAiHeaders()),
        body: JSON.stringify({ token }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.success("Dump discarded — " + (d.refunded || "") + " credits refunded");
      }
      else if (r.status === 429) toast("Dump discarded — daily refund limit reached, no credits returned");
    } catch { /* refund is best-effort; balance re-syncs on next read */ }
  }, []);

  // Apply advanced filters BEFORE truncating to MAX_PHOTOS so the cap is
  // applied to the filtered subset (not the full pool).
  const filteredPool = useMemo(
    () => applyAutoGenFilters(poolPhotos.filter(notVideo), filters, usedPhotoIds), // videos are device-only by owner decision
    [poolPhotos, filters, usedPhotoIds]
  );
  // Newest first (pool appends uploads), unless the user asked for a shuffle.
  // Photos already in a dump are stripped by applyAutoGenFilters.
  const shuffled = filters.mix.on && filters.mix.shuffle;
  const orderedPool = useMemo(
    () => (shuffled ? filteredPool : filteredPool.slice().reverse()),
    [filteredPool, shuffled]
  );
  // The server caps at MAX_PHOTOS; rotate which window is sent so repeated
  // "New Suggestion" runs see the whole pool instead of the same first 20.
  const [windowIndex, setWindowIndex] = useState(0);
  useEffect(() => { setWindowIndex(0); }, [orderedPool]);
  const photosToAnalyze = useMemo(
    () => pickPhotoWindow(orderedPool, MAX_PHOTOS, windowIndex),
    [orderedPool, windowIndex]
  );
  const isCapped = orderedPool.length > MAX_PHOTOS;
  const filteredOutCount = poolPhotos.length - filteredPool.length;

  // Stepper for how many photos go in the dump (null = Auto)
  const stepperMax = Math.min(20, photosToAnalyze.length);
  const stepperMin = 2;
  const [targetCount, setTargetCount] = useState<number | null>(null); // null = Auto

  // Clamp targetCount if pool shrinks below current value
  useEffect(() => {
    if (targetCount !== null && targetCount > stepperMax) {
      setTargetCount(stepperMax >= stepperMin ? stepperMax : null);
    }
  }, [targetCount, stepperMax]);

  /**
   * Try the offline algorithm and show its result. Returns true if it produced
   * a valid cluster (so the AI error can be hidden), false otherwise.
   * Called whenever an AI failure happens — silent graceful degradation.
   */
  const tryOfflineFallback = useCallback(async (aiFailureReason: string, photos: Photo[]) => {
    const offline = await offlineAutoGen(photos, targetCount);
    if (!offline) return false;
    setCluster(offline);
    setPhase("result");
    // Subtle toast so the user knows it wasn't the full-AI path
    toast(`Used quick gen (${aiFailureReason})`);
    return true;
  }, [targetCount]);

  const analyze = useCallback(async (variation: number, photos: Photo[]) => {
    setPhase("loading");
    setErrorMsg("");
    setErrorHint("");
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 15000);

    try {
      var authH = await getAiHeaders();
      // Compress data-URL photos down to ~1024px / 0.65 quality so the JSON
      // request body fits under Vercel's 4.5 MB limit. Cloud-hosted URLs pass
      // through untouched.
      const compressedPhotos = await Promise.all(
        photos.map(async (p) => ({
          id: p.id,
          url: await compressDataUrlForVision(p.url),
          alt: p.alt,
          category: p.category,
          meta: p.meta,
        }))
      );
      const res = await aiFetch("/api/ai-suggest", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authH),
        // api/ai-suggest maxDuration is 60s (vercel.json) and the server
        // refunds on its own failures. Wait past that so we never abandon a
        // call the user is being charged for; abort only if the platform hangs.
        signal: AbortSignal.timeout(65000),
        body: JSON.stringify({
          photos: compressedPhotos,
          variation,
          targetCount,
          tasteBlock: buildTasteBlock(),
          // Pass any freeform vibe note from Advanced — server appends it
          // to the prompt verbatim.
          userHint: filters.vibeNote.trim() || undefined,
        }),
      });

      // Read as text first — Vercel returns plain text for infrastructure
      // errors (e.g. "Request Entity Too Large" with HTTP 413).
      const rawText = await res.text();
      let data: { clusters?: SuggestedCluster[]; error?: string };
      try {
        data = JSON.parse(rawText);
      } catch {
        // Non-JSON response (infra error from Vercel) — fall back to offline
        const fe = friendlyError(rawText || `HTTP ${res.status}`, "ai_suggest");
        if (await tryOfflineFallback(fe.message.toLowerCase().replace(/\.$/, ""), photos)) return;
        setErrorMsg(fe.message);
        setErrorHint(fe.hint || "");
        setPhase("error");
        return;
      }
      if (!res.ok) {
        const fe = friendlyError(data.error || `HTTP ${res.status}`, "ai_suggest");
        if (await tryOfflineFallback(fe.message.toLowerCase().replace(/\.$/, ""), photos)) return;
        setErrorMsg(fe.message);
        setErrorHint(fe.hint || "");
        setPhase("error");
        return;
      }

      const first: SuggestedCluster | undefined = (data.clusters || [])[0];
      if (!first || first.photoIds.length < 2) {
        // AI succeeded but didn't return a useful cluster — try offline silently
        if (await tryOfflineFallback("AI couldn't find a sequence", photos)) return;
        setErrorMsg("Couldn't build a sequence from these photos.");
        setErrorHint("Try a different selection or add more variety.");
        setPhase("error");
        return;
      }

      refundTokenRef.current = res.headers.get("X-Refund-Token");
      setCluster(first);
      setPhase("result");
    } catch (e) {
      const fe = friendlyError(e, "ai_suggest");
      if (await tryOfflineFallback(fe.message.toLowerCase().replace(/\.$/, ""), photos)) return;
      setErrorMsg(fe.message);
      setErrorHint(fe.hint || "");
      setPhase("error");
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
    }
  }, [targetCount, tryOfflineFallback, filters.vibeNote]);

  const handleAnalyze = useCallback(() => {
    if (tooFewCredits) return;
    variationRef.current = 0;
    setWindowIndex(0);
    analyze(0, pickPhotoWindow(orderedPool, MAX_PHOTOS, 0));
  }, [analyze, orderedPool, tooFewCredits]);

  const handleNewSuggestion = useCallback(() => {
    if (tooFewCredits) return;
    refundRejected();
    variationRef.current += 1;
    const next = isCapped ? windowIndex + 1 : 0;
    setWindowIndex(next);
    analyze(variationRef.current, pickPhotoWindow(orderedPool, MAX_PHOTOS, next));
  }, [analyze, orderedPool, isCapped, windowIndex, tooFewCredits, refundRejected]);

  const handleCreate = useCallback(() => {
    if (!cluster) return;
    refundTokenRef.current = null; // kept — no refund
    onCreateDumps([cluster]);
    onClose();
    setPhase("idle");
    setCluster(null);
    variationRef.current = 0;
    setWindowIndex(0);
  }, [cluster, onCreateDumps, onClose]);

  const handleClose = useCallback(() => {
    refundRejected();
    onClose();
    setTimeout(() => {
      setPhase("idle");
      setCluster(null);
      setErrorMsg("");
      setErrorHint("");
      variationRef.current = 0;
      setWindowIndex(0);
    }, 300);
  }, [onClose, refundRejected]);

  const activeStyle = dumpStyles.find((d) => d.id === activeStyleId);

  const creditsHint = user ? (
    <div style={{ marginTop: 12, fontSize: 12, textAlign: "center", color: tooFewCredits ? "#f87171" : "#8a8a8a" }}>
      {tooFewCredits
        ? "Auto Gen needs " + COST + " credits — you have " + totalCredits + "."
        : "You have " + totalCredits + " credits."}
      {tooFewCredits && onOutOfCredits && (
        <button
          onClick={() => { handleClose(); onOutOfCredits(); }}
          style={{
            display: "block", margin: "10px auto 0",
            background: "var(--accent)", color: "#000", border: "none",
            borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Get credits
        </button>
      )}
    </div>
  ) : null;

  const photoMap: Record<string, Photo> = {};
  for (const p of poolPhotos) photoMap[p.id] = p;

  if (!open) return null;

  const clusterPhotos = cluster
    ? cluster.photoIds.map((id) => photoMap[id]).filter(Boolean)
    : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)", zIndex: 400,
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0",
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px", borderBottom: "1px solid #1e1e1e",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(var(--accent-rgb),0.12)", border: "1px solid rgba(var(--accent-rgb),0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                Auto Gen
              </div>
              <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 1 }}>
                Claude Vision · {isCapped
                  ? "AI sees " + photosToAnalyze.length + " of " + orderedPool.length + " photos"
                  : photosToAnalyze.length + " photos"}
              </div>
            </div>
          </div>
          <button aria-label="Close" onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#8a8a8a",
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px calc(32px + env(safe-area-inset-bottom, 0px))" }}>

          {/* ── IDLE ── */}
          {phase === "idle" && (
            <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: "rgba(var(--accent-rgb),0.08)", border: "1px solid rgba(var(--accent-rgb),0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <Sparkles size={24} color="var(--accent)" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                Auto-arrange one dump
              </div>
              <div style={{ fontSize: 13, color: "#8a8a8a", lineHeight: 1.6, maxWidth: 300, margin: "0 auto 24px" }}>
                Claude picks the best 2–20 photos from your pool and sequences them into a single dump.
              </div>
              {isCapped && (
                <div style={{ fontSize: 11, color: "#8a8a8a", lineHeight: 1.5, maxWidth: 320, margin: "-14px auto 18px" }}>
                  AI sees {MAX_PHOTOS} of {orderedPool.length} photos per run (newest unused first). Each New Suggestion looks at the next {MAX_PHOTOS}.
                </div>
              )}

              {/* Mini photo preview */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 28 }}>
                {photosToAnalyze.slice(0, 10).map((p) => (
                  <div key={p.id} style={{ aspectRatio: "1", borderRadius: 6, overflow: "hidden", background: "#1a1a1a" }}>
                    <img src={p.url} alt={p.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>

              {poolPhotos.length < 2 ? (
                <div style={{
                  padding: "14px 18px", borderRadius: 10,
                  background: "#1a1a1a", border: "1px solid #2a2a2a",
                  color: "#8a8a8a", fontSize: 13,
                }}>
                  Add at least 2 photos to the pool first.
                </div>
              ) : (
                <>
                  {/* Photo count stepper */}
                  <div style={{
                    background: "#141414", border: "1px solid #1e1e1e", borderRadius: 12,
                    padding: "14px 18px", marginBottom: 18,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8", letterSpacing: "0.02em" }}>
                        Photos in dump
                      </div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 2, letterSpacing: "0.04em" }}>
                        {targetCount === null ? "Claude will decide (2-20)" : "Exactly " + targetCount + " photos"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Auto chip */}
                      <button
                        onClick={() => setTargetCount(null)}
                        style={{
                          background: targetCount === null ? "var(--accent)" : "transparent",
                          border: targetCount === null ? "none" : "1px solid #2a2a2a",
                          borderRadius: 18, padding: "6px 12px",
                          color: targetCount === null ? "#000" : "#888",
                          fontSize: 11, fontWeight: 700, cursor: "pointer",
                          fontFamily: "inherit", letterSpacing: "0.05em",
                          transition: "all 0.15s",
                        }}
                      >
                        AUTO
                      </button>

                      {/* Stepper */}
                      <div style={{
                        display: "flex", alignItems: "center",
                        background: "#0a0a0a", border: "1px solid #2a2a2a",
                        borderRadius: 18, padding: 3,
                      }}>
                        <button aria-label="Fewer photos"
                          onClick={() => {
                            const cur = targetCount ?? 5;
                            const next = Math.max(stepperMin, cur - 1);
                            setTargetCount(next);
                          }}
                          disabled={targetCount !== null && targetCount <= stepperMin}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "transparent", border: "none",
                            color: targetCount !== null && targetCount <= stepperMin ? "#333" : "var(--accent)",
                            cursor: targetCount !== null && targetCount <= stepperMin ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: 0,
                          }}
                        >
                          <Minus size={12} />
                        </button>
                        <div style={{
                          minWidth: 28, textAlign: "center",
                          fontSize: 13, fontWeight: 700, color: "#fff",
                          padding: "0 6px",
                        }}>
                          {targetCount ?? 5}
                        </div>
                        <button aria-label="More photos"
                          onClick={() => {
                            const cur = targetCount ?? 5;
                            const next = Math.min(stepperMax, cur + 1);
                            setTargetCount(next);
                          }}
                          disabled={targetCount !== null && targetCount >= stepperMax}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "transparent", border: "none",
                            color: targetCount !== null && targetCount >= stepperMax ? "#333" : "var(--accent)",
                            cursor: targetCount !== null && targetCount >= stepperMax ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: 0,
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dump style picker — sets the active style used by buildTasteBlock */}
                  {dumpStyles.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 11, color: "#8a8a8a", letterSpacing: "0.02em" }}>Style</span>
                      <select
                        value={activeStyleId}
                        onChange={function(e) {
                          const id = e.target.value;
                          const st = dumpStyles.find(function(d) { return d.id === id; });
                          setActiveStyleId(id);
                          saveActiveDumpStyleId(id);
                          setTasteActive(Boolean(buildTasteBlock()));
                          setStyleSwitched(true);
                          toast(st ? (st.name || "Untitled") + " style on" : "Dump style off");
                        }}
                        style={{
                          flex: 1, background: "#0a0a0a", color: "#e8e8e8",
                          border: "1px solid #2a2a2a", borderRadius: 8,
                          padding: "6px 8px", fontSize: 12, fontFamily: "inherit",
                        }}
                      >
                        <option value="">None</option>
                        {dumpStyles.map(function(st) {
                          return <option key={st.id} value={st.id}>{st.name || "Untitled"}</option>;
                        })}
                      </select>
                    </div>
                  )}
                  {styleSwitched && (
                    <div role="status" style={{ fontSize: 11, color: "#C8A06E", marginTop: -8, marginBottom: 14, textAlign: "left" }}>
                      {DUMP_STYLE_USED_BY}
                    </div>
                  )}

                  {/* Advanced filters — date, time, category, mix mode, vibe */}
                  <AutoGenAdvanced
                    availableCategories={poolPhotos.map(function(p) { return p.category; })}
                    open={advancedOpen}
                    onToggleOpen={function() { setAdvancedOpen(function(v) { return !v; }); }}
                    value={filters}
                    onChange={setFilters}
                  />

                  {/* Filter result preview — only when filters actually drop something */}
                  {filteredOutCount > 0 && (
                    <div style={{
                      fontSize: 11, color: "#8a8a8a",
                      marginBottom: 14, letterSpacing: "0.02em",
                    }}>
                      Filters match <span style={{ color: "var(--accent)", fontWeight: 700 }}>{filteredPool.length}</span> of {poolPhotos.length} photos
                      {filteredPool.length < 2 ? " — need at least 2 to gen." : ""}
                    </div>
                  )}

                  {/* Taste active indicator */}
                  {tasteActive && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: "rgba(var(--accent-rgb),0.08)", border: "1px solid rgba(var(--accent-rgb),0.25)",
                      borderRadius: 100, padding: "5px 12px", marginBottom: 14,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em" }}>
                        {activeStyle ? "STYLE: " + (activeStyle.name || "Untitled").toUpperCase() + " · " : ""}TASTE PROFILE ACTIVE
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: "#8a8a8a", marginBottom: 10 }}>
                    {"Style: " + (activeStyle ? (activeStyle.name || "Untitled") : "None")}
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={filteredPool.length < 2 || tooFewCredits}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      background: filteredPool.length < 2 || tooFewCredits ? "#2a2a2a" : "var(--accent)",
                      border: "none", borderRadius: 10,
                      padding: "13px 28px",
                      color: filteredPool.length < 2 || tooFewCredits ? "#8a8a8a" : "#000",
                      fontSize: 14, fontWeight: 700,
                      cursor: filteredPool.length < 2 || tooFewCredits ? "default" : "pointer",
                      letterSpacing: "0.02em", fontFamily: "inherit",
                    }}
                  >
                    <Sparkles size={15} /> Generate Suggestion · {COST} credits
                  </button>
                  {creditsHint}
                </>
              )}
            </div>
          )}

          {/* ── LOADING ── */}
          {phase === "loading" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Loader2
                size={38} color="var(--accent)"
                style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px", display: "block" }}
              />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
                {slow ? "Still working…" : variationRef.current > 0 ? "Finding a different angle..." : "Analyzing your photos..."}
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {slow ? "Big pools can take up to a minute. Hang tight." : "Claude is picking the best sequence"}
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── ERROR ── */}
          {phase === "error" && (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div style={{
                padding: "14px 18px", borderRadius: 10,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444", fontSize: 13, marginBottom: 20, textAlign: "left",
              }}>
                <strong style={{ display: "block", marginBottom: 4 }}>{errorMsg}</strong>
                {errorHint && (
                  <span style={{ color: "rgba(239,68,68,0.7)", fontSize: 12 }}>{errorHint}</span>
                )}
              </div>
              <button onClick={handleAnalyze} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
                padding: "12px 20px", color: "var(--accent)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                <RefreshCcw size={14} /> Try Again · {COST} credits
              </button>
              {creditsHint}
            </div>
          )}

          {/* ── RESULT ── */}
          {phase === "result" && cluster && (
            <div>
              {/* Dump preview card */}
              <div style={{
                background: "rgba(var(--accent-rgb),0.05)", border: "1px solid rgba(var(--accent-rgb),0.2)",
                borderRadius: 14, padding: "18px 18px 14px", marginBottom: 20,
              }}>
                {/* Name + count */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                    {cluster.name}
                  </div>
                  <div style={{
                    background: "rgba(var(--accent-rgb),0.15)", borderRadius: 20,
                    padding: "3px 10px", fontSize: 11, fontWeight: 700,
                    color: "var(--accent)", letterSpacing: "0.04em", flexShrink: 0, marginLeft: 12,
                  }}>
                    {clusterPhotos.length} photos
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 16 }}>
                  {cluster.subtitle}
                </div>

                {/* Photo strip */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {clusterPhotos.map((p) => (
                    <div key={p.id} style={{
                      position: "relative", flexShrink: 0,
                      width: 72, height: 90, borderRadius: 8, overflow: "hidden", background: "#1a1a1a",
                    }}>
                      <img src={p.url} alt={p.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleNewSuggestion} disabled={tooFewCredits} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
                  padding: "12px 16px", color: tooFewCredits ? "#555" : "#999",
                  fontSize: 13, fontWeight: 500, cursor: tooFewCredits ? "default" : "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#ccc"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#999"; }}
                >
                  <RefreshCcw size={14} /> New Suggestion · {COST} credits
                </button>
                <button onClick={handleCreate} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: "var(--accent)", border: "none", borderRadius: 10,
                  padding: "12px 20px", color: "#000",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  letterSpacing: "0.02em",
                }}>
                  <Plus size={16} /> Create Dump
                </button>
              </div>

              {creditsHint}
              {isCapped && !tooFewCredits && (
                <div style={{ marginTop: 10, fontSize: 11, color: "#555", textAlign: "center" }}>
                  New Suggestion looks at a different {MAX_PHOTOS} of your {orderedPool.length} photos.
                </div>
              )}

              {/* Pool remainder note */}
              {poolPhotos.length > clusterPhotos.length && (
                <div style={{ marginTop: 14, fontSize: 11, color: "#555", textAlign: "center" }}>
                  {poolPhotos.length - clusterPhotos.length} photos will stay in pool
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
