/**
 * IGScrubSheet — paste Instagram post URLs or any image URLs,
 * preview what was found, then add selected items to the pool.
 */
import { useState, useCallback } from "react";
import { X, Instagram, Search, Plus, Check, AlertCircle, Loader } from "lucide-react";
import type { Photo } from "@/lib/photoData";
import { nanoid } from "nanoid";

interface ScrubResult {
  src: string;
  category: "Image" | "Video";
}

interface IGScrubSheetProps {
  open: boolean;
  onClose: () => void;
  onAddToPool: (photos: Photo[]) => void;
}

export default function IGScrubSheet({ open, onClose, onAddToPool }: IGScrubSheetProps) {
  var [urlText, setUrlText] = useState("");
  var [loading, setLoading] = useState(false);
  var [results, setResults] = useState<ScrubResult[]>([]);
  var [failedUrls, setFailedUrls] = useState<string[]>([]);
  var [selected, setSelected] = useState<Set<number>>(new Set());
  var [phase, setPhase] = useState<"input" | "preview">("input");
  var [error, setError] = useState<string | null>(null);

  var handleScrub = useCallback(async function() {
    var lines = urlText.split(/[\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean);
    if (lines.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      var res = await fetch("/api/ig-scrub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: lines }),
      });
      if (!res.ok) throw new Error("Server error " + res.status);
      var data = await res.json() as { results: ScrubResult[]; errors: string[] };
      if (data.results.length === 0) {
        var errMsg = data.errors && data.errors.length > 0 ? data.errors[0] : "";
        if (errMsg.includes("APIFY_TOKEN")) {
          setError("APIFY_TOKEN is not set — add it as an environment variable in your Vercel project dashboard, then redeploy.");
        } else {
          setError("No images found. Make sure the posts are public and the URLs are valid instagram.com/p/… or /reel/… links." + (errMsg ? " (" + errMsg + ")" : ""));
        }
      } else {
        setResults(data.results);
        setFailedUrls(data.errors || []);
        setSelected(new Set(data.results.map(function(_, i) { return i; }))); // select all by default
        setPhase("preview");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error — try again");
    } finally {
      setLoading(false);
    }
  }, [urlText]);

  var handleToggle = function(i: number) {
    setSelected(function(prev) {
      var next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  var handleAddToPool = function() {
    var photos: Photo[] = [];
    selected.forEach(function(i) {
      var r = results[i];
      photos.push({
        id: "ig-" + nanoid(8),
        url: r.src,
        alt: "Scraped image",
        isFavorite: false,
        category: r.category,
      });
    });
    if (photos.length > 0) onAddToPool(photos);
    // reset
    setPhase("input");
    setUrlText("");
    setResults([]);
    setSelected(new Set());
    setFailedUrls([]);
    onClose();
  };

  var handleBack = function() {
    setPhase("input");
    setResults([]);
    setSelected(new Set());
    setFailedUrls([]);
    setError(null);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)", zIndex: 430,
      }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 431,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
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
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "rgba(200,169,110,0.1)", border: "1px solid rgba(200,169,110,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#c8a96e",
            }}>
              <Instagram size={17} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                {phase === "preview" ? results.length + " found — pick to add" : "Instagram Scrub"}
              </div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
                {phase === "preview" ? selected.size + " selected" : "paste URLs · one per line"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#666",
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {phase === "input" && (
            <>
              {/* Tips */}
              <div style={{
                background: "rgba(200,169,110,0.06)", border: "1px solid rgba(200,169,110,0.15)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 18,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#c8a96e", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                  Powered by Apify
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                  <div>• Paste <b style={{ color: "#aaa" }}>Instagram post URLs</b> (instagram.com/p/… or /reel/…) — Apify scrapes them server-side</div>
                  <div>• Carousel posts return all slides automatically</div>
                  <div>• <b style={{ color: "#aaa" }}>Direct image URLs</b> are passed through instantly without Apify</div>
                  <div>• Paste multiple URLs — one per line or comma-separated</div>
                </div>
              </div>

              {/* URL input */}
              <textarea
                value={urlText}
                onChange={function(e) { setUrlText(e.target.value); setError(null); }}
                placeholder={"https://www.instagram.com/p/ABC123/\nhttps://scontent-sjc3-1.cdninstagram.com/v/…"}
                style={{
                  width: "100%", minHeight: 140, resize: "vertical",
                  background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
                  padding: "12px 14px", fontSize: 12, color: "#e8e8e8",
                  fontFamily: "inherit", lineHeight: 1.6, outline: "none",
                  boxSizing: "border-box" as const,
                }}
                onFocus={function(e) { e.currentTarget.style.borderColor = "rgba(200,169,110,0.4)"; }}
                onBlur={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
                autoFocus
              />

              {error && (
                <div style={{
                  marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8,
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8, padding: "10px 12px",
                }}>
                  <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>{error}</div>
                </div>
              )}

              <button
                onClick={handleScrub}
                disabled={loading || urlText.trim().length === 0}
                style={{
                  marginTop: 16, width: "100%",
                  background: loading || !urlText.trim() ? "#1a1a1a" : "rgba(200,169,110,0.12)",
                  border: "1px solid " + (loading || !urlText.trim() ? "#2a2a2a" : "rgba(200,169,110,0.35)"),
                  borderRadius: 12, padding: "14px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  color: loading || !urlText.trim() ? "#444" : "#c8a96e",
                  fontSize: 14, fontWeight: 700, cursor: loading || !urlText.trim() ? "not-allowed" : "pointer",
                  fontFamily: "inherit", letterSpacing: "0.04em", transition: "all 0.2s",
                }}
              >
                {loading
                  ? <><Loader size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Apify is scrubbing… (up to 45s)</>
                  : <><Search size={15} /> Scrub with Apify</>
                }
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          )}

          {phase === "preview" && (
            <>
              {/* Failed URLs notice */}
              {failedUrls.length > 0 && (
                <div style={{
                  marginBottom: 16,
                  background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                  borderRadius: 8, padding: "10px 12px",
                  display: "flex", gap: 8, alignItems: "flex-start",
                }}>
                  <AlertCircle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 11, color: "#ef4444", lineHeight: 1.55 }}>
                    {failedUrls.length} URL{failedUrls.length > 1 ? "s" : ""} couldn't be scraped (Instagram may have blocked the request). Try direct image URLs instead.
                  </div>
                </div>
              )}

              {/* Select all / none */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  onClick={function() { setSelected(new Set(results.map(function(_, i) { return i; }))); }}
                  style={{ background: "transparent", border: "1px solid #2a2a2a", borderRadius: 100, padding: "4px 12px", fontSize: 11, color: "#999", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Select all
                </button>
                <button
                  onClick={function() { setSelected(new Set()); }}
                  style={{ background: "transparent", border: "1px solid #2a2a2a", borderRadius: 100, padding: "4px 12px", fontSize: 11, color: "#999", cursor: "pointer", fontFamily: "inherit" }}
                >
                  None
                </button>
                <button
                  onClick={handleBack}
                  style={{ background: "transparent", border: "1px solid #2a2a2a", borderRadius: 100, padding: "4px 12px", fontSize: 11, color: "#666", cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}
                >
                  ← Back
                </button>
              </div>

              {/* Image grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10,
              }}>
                {results.map(function(r, i) {
                  var isSelected = selected.has(i);
                  return (
                    <div
                      key={i}
                      onClick={function() { handleToggle(i); }}
                      style={{
                        position: "relative", cursor: "pointer", borderRadius: 10, overflow: "hidden",
                        border: "2px solid " + (isSelected ? "#c8a96e" : "#2a2a2a"),
                        transition: "border-color 0.15s",
                        aspectRatio: "3/4",
                      }}
                    >
                      <img
                        src={r.src} alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={function(e) { (e.currentTarget as HTMLImageElement).style.background = "#1a1a1a"; }}
                      />
                      {r.category === "Video" && (
                        <div style={{
                          position: "absolute", top: 6, left: 6,
                          background: "rgba(0,0,0,0.7)", borderRadius: 4,
                          padding: "2px 6px", fontSize: 9, fontWeight: 700,
                          color: "#fff", letterSpacing: "0.06em",
                        }}>VIDEO</div>
                      )}
                      {isSelected && (
                        <div style={{
                          position: "absolute", top: 6, right: 6,
                          width: 22, height: 22, borderRadius: "50%",
                          background: "#c8a96e", display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <Check size={13} color="#000" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — Add to Pool */}
        {phase === "preview" && selected.size > 0 && (
          <div style={{ padding: "16px 24px 40px", borderTop: "1px solid #1a1a1a", flexShrink: 0 }}>
            <button
              onClick={handleAddToPool}
              style={{
                width: "100%", background: "#c8a96e", color: "#000",
                border: "none", borderRadius: 12, padding: "14px",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", letterSpacing: "0.04em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 8px 24px rgba(200,169,110,0.25)",
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              {"Add " + selected.size + " to Pool"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
