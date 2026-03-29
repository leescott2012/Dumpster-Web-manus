/*
 * OnboardingHint — Shows gesture instructions on first visit
 * Fades out after 5 seconds or on tap
 */
import { useState, useEffect } from "react";

export default function OnboardingHint() {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(0);
      setTimeout(() => setVisible(false), 500);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      onClick={() => {
        setOpacity(0);
        setTimeout(() => setVisible(false), 300);
      }}
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#151515",
        border: "1px solid #2a2a2a",
        borderRadius: "12px",
        padding: "16px 24px",
        zIndex: 5000,
        maxWidth: "340px",
        width: "calc(100% - 48px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        opacity,
        transition: "opacity 0.5s ease-out",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          color: "#c8a96e",
          marginBottom: "10px",
        }}
      >
        HOW TO USE
      </div>
      <div style={{ fontSize: "13px", color: "#999", lineHeight: 1.6 }}>
        <div style={{ marginBottom: "6px" }}>
          <strong style={{ color: "#e8e8e8" }}>Swipe</strong> to browse photos in each dump
        </div>
        <div style={{ marginBottom: "6px" }}>
          <strong style={{ color: "#e8e8e8" }}>Long press</strong> to pick up a photo, then drag to reorder or move between dumps
        </div>
        <div style={{ marginBottom: "6px" }}>
          <strong style={{ color: "#e8e8e8" }}>Double tap</strong> to view photo larger
        </div>
        <div>
          <strong style={{ color: "#e8e8e8" }}>Hold &amp; release</strong> for options (remove, mark Huji)
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
        Tap to dismiss · Changes reset on refresh
      </div>
    </div>
  );
}
