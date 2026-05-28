import { motion, AnimatePresence } from "framer-motion";
import { STATE_HEX, STATE_LABELS, GOLD_DIM } from "./types";
import type { SystemState } from "./types";

const GLYPHS: Record<SystemState, string> = {
  idle:      "○",
  listening: "◉",
  thinking:  "⊙",
  speaking:  "●",
};

const FREQ_LABELS: Record<SystemState, string> = {
  idle:      "0.00 kHz",
  listening: "3.40 kHz",
  thinking:  "8.72 kHz",
  speaking:  "5.10 kHz",
};

interface JARVISStatusBarProps {
  state: SystemState;
}

export function JARVISStatusBar({ state }: JARVISStatusBarProps) {
  const color    = STATE_HEX[state];
  const isActive = state !== "idle";

  return (
    <div
      className="flex items-center gap-2 px-5 py-1.5"
      role="status"
      aria-live="polite"
    >
      {/* Pulse glyph */}
      <motion.span
        className="text-sm leading-none font-mono select-none w-4 text-center"
        style={{ color, textShadow: `0 0 8px ${color}` }}
        animate={{
          opacity: isActive ? [1, 0.3, 1] : [0.4, 1, 0.4],
          scale:   isActive ? [1, 1.3, 1] : [1, 1.05, 1],
        }}
        transition={{ duration: isActive ? 0.7 : 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {GLYPHS[state]}
      </motion.span>

      {/* State label */}
      <AnimatePresence mode="wait">
        <motion.span
          key={state}
          className="text-[9px] font-mono tracking-[0.2em] uppercase"
          style={{ color, textShadow: `0 0 6px ${color}88` }}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 6 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
        >
          {STATE_LABELS[state]}
        </motion.span>
      </AnimatePresence>

      {/* Thinking dots */}
      <AnimatePresence>
        {state === "thinking" && (
          <motion.div className="flex gap-[3px] items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            {[0, 1, 2].map(i => (
              <motion.div key={i} className="rounded-full"
                style={{ width: 3, height: 3, background: color }}
                animate={{ opacity: [0.15, 1, 0.15], scale: [0.6, 1.4, 0.6] }}
                transition={{ duration: 0.6, delay: i * 0.16, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right: freq + version */}
      <div className="ml-auto flex items-center gap-3 font-mono text-[8px]"
        style={{ color: GOLD_DIM }}>
        <motion.span
          animate={{ opacity: isActive ? [0.5, 1, 0.5] : 0.4 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {FREQ_LABELS[state]}
        </motion.span>
        <span style={{ color: `${GOLD_DIM}80` }}>|</span>
        <span>v2.0</span>
      </div>
    </div>
  );
}
