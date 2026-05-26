/**
 * WelcomeOverlay — first-time guest onboarding.
 * Full-screen welcome screen that explains what Dumpster does,
 * shows key features, and lets the user start with demo photos
 * or upload their own.
 * Shows once per device (localStorage flag).
 */
import { useState, useEffect } from "react";
import { Sparkles, ArrowUpDown, Type, Upload, X, ChevronRight, Share, Bell, Recycle } from "lucide-react";
import { IS_OWNER } from "@/lib/photoData";

var SEEN_KEY = "dumpster_welcome_seen_v1";

interface WelcomeOverlayProps {
  onUploadClick: () => void;
  onTourClick: () => void;
}

export default function WelcomeOverlay({ onUploadClick, onTourClick }: WelcomeOverlayProps) {
  var [visible, setVisible] = useState(false);
  var [leaving, setLeaving] = useState(false);

  useEffect(function() {
    // Never show for owner
    if (IS_OWNER) return;
    try {
      var seen = localStorage.getItem(SEEN_KEY);
      if (!seen) setVisible(true);
    } catch (_) {
      setVisible(true);
    }
  }, []);

  var dismiss = function() {
    setLeaving(true);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (_) { /* noop */ }
    setTimeout(function() { setVisible(false); }, 350);
  };

  var handleUpload = function() {
    dismiss();
    // Small delay so overlay fades before scroll
    setTimeout(function() { onUploadClick(); }, 400);
  };

  if (!visible) return null;

  var features = [
    {
      icon: Sparkles,
      title: "Auto Gen",
      desc: "Auto-group your photos into the strongest carousels — works offline too",
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.1)",
      border: "rgba(167,139,250,0.25)",
    },
    {
      icon: Bell,
      title: "Valet",
      desc: "Chat to reorder, swap shots, and set the vibe",
      color: "var(--accent)",
      bg: "rgba(var(--accent-rgb),0.1)",
      border: "rgba(var(--accent-rgb),0.25)",
    },
    {
      icon: Type,
      title: "Smart Captions",
      desc: "Generate captions that match your vibe and voice",
      color: "#4ade80",
      bg: "rgba(74,222,128,0.1)",
      border: "rgba(74,222,128,0.25)",
    },
    {
      icon: Recycle,
      title: "AI Recycle",
      desc: "Find better substitutes from your pool with one tap",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.25)",
    },
    {
      icon: ArrowUpDown,
      title: "Drag & Reorder",
      desc: "Manually arrange your carousel by dragging photos",
      color: "#9ca3af",
      bg: "rgba(156,163,175,0.1)",
      border: "rgba(156,163,175,0.25)",
    },
  ];

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.88)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
      opacity: leaving ? 0 : 1,
      transition: "opacity 0.35s ease",
    }}>
      {/* Close button — pushed below notch/dynamic island */}
      <button
        onClick={dismiss}
        style={{
          position: "absolute", top: "calc(env(safe-area-inset-top, 12px) + 12px)", right: 20, zIndex: 2,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#888", transition: "all 0.15s",
        }}
      >
        <X size={16} />
      </button>

      {/* Card */}
      <div style={{
        maxWidth: 420, width: "100%",
        background: "#0e0e0e", border: "1px solid #1e1e1e",
        borderRadius: 20, overflow: "hidden",
        maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 48px)",
        overflowY: "auto",
        transform: leaving ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.35s ease",
      }}>
        {/* Top accent bar */}
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, var(--accent), #a78bfa, #4ade80)",
        }} />

        {/* Content */}
        <div style={{ padding: "36px 28px 28px" }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(var(--accent-rgb),0.1)",
            border: "1px solid rgba(var(--accent-rgb),0.25)",
            borderRadius: 100, padding: "4px 12px 4px 8px",
            marginBottom: 20,
          }}>
            <Sparkles size={12} color="var(--accent)" />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--accent)", textTransform: "uppercase" as const }}>
              DEMO MODE
            </span>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.15,
            color: "#fff", marginBottom: 10,
          }}>
            {"Build your perfect "}
            <span style={{ color: "var(--accent)" }}>Instagram carousel</span>
          </h2>

          <p style={{
            fontSize: 14, color: "#777", lineHeight: 1.7, marginBottom: 28,
          }}>
            Dumpster helps you sequence photos, generate captions, and craft carousels that tell a story. Explore with demo photos below.
          </p>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {features.map(function(f) {
              return (
                <div key={f.title} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#141414", border: "1px solid #1e1e1e",
                  borderRadius: 12, padding: "12px 14px",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: f.bg, border: "1px solid " + f.border,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <f.icon size={16} color={f.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e8e8", letterSpacing: "-0.01em" }}>
                      {f.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 1 }}>
                      {f.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isIOS && !isStandalone && (
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
                borderRadius: 12, padding: "12px", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Share size={16} color="#007aff" />
                </div>
                <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
                  Tap <span style={{ color: "#fff", fontWeight: 600 }}>Share</span> then <span style={{ color: "#fff", fontWeight: 600 }}>"Add to Home Screen"</span> for the full native experience.
                </div>
              </div>
            )}
            <button
              onClick={handleUpload}
              style={{
                width: "100%", padding: "14px 20px",
                background: "var(--accent)", color: "#000",
                border: "none", borderRadius: 12,
                fontSize: 14, fontWeight: 800, fontFamily: "inherit",
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                letterSpacing: "0.02em",
              }}
            >
              <Upload size={16} strokeWidth={2.5} />
              Upload Your Photos
            </button>
            <button
              onClick={function() { dismiss(); setTimeout(onTourClick, 450); }}
              style={{
                width: "100%", padding: "13px 20px",
                background: "transparent", color: "#e8e8e8",
                border: "1px solid #2a2a2a", borderRadius: 12,
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              Take a Quick Tour
              <ChevronRight size={16} strokeWidth={3} />
            </button>
            <button
              onClick={dismiss}
              style={{
                width: "100%", padding: "12px 20px",
                background: "transparent", color: "#666",
                border: "none", borderRadius: 12,
                fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              Explore on My Own
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
