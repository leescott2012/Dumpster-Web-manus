/**
 * CaptionSheet — Generate Instagram captions for any dump using Claude.
 * Mirrors iOS CaptionService / LLMService.generateCaption flow.
 */
import { useState, useCallback, useEffect } from "react";
import { getAuthHeaders } from "@/lib/supabase";
import { Type, X, Copy, RefreshCcw, Loader2, Check, Sparkles } from "lucide-react";
import type { Dump } from "@/lib/photoData";
import { buildTasteBlock } from "@/lib/captionPool";
import { compressDataUrlForVision } from "@/lib/imageDownscale";

interface CaptionSheetProps {
  open: boolean;
  onClose: () => void;
  dumps: Dump[];
  initialDumpId?: string | null;
  onCaptionsGenerated: (dumpId: string, captions: string[], vibe: string) => void;
}

type Tone = "default" | "minimal" | "witty" | "poetic";

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "default", label: "Aesthetic", hint: "On-brand, scroll-stopping" },
  { value: "minimal", label: "Minimal",   hint: "One line, no fluff" },
  { value: "witty",   label: "Witty",     hint: "Clever, wordplay" },
  { value: "poetic",  label: "Poetic",    hint: "Evocative, imagery" },
];

export default function CaptionSheet({
  open, onClose, dumps, initialDumpId, onCaptionsGenerated,
}: CaptionSheetProps) {
  const [selectedDumpId, setSelectedDumpId] = useState<string | null>(initialDumpId ?? null);
  const [tone, setTone] = useState<Tone>("default");
  const [phase, setPhase] = useState<"picker" | "loading" | "result" | "error">("picker");
  const [captions, setCaptions] = useState<string[]>([]);
  const [vibe, setVibe] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [tasteActive, setTasteActive] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [categoryOverride, setCategoryOverride] = useState("");

  // When the sheet opens, pre-select the deep-linked dump if any
  useEffect(() => {
    if (open) {
      const startDumpId = initialDumpId ?? (dumps[0]?.id ?? null);
      setSelectedDumpId(startDumpId);
      setPhase("picker");
      setCaptions([]);
      setVibe("");
      setErrorMsg("");
      setUserPrompt("");
      setTasteActive(Boolean(buildTasteBlock()));
    }
  }, [open, initialDumpId, dumps]);

  const selectedDump = dumps.find(d => d.id === selectedDumpId) || null;

  // Re-seed override fields whenever the selected dump changes — but only if
  // the user hasn't already typed something into them this session.
  useEffect(() => {
    if (!selectedDump) return;
    setTitleOverride(selectedDump.title || "");
    setCategoryOverride(selectedDump.photos[0]?.category || "");
  }, [selectedDumpId, selectedDump]);

  const generate = useCallback(async () => {
    if (!selectedDump) return;
    setPhase("loading");
    setErrorMsg("");

    try {
      var authH = await getAuthHeaders();
      // Compress any data-URL photos so the request fits Vercel's 4.5MB cap
      const compressedPhotos = await Promise.all(
        selectedDump.photos.slice(0, 12).map(async (p) => ({
          id: p.id,
          url: await compressDataUrlForVision(p.url),
        }))
      );
      const res = await fetch("/api/ai-caption", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authH),
        body: JSON.stringify({
          photos: compressedPhotos,
          userPrompt: userPrompt.trim() || undefined,
          dumpTitle: titleOverride.trim() || selectedDump.title,
          subtitle: selectedDump.subtitle,
          category: categoryOverride.trim() || selectedDump.photos[0]?.category,
          tone,
          tasteBlock: buildTasteBlock(),
        }),
      });
      // Read as text first — Vercel returns plain text for infra errors (e.g. 413).
      const rawText = await res.text();
      let data: { captions?: string[]; vibe?: string; error?: string };
      try {
        data = JSON.parse(rawText);
      } catch {
        if (res.status === 413 || /entity too large/i.test(rawText)) {
          setErrorMsg("Photos add up to too much data. Try a dump with fewer photos.");
        } else {
          setErrorMsg(rawText.slice(0, 200) || `Server returned ${res.status}`);
        }
        setPhase("error");
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong");
        setPhase("error");
        return;
      }
      const caps: string[] = data.captions || [];
      const vibeStr: string = data.vibe || "curated";
      setCaptions(caps);
      setVibe(vibeStr);
      onCaptionsGenerated(selectedDump.id, caps, vibeStr);
      setPhase("result");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error");
      setPhase("error");
    }
  }, [selectedDump, tone, onCaptionsGenerated, userPrompt, titleOverride, categoryOverride]);

  const handleCopy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      // fallback ignored
    }
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setPhase("picker");
      setCaptions([]);
      setVibe("");
      setErrorMsg("");
    }, 300);
  }, [onClose]);

  if (!open) return null;

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
        maxHeight: "85vh", display: "flex", flexDirection: "column",
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
              background: "rgba(110,142,200,0.12)", border: "1px solid rgba(110,142,200,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Type size={16} color="#6E8EC8" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                AI Captions
              </div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>
                Claude Haiku
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
          {dumps.length === 0 && (
            <div style={{ padding: "32px 18px", textAlign: "center", color: "#666", fontSize: 13 }}>
              Create a dump first, then come back to caption it.
            </div>
          )}

          {dumps.length > 0 && phase === "picker" && (
            <>
              {/* Dump picker */}
              <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>
                Choose a dump
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {dumps.map(d => {
                  const active = selectedDumpId === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDumpId(d.id)}
                      style={{
                        textAlign: "left", cursor: "pointer",
                        background: active ? "rgba(var(--accent-rgb),0.08)" : "#141414",
                        border: active ? "1px solid rgba(var(--accent-rgb),0.35)" : "1px solid #1e1e1e",
                        borderRadius: 12, padding: "12px 14px",
                        display: "flex", alignItems: "center", gap: 12,
                        fontFamily: "inherit", transition: "all 0.15s",
                      }}
                    >
                      {/* Photo strip mini */}
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        {d.photos.slice(0, 3).map(p => (
                          <div key={p.id} style={{ width: 24, height: 30, borderRadius: 3, overflow: "hidden", background: "#222" }}>
                            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: active ? "var(--accent)" : "#e8e8e8", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.photos.length} photos {d.captions ? "· captions saved" : ""}
                        </div>
                      </div>
                      {active && (
                        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Check size={10} color="#000" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Prompt textarea — the main user input */}
              <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>
                What's the caption about? <span style={{ color: "#444", textTransform: "none" as const, letterSpacing: 0 }}>(optional)</span>
              </div>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Tell Claude the mood, the joke, the story — or leave blank to let the photos speak."
                rows={3}
                style={{
                  width: "100%", background: "#141414", border: "1px solid #1e1e1e",
                  borderRadius: 10, padding: "10px 12px", marginBottom: 20,
                  color: "#e8e8e8", fontSize: 13, fontFamily: "inherit",
                  resize: "vertical" as const, outline: "none", lineHeight: 1.5,
                  boxSizing: "border-box" as const,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(110,142,200,0.4)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; }}
              />

              {/* Editable title + category — collapsed by default to keep sheet clean */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
                    Title
                  </div>
                  <input
                    value={titleOverride}
                    onChange={(e) => setTitleOverride(e.target.value)}
                    placeholder={selectedDump?.title || "Dump title"}
                    style={{
                      width: "100%", background: "#141414", border: "1px solid #1e1e1e",
                      borderRadius: 8, padding: "8px 10px",
                      color: "#e8e8e8", fontSize: 12, fontFamily: "inherit",
                      outline: "none", boxSizing: "border-box" as const,
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>
                    Category
                  </div>
                  <input
                    value={categoryOverride}
                    onChange={(e) => setCategoryOverride(e.target.value)}
                    placeholder={selectedDump?.photos[0]?.category || "e.g. fashion, food"}
                    style={{
                      width: "100%", background: "#141414", border: "1px solid #1e1e1e",
                      borderRadius: 8, padding: "8px 10px",
                      color: "#e8e8e8", fontSize: 12, fontFamily: "inherit",
                      outline: "none", boxSizing: "border-box" as const,
                    }}
                  />
                </div>
              </div>

              {/* Tone selector */}
              <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>
                Tone
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 24 }}>
                {TONES.map(t => {
                  const active = tone === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      style={{
                        cursor: "pointer", textAlign: "left",
                        background: active ? "rgba(110,142,200,0.1)" : "#141414",
                        border: active ? "1px solid rgba(110,142,200,0.4)" : "1px solid #1e1e1e",
                        borderRadius: 10, padding: "10px 12px",
                        fontFamily: "inherit", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: active ? "#6E8EC8" : "#e8e8e8", letterSpacing: "0.02em" }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                        {t.hint}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Taste active indicator */}
              {tasteActive && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "rgba(110,142,200,0.08)", border: "1px solid rgba(110,142,200,0.25)",
                  borderRadius: 100, padding: "5px 12px", marginBottom: 12,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#6E8EC8", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#6E8EC8", letterSpacing: "0.1em" }}>
                    TASTE PROFILE ACTIVE
                  </span>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={!selectedDump}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: selectedDump ? "var(--accent)" : "#1a1a1a",
                  border: "none", borderRadius: 10,
                  padding: "13px 28px",
                  color: selectedDump ? "#000" : "#444",
                  fontSize: 14, fontWeight: 700, cursor: selectedDump ? "pointer" : "not-allowed",
                  letterSpacing: "0.02em", fontFamily: "inherit",
                }}
              >
                <Sparkles size={15} /> Generate Captions
              </button>
            </>
          )}

          {phase === "loading" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Loader2 size={38} color="var(--accent)" style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px", display: "block" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
                Writing captions...
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                Claude is finding the right voice for "{selectedDump?.title}"
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

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
              <button onClick={generate} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
                padding: "12px 20px", color: "var(--accent)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                <RefreshCcw size={14} /> Try Again
              </button>
            </div>
          )}

          {phase === "result" && (
            <div>
              {/* Vibe label */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(110,142,200,0.1)", border: "1px solid rgba(110,142,200,0.25)",
                borderRadius: 100, padding: "5px 12px", marginBottom: 16,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6E8EC8" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#6E8EC8", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                  Vibe · {vibe}
                </span>
              </div>

              {/* Captions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {captions.map((cap, i) => (
                  <div key={i} style={{
                    background: "#141414", border: "1px solid #1e1e1e",
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", alignItems: "flex-start", gap: 12,
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: "#1a1a1a", border: "1px solid #2a2a2a",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "#888", flexShrink: 0, marginTop: 1,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, fontSize: 14, lineHeight: 1.55, color: "#e8e8e8" }}>
                      {cap}
                    </div>
                    <button
                      onClick={() => handleCopy(cap, i)}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: copiedIdx === i ? "#22c55e" : "#666",
                        padding: 4, display: "flex", alignItems: "center", flexShrink: 0,
                        transition: "color 0.15s",
                      }}
                      title="Copy"
                    >
                      {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setPhase("picker")}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
                    padding: "12px 16px", color: "#888",
                    fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Pick Another Dump
                </button>
                <button
                  onClick={generate}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 10,
                    padding: "12px 16px", color: "var(--accent)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <RefreshCcw size={14} /> Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
