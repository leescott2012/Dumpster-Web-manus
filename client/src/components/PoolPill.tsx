/**
 * PoolPill — Slidable pill switcher between Photos | Captions.
 * Ported from iOS MainAppView poolTabSwitcher / SlidableSegmentedControl.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Type } from "lucide-react";

export type PoolTab = "photos" | "captions";

interface PoolPillProps {
  active: PoolTab;
  onChange: (tab: PoolTab) => void;
  photoCount: number;
  captionCount: number;
}

export default function PoolPill({ active, onChange, photoCount, captionCount }: PoolPillProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      if (entries[0]) setWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const halfW = width / 2;
  const baseOffset = active === "photos" ? 0 : halfW;
  const pillOffset = baseOffset + dragOffset;

  // ── drag handlers ───────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartX.current == null) return;
    const dx = e.clientX - dragStartX.current;
    // Constrain so pill stays within container
    const maxOffset = active === "photos" ? halfW : 0;
    const minOffset = active === "photos" ? 0 : -halfW;
    setDragOffset(Math.max(minOffset, Math.min(maxOffset, dx)));
  }, [active, halfW]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragStartX.current == null) return;
    const finalOffset = baseOffset + dragOffset;
    const targetTab: PoolTab = finalOffset > halfW / 2 ? "captions" : "photos";
    if (targetTab !== active) onChange(targetTab);
    setDragOffset(0);
    setIsDragging(false);
    dragStartX.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }, [active, baseOffset, dragOffset, halfW, onChange]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 24px", padding: "0 32px" }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          background: "#141414",
          border: "1px solid #1e1e1e",
          borderRadius: 14,
          padding: 4,
          height: 48,
          display: "flex",
          touchAction: "pan-y",
          userSelect: "none" as const,
          WebkitUserSelect: "none" as const,
        }}
      >
        {/* The sliding pill */}
        {width > 0 && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: "absolute",
              top: 4, left: 4,
              width: halfW - 4,
              height: 40,
              background: "var(--accent)",
              borderRadius: 10,
              transform: "translateX(" + pillOffset + "px)",
              transition: isDragging ? "none" : "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
              boxShadow: "0 2px 8px rgba(var(--accent-rgb),0.25)",
              cursor: isDragging ? "grabbing" : "grab",
            }}
          />
        )}

        {/* Photos tab label */}
        <button
          onClick={() => onChange("photos")}
          style={{
            flex: 1, position: "relative", zIndex: 1,
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            color: active === "photos" ? "#000" : "rgba(255,255,255,0.4)",
            fontSize: 12, fontWeight: 800, letterSpacing: "0.1em",
            fontFamily: "inherit", transition: "color 0.2s",
            textTransform: "uppercase" as const,
          }}
        >
          <Camera size={13} strokeWidth={2.2} />
          Photos
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: active === "photos" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.25)",
            letterSpacing: 0,
          }}>{photoCount}</span>
        </button>

        {/* Captions tab label */}
        <button
          onClick={() => onChange("captions")}
          style={{
            flex: 1, position: "relative", zIndex: 1,
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            color: active === "captions" ? "#000" : "rgba(255,255,255,0.4)",
            fontSize: 12, fontWeight: 800, letterSpacing: "0.1em",
            fontFamily: "inherit", transition: "color 0.2s",
            textTransform: "uppercase" as const,
          }}
        >
          <Type size={13} strokeWidth={2.2} />
          Captions
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: active === "captions" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.25)",
            letterSpacing: 0,
          }}>{captionCount}</span>
        </button>
      </div>
    </div>
  );
}
