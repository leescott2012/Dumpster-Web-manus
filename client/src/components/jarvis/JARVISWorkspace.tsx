import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cpu } from "lucide-react";
import { NeuralMatrixBackground } from "./NeuralMatrixBackground";
import { JARVISOrb } from "./JARVISOrb";
import { JARVISVoiceWave } from "./JARVISVoiceWave";
import { JARVISStatusBar } from "./JARVISStatusBar";
import { STATE_HEX } from "./types";
import type { SystemState } from "./types";

const STATES: SystemState[] = ["idle", "listening", "thinking", "speaking"];

// Per-state top-glow gradient
const TOP_GLOW: Record<SystemState, string> = {
  idle: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(200,169,110,0.08) 0%, transparent 100%)",
  listening: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(91,155,213,0.12) 0%, transparent 100%)",
  thinking: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(243,156,18,0.14) 0%, transparent 100%)",
  speaking: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232,200,130,0.1) 0%, transparent 100%)",
};

function HUDCorners({ color }: { color: string }) {
  const arm = 22;
  const pad = 14;
  const s: React.CSSProperties = { background: color, opacity: 0.45, position: "absolute" };
  return (
    <>
      <div style={{ ...s, top: pad, left: pad, width: arm, height: 1.5 }} />
      <div style={{ ...s, top: pad, left: pad, width: 1.5, height: arm }} />
      <div style={{ ...s, top: pad, right: pad, width: arm, height: 1.5 }} />
      <div style={{ ...s, top: pad, right: pad, width: 1.5, height: arm }} />
      <div style={{ ...s, bottom: pad, left: pad, width: arm, height: 1.5 }} />
      <div style={{ ...s, bottom: pad, left: pad, width: 1.5, height: arm }} />
      <div style={{ ...s, bottom: pad, right: pad, width: arm, height: 1.5 }} />
      <div style={{ ...s, bottom: pad, right: pad, width: 1.5, height: arm }} />
    </>
  );
}

function ScanLine({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        height: 1,
        background: `linear-gradient(to right, transparent 5%, ${color}33 40%, ${color}55 50%, ${color}33 60%, transparent 95%)`,
        zIndex: 5,
      }}
      initial={{ top: "0%" }}
      animate={{ top: "100%" }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "linear", repeatDelay: 2.5 }}
    />
  );
}

function Divider({ color }: { color: string }) {
  return (
    <div
      style={{
        height: 1,
        margin: "0 24px",
        background: `linear-gradient(to right, transparent, ${color}22, transparent)`,
      }}
    />
  );
}

export interface JARVISWorkspaceProps {
  open: boolean;
  onClose: () => void;
  /** Controlled state — omit to use internal state with demo controls */
  state?: SystemState;
  onStateChange?: (s: SystemState) => void;
  title?: string;
}

export function JARVISWorkspace({
  open,
  onClose,
  state: controlledState,
  onStateChange,
  title = "JARVIS",
}: JARVISWorkspaceProps) {
  const [internalState, setInternalState] = useState<SystemState>("idle");
  const state = controlledState ?? internalState;
  const color = STATE_HEX[state];

  function handleStateChange(s: SystemState) {
    setInternalState(s);
    onStateChange?.(s);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 overflow-hidden"
            style={{
              maxHeight: "88vh",
              borderRadius: "20px 20px 0 0",
              background: "#0c0b09",
              borderTop: `1px solid ${color}22`,
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 340, mass: 0.85 }}
          >
            {/* Neural matrix canvas (behind everything) */}
            <NeuralMatrixBackground state={state} />

            {/* State-keyed top glow cross-fades on change */}
            <AnimatePresence mode="wait">
              <motion.div
                key={state}
                className="absolute inset-0 pointer-events-none"
                style={{ background: TOP_GLOW[state] }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
            </AnimatePresence>

            {/* Sweep scan line */}
            <ScanLine color={color} />

            {/* HUD corner brackets */}
            <HUDCorners color={color} />

            {/* Foreground content */}
            <div className="relative z-10 flex flex-col" style={{ minHeight: "60vh" }}>
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-6 pt-5 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-[14px] h-[14px]" style={{ color }} />
                  <motion.span
                    className="text-[11px] font-mono tracking-[0.28em] uppercase"
                    style={{ color }}
                    animate={{ opacity: [0.65, 1, 0.65] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {title} NEURAL MATRIX
                  </motion.span>
                </div>

                <motion.button
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: `${color}10`,
                    border: `1px solid ${color}30`,
                  }}
                  whileHover={{ scale: 1.12, backgroundColor: `${color}20` }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  aria-label="Close JARVIS workspace"
                >
                  <X className="w-3.5 h-3.5" style={{ color }} />
                </motion.button>
              </div>

              <Divider color={color} />

              {/* ── Status bar ── */}
              <JARVISStatusBar state={state} />

              <Divider color={color} />

              {/* ── Orb + waveform ── */}
              <div className="flex flex-col items-center justify-center flex-1 py-8 gap-6">
                <JARVISOrb state={state} />
                <JARVISVoiceWave state={state} />
              </div>

              {/* ── State selector ── */}
              <div className="flex justify-center gap-2 px-6 pb-8">
                {STATES.map(s => (
                  <motion.button
                    key={s}
                    onClick={() => handleStateChange(s)}
                    className="px-3 py-1.5 rounded-full text-[9px] font-mono tracking-[0.14em] uppercase"
                    style={{
                      background: state === s ? `${STATE_HEX[s]}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${state === s ? STATE_HEX[s] + "50" : "rgba(255,255,255,0.09)"}`,
                      color: state === s ? STATE_HEX[s] : "#505050",
                    }}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
