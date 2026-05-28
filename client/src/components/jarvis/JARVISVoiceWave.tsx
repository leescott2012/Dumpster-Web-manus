import { motion } from "framer-motion";
import { STATE_HEX } from "./types";
import type { SystemState } from "./types";

const NUM_BARS = 30;

// Pre-defined max heights per state — mirrored so visually symmetric
const PEAK_HEIGHTS: Record<SystemState, number[]> = {
  idle: Array(NUM_BARS).fill(2),
  listening: [4, 10, 18, 28, 14, 8, 22, 12, 6, 26, 16, 10, 30, 8, 20, 20, 8, 30, 10, 16, 26, 6, 12, 22, 8, 14, 28, 18, 10, 4],
  thinking: Array.from({ length: NUM_BARS }, (_, i) =>
    6 + 18 * Math.abs(Math.sin((i / NUM_BARS) * Math.PI * 4))
  ),
  speaking: [14, 32, 46, 24, 40, 18, 52, 28, 42, 10, 48, 22, 38, 54, 16, 16, 54, 38, 22, 48, 10, 42, 28, 52, 18, 40, 24, 46, 32, 14],
};

const DURATIONS: Record<SystemState, number> = {
  idle: 0,
  listening: 1.1,
  thinking: 0.65,
  speaking: 0.45,
};

export function JARVISVoiceWave({ state }: { state: SystemState }) {
  const color = STATE_HEX[state];
  const peaks = PEAK_HEIGHTS[state];
  const dur = DURATIONS[state];
  const active = state !== "idle";

  return (
    <div
      className="flex items-center justify-center gap-[2.5px]"
      style={{ height: 64, width: 250 }}
      aria-label={`Voice waveform — ${state}`}
    >
      {Array.from({ length: NUM_BARS }, (_, i) => {
        const maxH = peaks[i] ?? 2;
        // Stagger delay creates a wave sweep
        const delay = active ? (i / NUM_BARS) * (dur * 0.7) : 0;

        return (
          <motion.div
            key={i}
            className="rounded-full flex-shrink-0"
            style={{
              width: 3,
              background: active
                ? `linear-gradient(to top, ${color}55, ${color})`
                : `${color}2a`,
              boxShadow: active ? `0 0 5px ${color}55` : "none",
            }}
            animate={{ height: active ? [2, maxH, 2] : 2 }}
            transition={
              active
                ? {
                    duration: dur,
                    delay,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatType: "loop",
                  }
                : { duration: 0.35, ease: "easeOut" }
            }
          />
        );
      })}
    </div>
  );
}
