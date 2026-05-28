import { motion } from "framer-motion";
import { STATE_HEX, STATE_INTENSITY, GOLD_BRIGHT } from "./types";
import type { SystemState } from "./types";

const NUM_BARS = 32;

const PEAKS: Record<SystemState, number[]> = {
  idle: Array(NUM_BARS).fill(2),
  listening: [
    4, 12, 22, 34, 16, 8, 28, 14, 6, 32, 18, 10, 36, 8, 24,
    24, 8, 36, 10, 18, 32, 6, 14, 28, 8, 16, 34, 22, 12, 4, 8, 16,
  ],
  thinking: Array.from({ length: NUM_BARS }, (_, i) =>
    8 + 22 * Math.abs(Math.sin((i / NUM_BARS) * Math.PI * 5))
  ),
  speaking: [
    16, 36, 52, 28, 46, 20, 58, 32, 48, 12, 52, 26, 44, 60, 18, 40,
    40, 18, 60, 44, 26, 52, 12, 48, 32, 58, 20, 46, 28, 52, 36, 16,
  ],
};

const DURATIONS: Record<SystemState, number> = {
  idle:      0,
  listening: 1.1,
  thinking:  0.6,
  speaking:  0.42,
};

export function JARVISVoiceWave({ state }: { state: SystemState }) {
  const color     = STATE_HEX[state];
  const intensity = STATE_INTENSITY[state];
  const peaks     = PEAKS[state];
  const dur       = DURATIONS[state];
  const active    = state !== "idle";

  return (
    <div
      className="flex items-center justify-center gap-[2px]"
      style={{ height: 68, width: 270 }}
      aria-label={`Voice waveform — ${state}`}
    >
      {Array.from({ length: NUM_BARS }, (_, i) => {
        const maxH   = peaks[i] ?? 2;
        const isMid  = Math.abs(i - NUM_BARS / 2) < NUM_BARS * 0.15;
        const accent = active && isMid ? GOLD_BRIGHT : color;
        const delay  = active ? (i / NUM_BARS) * (dur * 0.65) : 0;

        return (
          <motion.div
            key={i}
            className="rounded-sm flex-shrink-0"
            style={{
              width: 3,
              background: active
                ? `linear-gradient(to top, ${color}44, ${accent})`
                : `${color}22`,
              boxShadow: active && isMid
                ? `0 0 6px ${GOLD_BRIGHT}88, 0 0 12px ${GOLD_BRIGHT}44`
                : active
                ? `0 0 4px ${color}55`
                : "none",
              opacity: intensity,
            }}
            animate={{ height: active ? [2, maxH, 2] : 2 }}
            transition={
              active
                ? { duration: dur, delay, repeat: Infinity, ease: "easeInOut", repeatType: "loop" }
                : { duration: 0.35, ease: "easeOut" }
            }
          />
        );
      })}
    </div>
  );
}
