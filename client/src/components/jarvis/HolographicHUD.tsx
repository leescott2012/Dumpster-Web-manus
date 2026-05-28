/**
 * HolographicHUD — Stark Industries overlay layer.
 * Provides: scanlines, vignette, corner brackets, side data panels,
 * projection flicker, and a sweep scan line.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STATE_HEX, STATE_INTENSITY, GOLD_DIM, BLACK } from "./types";
import type { SystemState } from "./types";

// ─── Stark-corner brackets ────────────────────────────────────────────────────

interface CornersProps { color: string; size?: number; thickness?: number; pad?: number; }

export function StarkCorners({ color, size = 24, thickness = 1.5, pad = 12 }: CornersProps) {
  const s: React.CSSProperties = { background: color, position: "absolute", opacity: 0.55 };
  return (
    <>
      {/* top-left */}
      <div style={{ ...s, top: pad, left: pad, width: size, height: thickness }} />
      <div style={{ ...s, top: pad, left: pad, width: thickness, height: size }} />
      {/* label tick */}
      <div style={{ ...s, top: pad + size + 4, left: pad, width: 8, height: thickness * 0.5, opacity: 0.3 }} />
      {/* top-right */}
      <div style={{ ...s, top: pad, right: pad, width: size, height: thickness }} />
      <div style={{ ...s, top: pad, right: pad, width: thickness, height: size }} />
      <div style={{ ...s, top: pad + size + 4, right: pad, width: 8, height: thickness * 0.5, opacity: 0.3 }} />
      {/* bottom-left */}
      <div style={{ ...s, bottom: pad, left: pad, width: size, height: thickness }} />
      <div style={{ ...s, bottom: pad, left: pad, width: thickness, height: size }} />
      <div style={{ ...s, bottom: pad + size + 4, left: pad, width: 8, height: thickness * 0.5, opacity: 0.3 }} />
      {/* bottom-right */}
      <div style={{ ...s, bottom: pad, right: pad, width: size, height: thickness }} />
      <div style={{ ...s, bottom: pad, right: pad, width: thickness, height: size }} />
      <div style={{ ...s, bottom: pad + size + 4, right: pad, width: 8, height: thickness * 0.5, opacity: 0.3 }} />
    </>
  );
}

// ─── Sweep scan line ─────────────────────────────────────────────────────────

export function ScanLine({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        height: 1,
        background: `linear-gradient(to right, transparent 4%, ${color}22 35%, ${color}55 50%, ${color}22 65%, transparent 96%)`,
        zIndex: 6,
      }}
      initial={{ top: "0%" }}
      animate={{ top: "100%" }}
      transition={{ duration: 5, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
    />
  );
}

// ─── Segment bar (HUD-style progress) ────────────────────────────────────────

