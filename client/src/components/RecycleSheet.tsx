/**
 * RecycleSheet — swap one dump photo for a pool photo.
 * Step 1: Ask "Manual pick" or "Let AI choose"
 * Step 2a (Manual): Show pool grid, tap to swap
 * Step 2b (AI): Call API, auto-swap, show result
 */
import { useState, useCallback, useEffect } from "react";
import { X, Hand, Sparkles, Loader, Check } from "lucide-react";
import { getAuthHeaders } from "@/lib/supabase";
import type { Photo, Dump } from "@/lib/photoData";
import { buildTasteBlock } from "@/lib/captionPool";
import { notVideo } from "@/lib/videoStore";
import { friendlyError } from "@/lib/friendlyError";
import { CREDIT_COSTS } from "@/lib/credits";

interface RecycleSheetProps {
  open: boolean;
  photoId: string | null;
  dumpId: string | null;
  dumps: Dump[];
  pool: Photo[];
  onClose: () => void;
  onSwap: (dumpId: string, oldPhotoId: string, newPhotoId: string) => void;
  /** Opens the existing buy-credits flow (OutOfCreditsOverlay). */
  onOutOfCredits?: () => void;
}

type Phase = "choose" | "manual" | "ai-loading" | "ai-done";

export default function RecycleSheet({
  open, photoId, dumpId, dumps, pool, onClose, onSwap, onOutOfCredits,
}: RecycleSheetProps) {
  var [phase, setPhase] = useState<Phase>("choose");
  var [aiPickId, setAiPickId] = useState<string | null>(null);
  var [aiReason, setAiReason] = useState<string>("");
  var [outOfCredits, setOutOfCredits] = useState(false);

  // Reset on open
  useEffect(function() {
    if (open) {
      setPhase("choose");
      setAiPickId(null);
      setAiReason("");
      setOutOfCredits(false);
    }
  }, [open]);

  // Find the photo and dump
  var dump: Dump | null = null;
  var photo: Photo | null = null;
  if (dumpId && photoId) {
    for (var i = 0; i < dumps.length; i++) {
      if (dumps[i].id === dumpId) {
        dump = dumps[i];
        for (var j = 0; j < dumps[i].photos.length; j++) {
          if (dumps[i].photos[j].id === photoId) {
            photo = dumps[i].photos[j];
            break;
          }
        }
        break;
      }
    }
  }

  var handleManualPick = useCallback(function(poolPhotoId: string) {
    if (dumpId && photoId) {
      onSwap(dumpId, photoId, poolPhotoId);
      onClose();
    }
  }, [dumpId, photoId, onSwap, onClose]);

  var handleAIPick = useCallback(async function() {
    if (!dump || !photo || pool.length === 0) return;
    setPhase("ai-loading");

    try {
      var authH = await getAuthHeaders();
      var res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authH),
        body: JSON.stringify({
          dumpId: dump.id,
          dumpTitle: dump.title,
          // videos are device-only by owner decision
          dumpPhotos: dump.photos.filter(notVideo).map(function(p) {
            return { id: p.id, url: p.url, alt: p.alt, category: p.category };
          }),
          poolPhotos: pool.filter(notVideo).map(function(p) {
            return { id: p.id, url: p.url, alt: p.alt, category: p.category };
          }),
          history: [],
          message: "I want to recycle (swap out) the photo [" + photo.id + "] (" + photo.category + " — " + photo.alt + ") from this dump. Pick the BEST replacement from the pool that fits the dump's overall vibe and flow. Respond with a swap_out action for the photo's index and a swap_in action for your pick. Explain briefly why this replacement works better.",
          tasteProfile: buildTasteBlock(), // profile + AI rules + active dump style, same as Valet
          vibe: dump.vibe || "",
        }),
      });

      // Read as text first — Vercel infra errors (413/504) are plain text.
      var rawText = await res.text();
      var data: { reply?: string; error?: string; code?: string; actions?: Array<{ type: string; photoId?: string; index?: number }> } = {};
      try { data = JSON.parse(rawText); } catch { /* non-JSON infra error */ }
      if (!res.ok) {
        if (res.status === 402 || data.code === "insufficient_credits") {
          setOutOfCredits(true);
          setAiReason("You're out of credits for an AI pick. Top up, or pick one yourself.");
        } else {
          var fe = friendlyError(data.error || data.code || rawText || "HTTP " + res.status, "ai_recycle");
          setAiReason(fe.hint ? fe.message + " " + fe.hint : fe.message);
        }
        setPhase("ai-done");
        return;
      }

      // Find the swap_in action — only accept a photo that's really in the pool.
      var pickId: string | null = null;
      var actions = Array.isArray(data.actions) ? data.actions : [];
      for (var ai = 0; ai < actions.length; ai++) {
        var a = actions[ai];
        if (a && a.type === "swap_in" && a.photoId && pool.some(function(p) { return p.id === a.photoId && notVideo(p); })) {
          pickId = a.photoId;
          break;
        }
      }

      setAiPickId(pickId);
      // No valid swap — show the AI's reasoning (or a fallback) instead
      setAiReason(data.reply || (pickId ? "" : "I couldn't find a good replacement. Try picking manually."));
      setPhase("ai-done");
    } catch (e) {
      var fe2 = friendlyError(e, "ai_recycle");
      setAiReason(fe2.hint ? fe2.message + " " + fe2.hint : fe2.message);
      setPhase("ai-done");
    }
  }, [dump, photo, pool]);

  var handleConfirmAI = useCallback(function() {
    if (dumpId && photoId && aiPickId) {
      onSwap(dumpId, photoId, aiPickId);
      onClose();
    }
  }, [dumpId, photoId, aiPickId, onSwap, onClose]);

  if (!open || !photo || !dump) return null;

  // Find the AI pick photo for preview
  var aiPickPhoto: Photo | null = null;
  if (aiPickId) {
    for (var pi = 0; pi < pool.length; pi++) {
      if (pool[pi].id === aiPickId) { aiPickPhoto = pool[pi]; break; }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)", zIndex: 450,
      }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 451,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden",
        maxHeight: "80vh", display: "flex", flexDirection: "column",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px 12px", borderBottom: "1px solid #1a1a1a", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Current photo thumbnail */}
            <div style={{
              width: 40, height: 40, borderRadius: 8, overflow: "hidden",
              border: "2px solid #ef4444", flexShrink: 0,
            }}>
              <img src={photo.url} alt={photo.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                {"♻️ Recycle Photo"}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
                {photo.category + " · " + dump.title}
              </div>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#8a8a8a",
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* Phase: choose */}
          {phase === "choose" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#999", marginBottom: 8, lineHeight: 1.6 }}>
                Swap this photo for something from your pool. Pick yourself or let AI find the best fit.
              </div>

              <button
                onClick={function() { setPhase("manual"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12,
                  padding: "16px 18px", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s", width: "100%", textAlign: "left" as const,
                }}
                onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)", flexShrink: 0,
                }}>
                  <Hand size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e8e8" }}>Manual Pick</div>
                  <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 2 }}>Browse the pool and choose</div>
                </div>
              </button>

              <button
                onClick={handleAIPick}
                disabled={pool.length === 0}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12,
                  padding: "16px 18px", cursor: pool.length === 0 ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "all 0.15s", width: "100%",
                  textAlign: "left" as const, opacity: pool.length === 0 ? 0.4 : 1,
                }}
                onMouseEnter={function(e) { if (pool.length > 0) e.currentTarget.style.borderColor = "#a78bfa"; }}
                onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#a78bfa", flexShrink: 0,
                }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e8e8" }}>Let AI Choose</div>
                  <div style={{ fontSize: 11, color: "#8a8a8a", marginTop: 2 }}>
                    {pool.length === 0 ? "Pool is empty" : "Best fit based on the dump's vibe · " + CREDIT_COSTS.ai_recycle + (CREDIT_COSTS.ai_recycle === 1 ? " credit" : " credits")}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Phase: manual — pool grid */}
          {phase === "manual" && (
            <>
              <div style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 14 }}>
                {"Tap a photo to swap it in · " + pool.length + " available"}
              </div>
              {pool.length === 0 && (
                <div style={{ fontSize: 13, color: "#444", textAlign: "center", padding: "40px 0" }}>
                  Pool is empty
                </div>
              )}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8,
              }}>
                {pool.map(function(p) {
                  return (
                    <div
                      key={p.id}
                      onClick={function() { handleManualPick(p.id); }}
                      style={{
                        position: "relative", cursor: "pointer", borderRadius: 8, overflow: "hidden",
                        border: "2px solid #2a2a2a", aspectRatio: "3/4",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#4ade80"; }}
                      onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
                    >
                      <img src={p.url} alt={p.alt} style={{
                        width: "100%", height: "100%", objectFit: "cover", display: "block",
                      }} />
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                        padding: "16px 4px 4px", fontSize: 9, color: "rgba(255,255,255,0.7)",
                        fontWeight: 600, textAlign: "center",
                      }}>
                        {p.category}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Phase: AI loading */}
          {phase === "ai-loading" && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "48px 20px", gap: 14,
            }}>
              <Loader size={24} color="#a78bfa" style={{ animation: "spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8" }}>
                Finding the best swap...
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                Analyzing your dump's vibe and pool
              </div>
              <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
            </div>
          )}

          {/* Phase: AI done — show result */}
          {phase === "ai-done" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* AI reasoning */}
              <div style={{
                background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12,
                padding: "14px 16px", fontSize: 13, color: "#ccc", lineHeight: 1.6,
              }}>
                {aiReason}
              </div>

              {/* Before → After preview */}
              {aiPickPhoto && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                  {/* Old photo */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      width: 80, height: 100, borderRadius: 8, overflow: "hidden",
                      border: "2px solid #ef4444", margin: "0 auto",
                    }}>
                      <img src={photo.url} alt={photo.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, marginTop: 6 }}>OUT</div>
                  </div>

                  {/* Arrow */}
                  <div style={{ fontSize: 20, color: "#8a8a8a" }}>{"→"}</div>

                  {/* New photo */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      width: 80, height: 100, borderRadius: 8, overflow: "hidden",
                      border: "2px solid #4ade80", margin: "0 auto",
                    }}>
                      <img src={aiPickPhoto.url} alt={aiPickPhoto.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 600, marginTop: 6 }}>IN</div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                {aiPickPhoto && (
                  <button
                    onClick={handleConfirmAI}
                    style={{
                      flex: 1, background: "#4ade80", color: "#000", border: "none",
                      borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit", display: "flex",
                      alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    <Check size={16} strokeWidth={3} /> Swap It
                  </button>
                )}
                {outOfCredits && onOutOfCredits && (
                  <button
                    onClick={function() { onClose(); onOutOfCredits(); }}
                    style={{
                      flex: 1, background: "var(--accent)", color: "#000", border: "none",
                      borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Get credits
                  </button>
                )}
                <button
                  onClick={function() { setPhase("manual"); }}
                  style={{
                    flex: aiPickPhoto ? 0 : 1, padding: "14px 20px",
                    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12,
                    color: "#999", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Pick Myself
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
