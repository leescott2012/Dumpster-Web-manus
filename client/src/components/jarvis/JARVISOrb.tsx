/**
 * Arc Reactor — Iron Man / Stark Industries centrepiece.
 * Concentric rings, 12 radial fins, 3 rotating prongs, hex-dot core.
 */
import { useId } from "react";
import { motion } from "framer-motion";
import { STATE_HEX, STATE_INTENSITY } from "./types";
import type { SystemState } from "./types";

const V  = 240;
const CX = V / 2;
const CY = V / 2;

// All radii in SVG user units
const R_HOUSING    = 110;
const R_FIN_OUTER  = 107;
const R_FIN_INNER  =  88;
const R_MID        =  74;
const R_PRONG_OUT  =  72;
const R_PRONG_IN   =  40;
const R_INNER      =  33;
const R_HEX        =  25;
const R_CORE       =  19;
const R_CORE_GLOW  =  44;

function pt(angle: number, r: number) {
  return { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r };
}

interface RingProps {
  r: number; color: string; opacity: number;
  dash: string; dur: number; reverse?: boolean; sw?: number;
}
function Ring({ r, color, opacity, dash, dur, reverse = false, sw = 1 }: RingProps) {
  return (
    <motion.g
      style={{ transformOrigin: `${CX}px ${CY}px` }}
      animate={{ rotate: reverse ? [0, -360] : [0, 360] }}
      transition={{ duration: dur, repeat: Infinity, ease: "linear" }}
    >
      <circle cx={CX} cy={CY} r={r} fill="none"
        stroke={color} strokeOpacity={opacity} strokeWidth={sw} strokeDasharray={dash} />
    </motion.g>
  );
}

const CFG: Record<SystemState, {
  outerDur: number; midDur: number; prongDur: number;
  innerDur: number; corePulse: number; coreScale: number[];
}> = {
  idle:      { outerDur: 50, midDur: 35, prongDur: 25, innerDur: 18, corePulse: 3.8, coreScale: [1, 1.04, 1] },
  listening: { outerDur: 16, midDur: 10, prongDur:  7, innerDur:  5, corePulse: 1.1, coreScale: [1, 1.1, 0.97, 1.08, 1] },
  thinking:  { outerDur:  5, midDur:  3, prongDur:  2, innerDur:  1.4, corePulse: 0.6, coreScale: [1, 1.2, 0.86, 1.18, 1] },
  speaking:  { outerDur: 10, midDur:  6, prongDur:  4, innerDur:  3,   corePulse: 0.5, coreScale: [0.9, 1.14, 0.88, 1.12, 0.9] },
};