interface SegBarProps {
  label: string; value: number; /* 0–100 */ color: string; segments?: number;
}
export function SegBar({ label, value, color, segments = 10 }: SegBarProps) {
  const filled = Math.round((value / 100) * segments);
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[8px] tracking-[0.12em] uppercase w-8 flex-shrink-0"
        style={{ color: `${color}88` }}>
        {label}
      </span>
      <div className="flex gap-[2px]">
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            style={{
              width: 6, height: 8,
              background: i < filled ? color : `${color}20`,
              boxShadow: i < filled ? `0 0 4px ${color}66` : "none",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      <span className="font-mono text-[8px]" style={{ color: `${color}99` }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Live metrics (simulated) ────────────────────────────────────────────────

interface Metrics { pwr: number; cpu: number; mem: number; net: number; }

function randNear(base: number, spread = 3) {
  return Math.min(100, Math.max(0, base + (Math.random() - 0.5) * spread));
}

function useMetrics(state: SystemState): Metrics {
  const BASE: Record<SystemState, Metrics> = {
    idle:      { pwr: 18.2, cpu:  9.4, mem: 42.0, net:  2.1 },
    listening: { pwr: 61.4, cpu: 28.7, mem: 58.3, net: 44.8 },
    thinking:  { pwr: 94.7, cpu: 87.3, mem: 71.9, net: 12.4 },
    speaking:  { pwr: 72.3, cpu: 52.1, mem: 64.7, net: 58.2 },
  };
  const [m, setM] = useState<Metrics>(BASE[state]);

  useEffect(() => {
    const base = BASE[state];
    setM(base);
    const id = setInterval(() => {
      setM({
        pwr: randNear(base.pwr, 2),
        cpu: randNear(base.cpu, 4),
        mem: randNear(base.mem, 1.5),
        net: randNear(base.net, 6),
      });
    }, 800);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return m;
}

// ─── Data panel ─────────────────────────────────────────────────────────────

export function HUDDataPanel({ state }: { state: SystemState }) {
  const color   = STATE_HEX[state];
  const metrics = useMetrics(state);

  const STATUS_ROWS: { key: string; value: string }[] = [
    { key: "SYS",    value: "ONLINE"           },
    { key: "THREAT", value: "CLEAR"            },
    { key: "LOC",    value: "SECURE"           },
    { key: "NET",    value: metrics.net.toFixed(1) + " Mb/s" },
  ];

  return (
    <div className="flex flex-col gap-2.5 w-full px-5 py-3">
      {/* Segment bars */}
      <div className="flex flex-col gap-1.5">
        <SegBar label="PWR" value={metrics.pwr} color={color} />
        <SegBar label="CPU" value={metrics.cpu} color={color} />
        <SegBar label="MEM" value={metrics.mem} color={color} />
      </div>

      {/* Thin divider */}
      <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${color}22, transparent)` }} />

      {/* Status key-values */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {STATUS_ROWS.map(({ key, value }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="font-mono text-[7px] tracking-[0.15em]"
              style={{ color: `${color}66` }}>{key}</span>
            <motion.span
              className="font-mono text-[8px] tracking-[0.1em]"
              style={{ color }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 2 }}
            >
              {value}
            </motion.span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Targeting brackets (around the reactor) ─────────────────────────────────

interface TargetingBracketsProps { color: string; size?: number; gap?: number; locked?: boolean; }
export function TargetingBrackets({ color, size = 28, gap = 6, locked = false }: TargetingBracketsProps) {
  const arm = size;
  const sw  = 1.5;
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      animate={{ opacity: locked ? [1, 0.5, 1] : 1 }}
      transition={{ duration: 0.4, repeat: locked ? Infinity : 0, ease: "easeInOut" }}
    >
      <svg className="w-full h-full" style={{ overflow: "visible" }} aria-hidden>
        {/* top-left */}
        <line x1={gap} y1={gap + arm} x2={gap} y2={gap} stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        <line x1={gap} y1={gap} x2={gap + arm} y2={gap} stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        {/* top-right */}
        <line x1="calc(100% - 1)" y1={gap + arm} x2="calc(100% - 1)" y2={gap} stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        <line x1="calc(100% - 1)" y1={gap} x2={`calc(100% - ${arm + 1})`} y2={gap} stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        {/* bottom-left */}
        <line x1={gap} y1="calc(100% - 1)" x2={gap} y2={`calc(100% - ${arm + 1})`} stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        <line x1={gap} y1="calc(100% - 1)" x2={gap + arm} y2="calc(100% - 1)" stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        {/* bottom-right */}
        <line x1="calc(100% - 1)" y1={`calc(100% - ${arm + 1})`} x2="calc(100% - 1)" y2="calc(100% - 1)" stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
        <line x1={`calc(100% - ${arm + 1})`} y1="calc(100% - 1)" x2="calc(100% - 1)" y2="calc(100% - 1)" stroke={color} strokeWidth={sw} strokeOpacity={0.6} />
      </svg>
    </motion.div>
  );
}

// ─── Full overlay (scanlines + vignette + flicker) ────────────────────────────

interface HolographicHUDProps { state: SystemState; }

export function HolographicHUD({ state }: HolographicHUDProps) {
  const color     = STATE_HEX[state];
  const intensity = STATE_INTENSITY[state];

  return (
    <>
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
          zIndex: 7,
          mixBlendMode: "multiply",
        }}
      />

      {/* Projection vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 90% 90% at 50% 50%, transparent 55%, ${BLACK}cc 100%)`,
          zIndex: 4,
        }}
      />

      {/* Subtle top-edge projection glow */}
      <motion.div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: 80,
          background: `linear-gradient(to bottom, ${color}${Math.round(0.07 * intensity * 255).toString(16).padStart(2, "0")}, transparent)`,
          zIndex: 3,
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Projection flicker */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "transparent", zIndex: 8 }}
        animate={{ opacity: [1, 0.97, 1, 0.98, 1] }}
        transition={{ duration: 0.15, times: [0, 0.25, 0.5, 0.75, 1], repeat: Infinity, repeatDelay: 5 + Math.random() * 8 }}
      />

      {/* Outer panel corners */}
      <StarkCorners color={color} size={22} pad={10} />

      {/* Sweep line */}
      <ScanLine color={color} />
    </>
  );
}
