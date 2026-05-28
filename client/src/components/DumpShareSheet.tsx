/**
 * DumpShareSheet — Export / Share a dump for Instagram
 * - Numbered photo grid (carousel order)
 * - Download all photos (fetch→blob, fallback: open in tab)
 * - Copy caption (if captions were generated)
 * - Web Share API on mobile (shares caption text + images if browser supports)
 */
import { useState, useCallback } from "react";
import {
  X, Download, Copy, Check, Share2, ExternalLink, Loader2,
} from "lucide-react";
import type { Dump } from "@/lib/photoData";
import { track } from "@/lib/analytics";

interface DumpShareSheetProps {
  dump: Dump | null;
  open: boolean;
  onClose: () => void;
}

// iOS Safari sends `<a download>` to the Files app, not Photos. The Web Share
// API with a File payload pops the system share sheet — which includes
// "Save Image" → Photos library. That's the UX beta testers expected.
function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  var ua = navigator.userAgent;
  // iPad reports as Mac in modern iOS — also check for touch.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

async function urlToFile(url: string, filename: string): Promise<File | null> {
  try {
    var res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    var blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

/** Force a classic download — used on desktop where Files isn't a concern. */
function triggerDownload(blob: Blob, filename: string) {
  var blobUrl = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

async function downloadPhoto(url: string, filename: string): Promise<boolean> {
  try {
    // iOS path: share sheet → Save Image goes to Photos library.
    if (isIos() && typeof navigator !== "undefined" && typeof navigator.share === "function") {
      var file = await urlToFile(url, filename);
      if (file && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ files: [file] });
          return true;
        } catch (err) {
          // User cancelled — don't fall back to download (would be annoying).
          if (err instanceof Error && err.name === "AbortError") return false;
          // Other errors (e.g. permission denied) — fall through to download.
        }
      }
    }

    // Desktop / Android / fallback: classic download.
    var res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    var blob = await res.blob();
    triggerDownload(blob, filename);
    return true;
  } catch {
    // Last resort — open in new tab so user can long-press save on mobile.
    window.open(url, "_blank", "noopener");
    return false;
  }
}

/**
 * Share multiple files at once. iOS share sheet supports multi-image saves to
 * Photos in a single tap. Returns true if the share succeeded (or user picked
 * a destination), false on cancel / unsupported.
 */
async function sharePhotosBulk(urls: string[], filenamePrefix: string): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;

  var files: File[] = [];
  for (var i = 0; i < urls.length; i++) {
    var num = String(i + 1).padStart(2, "0");
    var f = await urlToFile(urls[i], filenamePrefix + "_" + num + ".jpg");
    if (f) files.push(f);
  }
  if (files.length === 0) return false;
  if (navigator.canShare && !navigator.canShare({ files: files })) return false;

  try {
    await navigator.share({ files: files });
    return true;
  } catch {
    return false;
  }
}

