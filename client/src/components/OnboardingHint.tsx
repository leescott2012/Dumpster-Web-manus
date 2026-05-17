/*
 * OnboardingHint — Shows gesture instructions on first visit
 * Dismissible, stored in localStorage
 */
import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function OnboardingHint() {
  var [visible, setVisible] = useState(false);

  useEffect(function() {
    try {
      var dismissed = localStorage.getItem("carousel-hint-dismissed-v4");
      if (!dismissed) setVisible(true);
    } catch (_) {
      setVisible(true);
    }
  }, []);

  var handleDismiss = function() {
    setVisible(false);
    try { localStorage.setItem("carousel-hint-dismissed-v4", "1"); } catch (_) { /* noop */ }
  };

  if (!visible) return null;

  return (
    <div
      className="onboarding-hint-enter"
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "14px",
        padding: "16px 20px",
        maxWidth: "380px",
        width: "calc(100% - 32px)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}
    >
      <button
        onClick={handleDismiss}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "transparent",
          border: "none",
          color: "#666",
          cursor: "pointer",
          padding: "4px",
        }}
      >
        <X size={14} />
      </button>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", letterSpacing: "0.15em", marginBottom: "10px", textTransform: "uppercase" as const }}>
        How to Use
      </div>
      <div style={{ fontSize: "12px", color: "#999", lineHeight: 1.7 }}>
        <div style={{ marginBottom: "6px" }}>
          <strong style={{ color: "#e8e8e8" }}>Tap</strong> a photo to select it, then tap the <strong style={{ color: "var(--accent)" }}>...</strong> dots for options
        </div>
        <div style={{ marginBottom: "6px" }}>
          <strong style={{ color: "#e8e8e8" }}>Double tap</strong> to view a photo larger
        </div>
        <div style={{ marginBottom: "6px" }}>
          <strong style={{ color: "#e8e8e8" }}>Hold + drag</strong> to rearrange photos between dumps
        </div>
        <div>
          Tap the <strong style={{ color: "var(--accent)" }}>+</strong> card at the end of a dump to add photos from the pool
        </div>
      </div>
      <div
        style={{
          fontSize: "10px",
          color: "#666",
          marginTop: "10px",
          textAlign: "center",
        }}
      >
        Tap X to dismiss
      </div>
    </div>
  );
}
