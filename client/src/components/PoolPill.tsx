/**
 * PoolPill — 3-way sliding pill: Photos | Captions | Videos.
 * Icon + tiny label per segment; gold-outlined thumb springs to the active one.
 * Tap = snap, drag = thumb follows the finger 1:1 then snaps to the nearest segment.
 */
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { Image as ImageIcon, Type, Video } from "lucide-react";

export type PoolTab = "photos" | "captions" | "videos";

const TABS: { id: PoolTab; label: string; Icon: typeof Type }[] = [
  { id: "photos", label: "Photos", Icon: ImageIcon },
  { id: "captions", label: "Captions", Icon: Type },
  { id: "videos", label: "Videos", Icon: Video },
];
const PAD = 4;
const DRAG_SLOP = 4;

interface PoolPillProps {
  active: PoolTab;
  onChange: (tab: PoolTab) => void;
}

export default function PoolPill({ active, onChange }: PoolPillProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [segW, setSegW] = useState(0);
  const x = useMotionValue(0);
  const [live, setLive] = useState<number | null>(null); // segment under the thumb while dragging
  const drag = useRef<{ startX: number; startThumb: number; moved: boolean } | null>(null);
  const activeIdx = TABS.findIndex((t) => t.id === active);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const measure = () => setSegW((ref.current!.clientWidth - PAD * 2) / TABS.length);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const snapTo = (i: number) => {
    if (reduce) x.set(i * segW);
    else animate(x, i * segW, { type: "spring", stiffness: 420, damping: 24, mass: 0.9 }); // slight overshoot, ~300ms
  };

  // follow the active tab (initial mount, keyboard, external changes)
  useEffect(() => {
    if (segW && !drag.current) snapTo(activeIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, segW, reduce]);

  const idxAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(TABS.length - 1, Math.floor((clientX - r.left - PAD) / segW)));
  };
  const nearest = (thumbX: number) => Math.max(0, Math.min(TABS.length - 1, Math.round(thumbX / segW)));

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button > 0 || !segW) return;
    x.stop();
    drag.current = { startX: e.clientX, startThumb: x.get(), moved: false };
    ref.current!.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < DRAG_SLOP) return;
    d.moved = true;
    const nx = Math.max(0, Math.min((TABS.length - 1) * segW, d.startThumb + dx));
    x.set(nx);
    setLive(nearest(nx));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setLive(null);
    if (!d) return;
    try { ref.current!.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const i = d.moved ? nearest(x.get()) : idxAt(e.clientX);
    snapTo(i);
    if (TABS[i].id !== active) onChange(TABS[i].id);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = (activeIdx + step + TABS.length) % TABS.length;
    onChange(TABS[i].id);
    (ref.current!.querySelectorAll("[role=tab]")[i] as HTMLElement).focus();
  };

  const shown = live ?? activeIdx;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 24px", padding: "0 32px" }}>
      <div
        ref={ref}
        role="tablist"
        aria-label="Pool"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        style={{
          position: "relative", display: "flex", height: 56, padding: PAD,
          background: "#141414", border: "1px solid #1e1e1e", borderRadius: 16,
          touchAction: "pan-y", userSelect: "none", WebkitUserSelect: "none", cursor: "grab",
        }}
      >
        {segW > 0 && (
          <motion.div
            aria-hidden
            style={{
              x, position: "absolute", top: PAD, left: PAD, width: segW, height: 56 - PAD * 2 - 2,
              borderRadius: 12, pointerEvents: "none",
              background: "rgba(var(--accent-rgb),0.12)",
              border: "1px solid var(--accent)",
              boxShadow: "0 2px 10px rgba(var(--accent-rgb),0.18)",
            }}
          />
        )}
        {TABS.map(({ id, label, Icon }, i) => (
          <button
            key={id}
            role="tab"
            aria-selected={active === id}
            tabIndex={active === id ? 0 : -1}
            onClick={(e) => { if (e.detail === 0 && id !== active) onChange(id); }} // keyboard Enter/Space; pointer handled above
            style={{
              flex: 1, position: "relative", zIndex: 1, minHeight: 44,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
              background: "transparent", border: "none", cursor: "inherit", fontFamily: "inherit",
              color: shown === i ? "var(--accent)" : "rgba(255,255,255,0.45)",
              transition: reduce ? "none" : "color 0.15s",
            }}
          >
            <Icon size={18} strokeWidth={2} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
