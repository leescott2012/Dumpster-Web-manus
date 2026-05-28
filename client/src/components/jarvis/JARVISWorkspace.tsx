/**
 * JARVISWorkspace — Iron Man / Stark Industries holographic HUD.
 * Features: parallax depth layers, Arc Reactor, targeting brackets,
 * Holographic overlay, HUD data panels, state-reactive animations.
 */
import { useState, useCallback } from "react";
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform,
} from "framer-motion";
import { X, Cpu, Zap } from "lucide-react";

import { NeuralMatrixBackground }       from "./NeuralMatrixBackground";
import { JARVISOrb }                    from "./JARVISOrb";
import { JARVISVoiceWave }              from "./JARVISVoiceWave";
import { JARVISStatusBar }              from "./JARVISStatusBar";
import { HolographicHUD, HUDDataPanel, TargetingBrackets } from "./HolographicHUD";
import { STATE_HEX, STATE_INTENSITY, GOLD_DIM, SURFACE } from "./types";
import type { SystemState } from "./types";

const STATES: SystemState[] = ["idle", "listening", "thinking", "speaking"];

// State-keyed top glow gradients
const TOP_GLOW: Record<SystemState, string> = {
  idle:      "radial-gradient(ellipse 75% 45% at 50% 0%, rgba(133,106,30,0.12) 0%, transparent 100%)",
  listening: "radial-gradient(ellipse 75% 45% at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 100%)",
  thinking:  "radial-gradient(ellipse 75% 45% at 50% 0%, rgba(255,215,0,0.22) 0%, transparent 100%)",
  speaking:  "radial-gradient(ellipse 75% 45% at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 100%)",
};

function Divider({ color }: { color: string }) {
  return (
    <div style={{
      height: 1, margin: "0 20px",
      background: `linear-gradient(to right, transparent, ${color}28, transparent)`,
    }} />
  );
}

