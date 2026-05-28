import { motion } from "framer-motion";
import { STATE_HEX } from "./types";
import type { SystemState } from "./types";

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;

interface RingProps {
  r: number;
  color: string;
  opacity: number;
  dash: string;
  duration: number;
  reverse?: boolean;
  strokeWidth?: number;
}

function Ring({ r, color, opacity, dash, duration, reverse = false, strokeWidth = 1 }: RingProps) {
  return (
    <motion.g
      style={{ transformOrigin: `${CX}px ${CY}px` }}
      animate={{ rotate: reverse ? [0, -360] : [0, 360] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      <circle
        cx={CX}
        cy={CY}
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity={opacity}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
    </motion.g>
  );
}

const ORB_CONFIG: Record<SystemState, {
  coreScale: number[];
  coreGlow: string;
  ringOpacity: number;
  outerDuration: number;
  innerDuration: number;
  pulseDuration: number;
}> = {
  idle: {
    coreScale: [1, 1.04, 1],
    coreGlow: "rgba(200,169,110,0.3)",
    ringOpacity: 0.35,
    outerDuration: 28,
    innerDuration: 18,
    pulseDuration: 3.5,
  },
  listening: {
    coreScale: [1, 1.12, 0.96, 1.1, 1],
    coreGlow: "rgba(91,155,213,0.5)",
    ringOpacity: 0.7,
    outerDuration: 6,
    innerDuration: 3,
    pulseDuration: 1.2,
  },
  thinking: {
    coreScale: [1, 1.2, 0.88, 1.18, 1],
    coreGlow: "rgba(243,156,18,0.65)",
    ringOpacity: 0.9,
    outerDuration: 2.5,
    innerDuration: 1.2,
    pulseDuration: 0.7,
  },
  speaking: {
    coreScale: [0.92, 1.14, 0.9, 1.12, 0.92],
    coreGlow: "rgba(232,200,130,0.5)",
    ringOpacity: 0.75,
    outerDuration: 8,
    innerDuration: 4,
    pulseDuration: 0.55,
  },
};

export function JARVISOrb({ state }: { state: SystemState }) {
  const color = STATE_HEX[state];
  const cfg = ORB_CONFIG[state];

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* SVG rings */}
      <svg
        width={SIZE}
        height={SIZE}
        className="absolute inset-0"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        {/* Far outer — slow, sparse */}
        <Ring
          r={92}
          color={color}
          opacity={cfg.ringOpacity * 0.3}
          dash="6 18"
          duration={cfg.outerDuration * 1.5}
          strokeWidth={0.8}
        />
        {/* Outer */}
        <Ring
          r={78}
          color={color}
          opacity={cfg.ringOpacity * 0.45}
          dash="8 14"
          duration={cfg.outerDuration}
          reverse
        />
        {/* Mid — dense dash, counter-spin */}
        <Ring
          r={64}
          color={color}
          opacity={cfg.ringOpacity * 0.6}
          dash="3 6"
          duration={cfg.innerDuration}
        />
        {/* Inner accent arc */}
        <Ring
          r={50}
          color={color}
          opacity={cfg.ringOpacity * 0.85}
          dash="14 46"
          duration={cfg.innerDuration * 0.6}
          reverse
          strokeWidth={1.5}
        />

        {/* Cardinal tick marks */}
        {[0, 90, 180, 270].map(deg => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={CX + Math.cos(rad) * 86}
              y1={CY + Math.sin(rad) * 86}
              x2={CX + Math.cos(rad) * 94}
              y2={CY + Math.sin(rad) * 94}
              stroke={color}
              strokeWidth={1.5}
              strokeOpacity={0.4}
            />
          );
        })}
      </svg>

      {/* Ambient glow */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 100,
          height: 100,
          top: CY - 50,
          left: CX - 50,
          background: `radial-gradient(circle, ${cfg.coreGlow} 0%, transparent 70%)`,
          filter: "blur(16px)",
        }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
        transition={{
          duration: cfg.pulseDuration * 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Core sphere */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 68,
          height: 68,
          top: CY - 34,
          left: CX - 34,
          background: `radial-gradient(circle at 33% 28%, ${color}cc 0%, ${color}55 45%, ${color}18 100%)`,
          boxShadow: `0 0 22px ${cfg.coreGlow}, 0 0 44px ${cfg.coreGlow}, inset 0 1px 1px ${color}55`,
          border: `1px solid ${color}66`,
        }}
        animate={{ scale: cfg.coreScale }}
        transition={{
          duration: cfg.pulseDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Specular highlight */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 20,
            height: 20,
            top: 10,
            left: 12,
            background: `radial-gradient(circle, ${color}bb, transparent)`,
            filter: "blur(4px)",
          }}
        />
      </motion.div>
    </div>
  );
}