export default function DumpShareSheet({ dump, open, onClose }: DumpShareSheetProps) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const canWebShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const onIos = isIos();

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setCopiedIdx(null);
      setDownloading(false);
      setDownloadedIds(new Set());
    }, 300);
  }, [onClose]);

  const handleCopy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { /* ignore */ }
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (!dump) return;
    setDownloading(true);
    const prefix = dump.title.replace(/\s+/g, "_");

    // iOS: one share-sheet call with all photos → user picks "Save to Photos"
    // once and gets the whole carousel into their library.
    if (isIos() && typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const ok = await sharePhotosBulk(dump.photos.map(p => p.url), prefix);
      if (ok) {
        setDownloadedIds(new Set(dump.photos.map(p => p.id)));
        track("dump_exported", { photo_count: dump.photos.length });
      }
      setDownloading(false);
      return;
    }

    // Desktop / Android: classic per-file download with delay between.
    for (let i = 0; i < dump.photos.length; i++) {
      const p = dump.photos[i];
      const num = String(i + 1).padStart(2, "0");
      await downloadPhoto(p.url, `${prefix}_${num}.jpg`);
      setDownloadedIds(prev => new Set(prev).add(p.id));
      if (i < dump.photos.length - 1) await new Promise(r => setTimeout(r, 300));
    }
    track("dump_exported", { photo_count: dump.photos.length });
    setDownloading(false);
  }, [dump]);

  const handleDownloadOne = useCallback(async (url: string, id: string, idx: number) => {
    if (!dump) return;
    const num = String(idx + 1).padStart(2, "0");
    await downloadPhoto(url, `${dump.title.replace(/\s+/g, "_")}_${num}.jpg`);
    setDownloadedIds(prev => new Set(prev).add(id));
  }, [dump]);

  const handleWebShare = useCallback(async () => {
    if (!dump || !canWebShare) return;
    const text = dump.captions && dump.captions.length > 0
      ? dump.captions[0]
      : dump.title + (dump.subtitle ? "\n" + dump.subtitle : "");
    try {
      await navigator.share({ title: dump.title, text });
    } catch { /* user cancelled or not supported */ }
  }, [dump, canWebShare]);

  if (!open || !dump) return null;

  const hasCaptions = dump.captions && dump.captions.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.78)", zIndex: 420,
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 421,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Handle */}
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
              <Share2 size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                {dump.title}
              </div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>
                {dump.photos.length} photos · Export for Instagram
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
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px" }}>

          {/* Photo grid — numbered in carousel order */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#666",
            letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: 12,
          }}>
            Carousel Order · {dump.photos.length} slides
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))",
            gap: 8, marginBottom: 24,
          }}>
            {dump.photos.map((p, i) => {
              const done = downloadedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  style={{ position: "relative", cursor: "pointer" }}
                  onClick={() => handleDownloadOne(p.url, p.id, i)}
                  title={`Download slide ${i + 1}`}
                >
                  {/* Photo */}
                  <div style={{
                    aspectRatio: "4/5", borderRadius: 8, overflow: "hidden",
                    background: "#1a1a1a",
                    outline: done ? "2px solid #22c55e" : "none",
                    outlineOffset: 2,
                    transition: "outline 0.15s",
                  }}>
                    <img
                      src={p.url} alt={p.alt}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  {/* Slide number */}
                  <div style={{
                    position: "absolute", top: 4, left: 4,
                    background: "rgba(0,0,0,0.72)", borderRadius: 3,
                    fontSize: 8, fontWeight: 800, color: done ? "#22c55e" : "#fff",
                    padding: "1px 5px", letterSpacing: "0.08em",
                  }}>
                    {done ? "✓" : String(i + 1).padStart(2, "0")}
                  </div>
                  {/* Download icon overlay */}
                  <div style={{
                    position: "absolute", bottom: 4, right: 4,
                    background: "rgba(0,0,0,0.6)", borderRadius: 4,
                    width: 20, height: 20,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {done
                      ? <Check size={10} color="#22c55e" />
                      : <Download size={10} color="#999" />
                    }
                  </div>
                </div>
              );
            })}
          </div>

          {/* Download All */}
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: downloading ? "#111" : "#1a1a1a",
              border: "1px solid #2a2a2a", borderRadius: 10,
              padding: "13px 20px", color: downloading ? "#555" : "var(--accent)",
              fontSize: 13, fontWeight: 700, cursor: downloading ? "not-allowed" : "pointer",
              fontFamily: "inherit", letterSpacing: "0.04em",
              marginBottom: 20, transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!downloading) { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(var(--accent-rgb),0.06)"; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = downloading ? "#111" : "#1a1a1a"; }}
          >
            {downloading
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> {onIos ? "Preparing..." : "Downloading..."}</>
              : <><Download size={14} /> {onIos ? `Save All ${dump.photos.length} to Photos` : `Download All ${dump.photos.length} Photos`}</>
            }
          </button>

          {/* Captions section */}
          {hasCaptions && (
            <>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#666",
                letterSpacing: "0.12em", textTransform: "uppercase",
                marginBottom: 12,
              }}>
                {dump.vibe ? `Captions · ${dump.vibe}` : "Captions"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {dump.captions!.map((cap, i) => (
                  <div key={i} style={{
                    background: "#141414", border: "1px solid #1e1e1e",
                    borderRadius: 10, padding: "12px 14px",
                    display: "flex", alignItems: "flex-start", gap: 10,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#1a1a1a", border: "1px solid #2a2a2a",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: "#888",
                      flexShrink: 0, marginTop: 1,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{
                      flex: 1, fontSize: 13, lineHeight: 1.55,
                      color: "#e8e8e8", whiteSpace: "pre-wrap",
                    }}>
                      {cap}
                    </div>
                    <button
                      onClick={() => handleCopy(cap, i)}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: copiedIdx === i ? "#22c55e" : "#666",
                        padding: 4, display: "flex", alignItems: "center",
                        flexShrink: 0, transition: "color 0.15s",
                      }}
                      title="Copy caption"
                    >
                      {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* No captions hint */}
          {!hasCaptions && (
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.03)", border: "1px solid #1e1e1e",
              fontSize: 12, color: "#555", marginBottom: 20, lineHeight: 1.5,
            }}>
              No captions yet. Use <strong style={{ color: "#888" }}>AI Captions</strong> in the Main Menu to generate them.
            </div>
          )}

          {/* Web Share (mobile) / Open in new tab (desktop fallback) */}
          <div style={{ display: "flex", gap: 10 }}>
            {canWebShare && (
              <button
                onClick={handleWebShare}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  background: "var(--accent)", border: "none", borderRadius: 10,
                  padding: "13px 20px", color: "#000",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", letterSpacing: "0.04em",
                }}
              >
                <Share2 size={14} />
                {hasCaptions ? "Share Caption" : "Share Dump"}
              </button>
            )}
            <button
              onClick={() => window.open(dump.photos[0]?.url, "_blank", "noopener")}
              style={{
                flex: canWebShare ? 0 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
                padding: "13px 16px", color: "#888",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit",
              }}
              title="Open first photo in new tab"
            >
              <ExternalLink size={14} />
              {!canWebShare && "Open Photos"}
            </button>
          </div>

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </>
  );
}