export function JARVISOrb({ state }: { state: SystemState }) {
  const uid       = useId();
  const color     = STATE_HEX[state];
  const intensity = STATE_INTENSITY[state];
  const cfg       = CFG[state];

  const glowFilter  = `url(#glow-${uid})`;
  const coreGradId  = `core-grad-${uid}`;
  const coreGlowId  = `core-glow-${uid}`;
  const outerGlowId = `outer-glow-${uid}`;

  const glow6  = Math.round(6  * intensity);
  const glow14 = Math.round(14 * intensity);

  return (
    <div className="relative" style={{ width: V, height: V }}>
      <svg
        width={V} height={V}
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glow6} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`outer-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={3} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id={coreGradId} cx="40%" cy="35%" r="55%">
            <stop offset="0%"   stopColor={color} stopOpacity={1} />
            <stop offset="50%"  stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0.08} />
          </radialGradient>
          <radialGradient id={coreGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={color} stopOpacity={0.9 * intensity} />
            <stop offset="60%"  stopColor={color} stopOpacity={0.3 * intensity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={outerGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={color} stopOpacity={0.15 * intensity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* ── Ambient outer glow ── */}
        <circle cx={CX} cy={CY} r={R_HOUSING + 20} fill={`url(#${outerGlowId})`} />

        {/* ── Housing ring ── */}
        <circle cx={CX} cy={CY} r={R_HOUSING} fill="none"
          stroke={color} strokeOpacity={0.18 * intensity} strokeWidth={0.6} />

        {/* ── 24 outer tick marks (alternating lengths) ── */}
        {Array.from({ length: 24 }, (_, i) => {
          const a     = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const isFin = i % 2 === 0;
          const inner = isFin ? R_FIN_INNER : R_FIN_OUTER - 4;
          const outer = isFin ? R_FIN_OUTER : R_FIN_OUTER + 4;
          const p1 = pt(a, inner), p2 = pt(a, outer);
          return (
            <line key={i}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={color}
              strokeWidth={isFin ? 3 : 0.8}
              strokeOpacity={(isFin ? 0.65 : 0.25) * intensity}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Mid ring (CCW) ── */}
        <Ring r={R_MID} color={color} opacity={0.55 * intensity}
          dash="4 5" dur={cfg.midDur} reverse sw={1.5} />

        {/* ── 3 Prongs (CW) ── */}
        <motion.g
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: cfg.prongDur, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: 3 }, (_, i) => {
            const ca      = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const spread  = Math.PI / 7.5; // ≈24°
            const ol      = pt(ca - spread, R_PRONG_OUT);
            const or      = pt(ca + spread, R_PRONG_OUT);
            const tip     = pt(ca, R_PRONG_IN);
            return (
              <polygon key={i}
                points={`${ol.x},${ol.y} ${or.x},${or.y} ${tip.x},${tip.y}`}
                fill={color} fillOpacity={0.16 * intensity}
                stroke={color} strokeWidth={1} strokeOpacity={0.7 * intensity}
              />
            );
          })}
        </motion.g>

        {/* ── Inner ring (CW, fast) ── */}
        <Ring r={R_INNER} color={color} opacity={0.7 * intensity}
          dash="10 5 2 5" dur={cfg.innerDur} sw={2} />

        {/* ── Hex dots (staggered pulse) ── */}
        {Array.from({ length: 6 }, (_, i) => {
          const p = pt((i / 6) * Math.PI * 2 - Math.PI / 2, R_HEX);
          return (
            <motion.circle key={i} cx={p.x} cy={p.y} r={2.2}
              fill={color} fillOpacity={0.55 * intensity}
              animate={{ opacity: [0.3, 1, 0.3], r: [1.8, 2.5, 1.8] }}
              transition={{
                duration: cfg.corePulse,
                delay: (i / 6) * cfg.corePulse,
                repeat: Infinity, ease: "easeInOut",
              }}
            />
          );
        })}

        {/* ── Core glow + sphere ── */}
        <motion.g
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          animate={{ scale: cfg.coreScale }}
          transition={{ duration: cfg.corePulse, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Soft bloom */}
          <circle cx={CX} cy={CY} r={R_CORE_GLOW} fill={`url(#${coreGlowId})`} />
          {/* Core fill */}
          <circle cx={CX} cy={CY} r={R_CORE} fill={`url(#${coreGradId})`}
            filter={glowFilter} />
          {/* Specular highlight */}
          <ellipse cx={CX - 5} cy={CY - 6} rx={6} ry={4}
            fill={color} fillOpacity={0.45} />
        </motion.g>

        {/* ── Cardinal data labels (STARK HUD style) ── */}
        {[
          { angle: -Math.PI / 2, label: "ARC",  r: R_HOUSING + 18, anchor: "middle" },
          { angle:  Math.PI,     label: "ψ",     r: R_HOUSING + 16, anchor: "end" },
          { angle:  0,           label: "Σ",     r: R_HOUSING + 16, anchor: "start" },
        ].map(({ angle, label, r, anchor }, i) => {
          const p = pt(angle, r);
          return (
            <text key={i} x={p.x} y={p.y + 4}
              fill={color} fillOpacity={0.35 * intensity}
              fontSize={8} fontFamily="monospace"
              textAnchor={anchor as CanvasTextAlign}
              letterSpacing={2}
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
