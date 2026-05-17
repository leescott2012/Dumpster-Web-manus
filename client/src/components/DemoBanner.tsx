/**
 * DemoBanner — persistent floating pill below navbar for demo/guest users.
 * Shows "Viewing demo photos" with CTA to upload their own.
 * Hides when user has uploaded photos or dismissed it.
 */
import { useState, useEffect } from "react";
import { Upload, X } from "lucide-react";
import { IS_OWNER } from "@/lib/photoData";

var DISMISSED_KEY = "dumpster_demo_banner_dismissed_v1";

interface DemoBannerProps {
  hasUserPhotos: boolean;
  onUploadClick: () => void;
}

export default function DemoBanner({ hasUserPhotos, onUploadClick }: DemoBannerProps) {
  var [visible, setVisible] = useState(false);

  useEffect(function() {
    if (IS_OWNER) return;
    if (hasUserPhotos) return;
    try {
      var dismissed = localStorage.getItem(DISMISSED_KEY);
      if (!dismissed) setVisible(true);
    } catch (_) {
      setVisible(true);
    }
  }, [hasUserPhotos]);

  // Auto-hide when user uploads photos
  useEffect(function() {
    if (hasUserPhotos) setVisible(false);
  }, [hasUserPhotos]);

  var handleDismiss = function(e: React.MouseEvent) {
    e.stopPropagation();
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch (_) { /* noop */ }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
      zIndex: 250,
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(14,14,14,0.92)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      border: "1px solid #2a2a2a",
      borderRadius: 100, padding: "6px 8px 6px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      animation: "demoBannerIn 0.4s ease",
    }}>
      {/* Dot */}
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "var(--accent)",
        boxShadow: "0 0 8px rgba(var(--accent-rgb),0.5)",
        flexShrink: 0,
      }} />

      {/* Label */}
      <span style={{
        fontSize: 11, fontWeight: 600, color: "#888",
        letterSpacing: "0.02em", whiteSpace: "nowrap",
      }}>
        Demo photos
      </span>

      {/* Divider */}
      <div style={{ width: 1, height: 14, background: "#2a2a2a", flexShrink: 0 }} />

      {/* Upload CTA */}
      <button
        onClick={onUploadClick}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(var(--accent-rgb),0.12)",
          border: "1px solid rgba(var(--accent-rgb),0.3)",
          borderRadius: 100, padding: "4px 12px 4px 8px",
          color: "var(--accent)", fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          transition: "all 0.15s", whiteSpace: "nowrap",
        }}
      >
        <Upload size={11} />
        Upload yours
      </button>

      {/* Close */}
      <button
        onClick={handleDismiss}
        style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#555", padding: 0,
          transition: "all 0.15s",
        }}
      >
        <X size={10} />
      </button>

      {/* Keyframe animation */}
      <style>
        {"@keyframes demoBannerIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }"}
      </style>
    </div>
  );
}
