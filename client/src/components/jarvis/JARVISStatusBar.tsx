import { motion, AnimatePresence } from "framer-motion";
import { STATE_HEX, STATE_LABELS } from "./types";
import type { SystemState } from "./types";

const ICONS: Record<SystemState, string> = {
  idle: "○",
  listening: "◉",
  thinking: "⊙",
  speaking: "●",
};

interface JARVISStatusBarProps {
  state: SystemState;
}

export function JARVISStatusBar({ state }: JARVISStatusBarProps) {
  const color = STATE_HEX[state];
  const isActive = state !== "idle";

  return (
    <div className="flex items-center gap-2.5 px-6 py-2" role="status" aria-live="polite">
      {/* Pulsing glyph */}
      <motion.span
        className="text-sm leading-none font-mono select-none"
        style={{ color }}
        animate={{
          opacity: isActive ? [1, 0.35, 1] : [0.45, 1, 0.45],
          scale: isActive ? [1, 1.25, 1] : [1, 1.05, 1],
        }}
        transition={{
          duration: isActive ? 0.75 : 2.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {ICONS[state]}
      </motion.span>

      {/* Label cross-fade on state change */}
      <AnimatePresence mode="wait">
        <motion.span
          key={state}
          className="text-[10px] font-mono tracking-[0.18em] uppercase"
          style={{ color }}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {STATE_LABELS[state]}
        </motion.span>
      </AnimatePresence>

      {/* Thinking ellipsis */}
      <AnimatePresence>
        {state === "thinking" && (
          <motion.div
            className="flex gap-[3px] items-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="rounded-full"
                style={{ width: 3, height: 3, background: color }}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.3, 0.7] }}
                transition={{
                  duration: 0.65,
                  delay: i * 0.17,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Righthand system meta */}
      <div className="ml-auto flex items-center gap-3 font-mono text-[9px]" style={{ color: `${color}55` }}>
        <span>SYS.OK</span>
        <span className="opacity-60">|</span>
        <span>V1.0</span>
      </div>
    </div>
  );
}