// Stark-style header label with blinking cursor
function StarkLabel({ text, color }: { text: string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <motion.span
        className="font-mono text-[7px] tracking-[0.25em] uppercase"
        style={{ color: `${color}66` }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      >
        {text}
      </motion.span>
      <motion.div
        className="w-[2px] h-[8px] rounded-full"
        style={{ background: color }}
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export interface JARVISWorkspaceProps {
  open: boolean;
  onClose: () => void;
  state?: SystemState;
  onStateChange?: (s: SystemState) => void;
  title?: string;
}

export function JARVISWorkspace({
  open,
  onClose,
  state: controlled,
  onStateChange,
  title = "JARVIS",
}: JARVISWorkspaceProps) {
  const [internal, setInternal] = useState<SystemState>("idle");
  const state     = controlled ?? internal;
  const color     = STATE_HEX[state];
  const intensity = STATE_INTENSITY[state];

  // ── Parallax via mouse/touch ──────────────────────────────────────────────
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const sX   = useSpring(rawX, { stiffness: 55, damping: 22 });
  const sY   = useSpring(rawY, { stiffness: 55, damping: 22 });

  // Three depth layers: far / mid / near
  const farX  = useTransform(sX, v => v *  5);
  const farY  = useTransform(sY, v => v *  3);
  const midX  = useTransform(sX, v => v * 12);
  const midY  = useTransform(sY, v => v *  8);
  const nearX = useTransform(sX, v => v * 20);
  const nearY = useTransform(sY, v => v * 13);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set(((e.clientX - r.left) / r.width  - 0.5) * 2);
    rawY.set(((e.clientY - r.top)  / r.height - 0.5) * 2);
  }, [rawX, rawY]);

  const handleMouseLeave = useCallback(() => {
    rawX.set(0); rawY.set(0);
  }, [rawX, rawY]);

  function handleStateChange(s: SystemState) {
    setInternal(s);
    onStateChange?.(s);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* ── Panel ── */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 overflow-hidden"
            style={{
              maxHeight: "90vh",
              borderRadius: "18px 18px 0 0",
              background: SURFACE,
              borderTop:   `1px solid ${color}25`,
              borderLeft:  `1px solid ${color}10`,
              borderRight: `1px solid ${color}10`,
              willChange: "transform",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 36, stiffness: 350, mass: 0.8 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* ── Depth layer 0: neural matrix (far) ── */}
            <motion.div className="absolute inset-0" style={{ x: farX, y: farY }}>
              <NeuralMatrixBackground state={state} />
            </motion.div>

            {/* ── State-keyed top glow ── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={state}
                className="absolute inset-0 pointer-events-none"
                style={{ background: TOP_GLOW[state] }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
              />
            </AnimatePresence>

            {/* ── Holographic HUD overlay (scanlines, vignette, flicker, corners) ── */}
            <HolographicHUD state={state} />

            {/* ── Foreground content ── */}
            <div className="relative z-10 flex flex-col" style={{ minHeight: "60vh" }}>

              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Cpu className="w-3.5 h-3.5" style={{ color, filter: `drop-shadow(0 0 6px ${color})` }} />
                  </motion.div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] tracking-[0.3em] uppercase"
                      style={{ color, textShadow: `0 0 8px ${color}88` }}>
                      STARK INDUSTRIES // {title}
                    </span>
                    <StarkLabel text="ARC REACTOR INTERFACE  v2.0" color={color} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Power indicator */}
                  <motion.div className="flex items-center gap-1"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                    <Zap className="w-3 h-3" style={{ color: `${color}88` }} />
                    <span className="font-mono text-[7px]" style={{ color: GOLD_DIM }}>
                      {Math.round(intensity * 100)}%
                    </span>
                  </motion.div>

                  {/* Close */}
                  <motion.button
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: `${color}0e`, border: `1px solid ${color}2a` }}
                    whileHover={{ scale: 1.12, backgroundColor: `${color}22` }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    aria-label="Close JARVIS"
                  >
                    <X className="w-3.5 h-3.5" style={{ color }} />
                  </motion.button>
                </div>
              </div>

              <Divider color={color} />
              <JARVISStatusBar state={state} />
              <Divider color={color} />

              {/* ── Central reactor zone (mid parallax layer) ── */}
              <motion.div
                className="flex flex-col items-center justify-center py-6 gap-4"
                style={{ x: midX, y: midY, willChange: "transform" }}
              >
                {/* Reactor + targeting */}
                <div className="relative" style={{ width: 240, height: 240 }}>
                  {/* Near layer: targeting brackets */}
                  <motion.div
                    className="absolute inset-0"
                    style={{ x: nearX, y: nearY, willChange: "transform" }}
                  >
                    <TargetingBrackets
                      color={color}
                      size={32}
                      gap={-2}
                      locked={state === "thinking"}
                    />
                  </motion.div>

                  {/* Arc Reactor itself */}
                  <JARVISOrb state={state} />

                  {/* Orbit labels (9 / 3 o'clock) */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* 9 o'clock */}
                    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: -64 }}>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-mono text-[7px] tracking-[0.15em] uppercase"
                          style={{ color: `${color}55` }}>POWER</span>
                        <motion.span className="font-mono text-[9px]" style={{ color }}
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
                          {Math.round(intensity * 94.7)}%
                        </motion.span>
                        <div style={{ width: 40, height: 1, background: `${color}40` }} />
                      </div>
                    </div>
                    {/* 3 o'clock */}
                    <div className="absolute top-1/2 -translate-y-1/2" style={{ right: -64 }}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-mono text-[7px] tracking-[0.15em] uppercase"
                          style={{ color: `${color}55` }}>NEURAL</span>
                        <motion.span className="font-mono text-[9px]" style={{ color }}
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
                          {state === "thinking" ? "ACTIVE" : state === "idle" ? "IDLE" : "PROC"}
                        </motion.span>
                        <div style={{ width: 40, height: 1, background: `${color}40` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Voice waveform */}
                <JARVISVoiceWave state={state} />
              </motion.div>

              <Divider color={color} />

              {/* ── HUD data panel ── */}
              <HUDDataPanel state={state} />

              <Divider color={color} />

              {/* ── State selector ── */}
              <div className="flex justify-center gap-2 px-5 py-4">
                {STATES.map(s => {
                  const c      = STATE_HEX[s];
                  const active = state === s;
                  return (
                    <motion.button
                      key={s}
                      onClick={() => handleStateChange(s)}
                      className="relative px-3 py-1.5 rounded font-mono text-[8px] tracking-[0.16em] uppercase overflow-hidden"
                      style={{
                        background: active ? `${c}14` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? c + "55" : "rgba(255,255,255,0.08)"}`,
                        color: active ? c : "#444",
                        boxShadow: active ? `0 0 10px ${c}22, inset 0 0 8px ${c}0a` : "none",
                        textShadow: active ? `0 0 6px ${c}88` : "none",
                      }}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      {active && (
                        <motion.div
                          className="absolute inset-0 rounded"
                          style={{ background: `linear-gradient(to bottom, ${c}08, transparent)` }}
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                      <span className="relative">{s}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
