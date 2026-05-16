/**
 * AISuggestSheet — Claude Vision Haiku single-dump suggestion flow
 * Suggests ONE dump at a time (2–20 photos). Accept or get a new suggestion.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, X, RefreshCcw, Plus, Loader2, Minus } from "lucide-react";
import type { Photo } from "@/lib/photoData";
import { buildTasteBlock } from "@/lib/captionPool";

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
}

type Phase = "idle" | "loading" | "result" | "error";

const MAX_PHOTOS = 20;

export default function AISuggestSheet({
  open,
  onClose,
  poolPhotos,
  onCreateDumps,
}: AISuggestSheetProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [cluster, setCluster] = useState<SuggestedCluster | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const variationRef = useRef(0);

  const photosToAnalyze = poolPhotos.slice(0, MAX_PHOTOS);

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

  const analyze = useCallback(async (variation: number) => {
    setPhase("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: photosToAnalyze.map((p) => ({
            id: p.id,
            url: p.url,
            alt: p.alt,
            category: p.category,
          })),
          variation,
          targetCount,
          tasteBlock: buildTasteBlock(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong");
        setPhase("error");
        return;
      }

      const first: SuggestedCluster | undefined = (data.clusters || [])[0];
      if (!first || first.photoIds.length < 2) {
        setErrorMsg("Claude couldn't find a good sequence. Try again.");
        setPhase("error");
        return;
      }

      setCluster(first);
      setPhase("result");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setPhase("error");
    }
  }, [photosToAnalyze]);

  const handleAnalyze = useCallback(() => {
    variationRef.current = 0;
    analyze(0);
  }, [analyze]);

  const handleNewSuggestion = useCallback(() => {
    variationRef.current += 1;
    analyze(variationRef.current);
  }, [analyze]);

  const handleCreate = useCallback(() => {
    if (!cluster) return;
    onCreateDumps([cluster]);
    onClose();
    setPhase("idle");
    setCluster(null);
    variationRef.current = 0;
  }, [cluster, onCreateDumps, onClose]);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setPhase("idle");
      setCluster(null);
      setErrorMsg("");
      variationRef.current = 0;
    }, 300);
  }, [onClose]);

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
              background: "rgba(200,169,110,0.12)", border: "1px solid rgba(200,169,110,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={16} color="#c8a96e" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                AI Suggest
              </div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>
                Claude Vision · {photosToAnalyze.length} photos
              </div>
            </div>
          </div>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#666",
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 32px" }}>

          {/* ── IDLE ── */}
          {phase === "idle" && (
            <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <Sparkles size={24} color="#c8a96e" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                Auto-arrange one dump
              </div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, maxWidth: 300, margin: "0 auto 24px" }}>
                Claude picks the best 2–20 photos from your pool and sequences them into a single dump.
              </div>

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
                  color: "#666", fontSize: 13,
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
                          background: targetCount === null ? "#c8a96e" : "transparent",
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
                        <button
                          onClick={() => {
                            const cur = targetCount ?? 5;
                            const next = Math.max(stepperMin, cur - 1);
                            setTargetCount(next);
                          }}
                          disabled={targetCount !== null && targetCount <= stepperMin}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "transparent", border: "none",
                            color: targetCount !== null && targetCount <= stepperMin ? "#333" : "#c8a96e",
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
                        <button
                          onClick={() => {
                            const cur = targetCount ?? 5;
                            const next = Math.min(stepperMax, cur + 1);
                            setTargetCount(next);
                          }}
                          disabled={targetCount !== null && targetCount >= stepperMax}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "transparent", border: "none",
                            color: targetCount !== null && targetCount >= stepperMax ? "#333" : "#c8a96e",
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

                  <button onClick={handleAnalyze} style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "#c8a96e", border: "none", borderRadius: 10,
                    padding: "13px 28px", color: "#000",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    letterSpacing: "0.02em", fontFamily: "inherit",
                  }}>
                    <Sparkles size={15} /> Generate Suggestion
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── LOADING ── */}
          {phase === "loading" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Loader2
                size={38} color="#c8a96e"
                style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px", display: "block" }}
              />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
                {variationRef.current > 0 ? "Finding a different angle..." : "Analyzing your photos..."}
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                Claude is picking the best sequence
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
                <strong style={{ display: "block", marginBottom: 4 }}>Error</strong>
                {errorMsg}
              </div>
              <button onClick={handleAnalyze} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
                padding: "12px 20px", color: "#c8a96e",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                <RefreshCcw size={14} /> Try Again
              </button>
            </div>
          )}

          {/* ── RESULT ── */}
          {phase === "result" && cluster && (
            <div>
              {/* Dump preview card */}
              <div style={{
                background: "rgba(200,169,110,0.05)", border: "1px solid rgba(200,169,110,0.2)",
                borderRadius: 14, padding: "18px 18px 14px", marginBottom: 20,
              }}>
                {/* Name + count */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#c8a96e", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                    {cluster.name}
                  </div>
                  <div style={{
                    background: "rgba(200,169,110,0.15)", borderRadius: 20,
                    padding: "3px 10px", fontSize: 11, fontWeight: 700,
                    color: "#c8a96e", letterSpacing: "0.04em", flexShrink: 0, marginLeft: 12,
                  }}>
                    {clusterPhotos.length} photos
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
                  {cluster.subtitle}
                </div>

                {/* Photo strip */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {clusterPhotos.map((p, i) => (
                    <div key={p.id} style={{
                      position: "relative", flexShrink: 0,
                      width: 72, height: 90, borderRadius: 8, overflow: "hidden", background: "#1a1a1a",
                    }}>
                      <img src={p.url} alt={p.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{
                        position: "absolute", top: 4, left: 4,
                        background: "rgba(0,0,0,0.7)", borderRadius: 3,
                        fontSize: 8, fontWeight: 700, color: "#fff",
                        padding: "1px 5px", letterSpacing: "0.08em",
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleNewSuggestion} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
                  padding: "12px 16px", color: "#999",
                  fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#ccc"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#999"; }}
                >
                  <RefreshCcw size={14} /> New Suggestion
                </button>
                <button onClick={handleCreate} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: "#c8a96e", border: "none", borderRadius: 10,
                  padding: "12px 20px", color: "#000",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  letterSpacing: "0.02em",
                }}>
                  <Plus size={16} /> Create Dump
                </button>
              </div>

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
