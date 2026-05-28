import { motion } from "motion/react";
import { Mic, MicOff, Radio, Sparkles } from "lucide-react";
import { sfx } from "../utils/audioSynth";

interface ArcReactorProps {
  status: "idle" | "listening" | "thinking" | "speaking";
  themeColor: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
  isMuted: boolean;
  onToggleMute: () => void;
  transcript?: string;
  isVolumeActive?: boolean;
}

export default function ArcReactor({
  status,
  themeColor,
  isMuted,
  onToggleMute,
  transcript,
  isVolumeActive = false
}: ArcReactorProps) {

  // Color mapping variables
  const colorThemeMap = {
    'arc-blue': {
      glow: "shadow-[0_0_50px_rgba(200,169,110,0.4)]",
      text: "text-accent",
      border: "border-accent/30",
      accent: "#c8a96e",
      radial: "radial-gradient(circle, rgba(200,169,110,0.2) 0%, rgba(10,10,10,0) 70%)",
      svgStreak: "#c8a96e"
    },
    'reactor-orange': {
      glow: "shadow-[0_0_50px_rgba(245,158,11,0.4)]",
      text: "text-amber-500",
      border: "border-amber-500/30",
      accent: "#f59e0b",
      radial: "radial-gradient(circle, rgba(245,158,11,0.2) 0%, rgba(15,23,42,0) 70%)",
      svgStreak: "#f59e0b"
    },
    'matrix-green': {
      glow: "shadow-[0_0_50px_rgba(16,185,129,0.4)]",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      accent: "#10b981",
      radial: "radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(15,23,42,0) 70%)",
      svgStreak: "#10b981"
    },
    'crimson-alert': {
      glow: "shadow-[0_0_50px_rgba(239,68,68,0.4)]",
      text: "text-rose-500",
      border: "border-rose-500/30",
      accent: "#ef4444",
      radial: "radial-gradient(circle, rgba(239,68,68,0.2) 0%, rgba(15,23,42,0) 70%)",
      svgStreak: "#ef4444"
    }
  };

  const choice = colorThemeMap[themeColor];

  // Specific state descriptions
  const stateLabels = {
    idle: { title: "ONLINE - SYSTEM SECURED", subtitle: "Awaiting activation commands...", color: choice.text },
    listening: { title: "EARS ACTIVE - DECRYPTING SPEECH", subtitle: "Syncing voice stream in real-time...", color: "text-red-400 animate-pulse" },
    thinking: { title: "NEURAL COGNITION RUNNING", subtitle: "Querying Gemini core modules...", color: "text-amber-400" },
    speaking: { title: "DISSOLVING SPEECH SYNTHESIS", subtitle: "Modulating voice frequency oscillator...", color: "text-cyan-400 animate-pulse" }
  };

  const currentMeta = stateLabels[status];

  // Handle clicking reactor core directly
  const handleReactorClick = () => {
    sfx.playBeep(status === 'idle' ? 660 : 440, 0.1);
    onToggleMute();
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-card/30 backdrop-blur-md rounded-2xl border border-border/80 relative overflow-hidden" id="arc-reactor-widget">
      {/* Dynamic Background Radial Aura */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{ background: choice.radial }}
      />

      {/* Hexagonal Tech Decal Decoration */}
      <div className="absolute top-3 left-4 flex gap-1 items-center text-[10px] font-mono tracking-widest text-slate-500">
        <Radio className="w-2.5 h-2.5" />
        <span>Genius COGNITIVE REACTOR</span>
      </div>

      <div className="absolute top-3 right-4 flex gap-1 items-center text-[10px] font-mono tracking-widest text-slate-500">
        <span>STATUS: {status.toUpperCase()}</span>
      </div>

      {/* Actual Arc Reactor Core Visual representation */}
      <div className="relative w-64 h-64 flex items-center justify-center mt-6">
        
        {/* Outer glowing particle circle */}
        <div className={`absolute inset-0 rounded-full border border-dashed border-slate-700/40 p-4 transition-all duration-700 ${status === 'listening' ? 'border-red-500/20 scale-105' : ''}`} />

        {/* Orbit ring 1 - Rotates Clockwise slowly */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
          className="absolute w-52 h-52 border-2 border-dotted rounded-full opacity-60 pointer-events-none"
          style={{ borderColor: status === 'listening' ? '#f43f5e' : choice.accent, opacity: status === 'thinking' ? 0.9 : 0.4 }}
        />

        {/* Orbit ring 2 - Rotates Counter-Clockwise medium */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          className="absolute w-44 h-44 rounded-full border border-dashed border-spacing-2 pointer-events-none"
          style={{ borderColor: choice.accent, opacity: status === 'speaking' ? 0.8 : 0.3 }}
        />

        {/* Staggered rotating geometric ticks ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          className="absolute w-40 h-40 pointer-events-none opacity-40"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke={status === 'listening' ? '#ef4444' : choice.svgStreak}
              strokeWidth="1"
              strokeDasharray="4, 12, 16, 12"
              fill="none"
            />
          </svg>
        </motion.div>

        {/* Reactor Core Central Mesh Button */}
        <motion.button
          onClick={handleReactorClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`absolute z-10 w-28 h-28 rounded-full bg-slate-950 flex flex-col items-center justify-center cursor-pointer border-3 relative ${choice.glow} transition-all duration-500`}
          style={{ 
            borderColor: isMuted ? "#475569" : (status === 'listening' ? '#ef4444' : choice.accent),
          }}
        >
          {/* Internal rotating reactor mesh plates */}
          <motion.div 
            animate={{ rotate: status === 'thinking' ? -360 : 360 }}
            transition={{ repeat: Infinity, duration: status === 'thinking' ? 2 : 12, ease: "linear" }}
            className="absolute inset-0.5 rounded-full pointer-events-none opacity-20"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {[...Array(8)].map((_, i) => (
                <line
                  key={i}
                  x1="50"
                  y1="50"
                  x2={50 + 40 * Math.cos((i * Math.PI) / 4)}
                  y2={50 + 40 * Math.sin((i * Math.PI) / 4)}
                  stroke={choice.svgStreak}
                  strokeWidth="3"
                />
              ))}
            </svg>
          </motion.div>

          {/* Central state icon */}
          <div className="z-20 text-center flex flex-col items-center justify-center">
            {isMuted ? (
              <MicOff className="w-8 h-8 text-slate-500 animate-[pulse_1.5s_infinite]" />
            ) : status === 'listening' ? (
              <Mic className="w-8 h-8 text-rose-500 animate-ping absolute" />
            ) : status === 'thinking' ? (
              <Sparkles className="w-8 h-8 text-amber-500 animate-spin" />
            ) : (
              <Mic className={`w-8 h-8 ${choice.text}`} />
            )}

            {status === 'listening' && (
              <Mic className="w-8 h-8 text-rose-500 z-10" />
            )}

            <span className="text-[9px] font-mono tracking-widest mt-1 text-slate-400 font-bold uppercase">
              {isMuted ? "MUTED" : (status === 'listening' ? "RECORDING" : "TAP CORE")}
            </span>
          </div>

          {/* Dynamic volume expanding waves */}
          {status === 'speaking' && !isMuted && (
            <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-[ping_1.5s_infinite]" />
          )}

          {status === 'listening' && !isMuted && (
            <span className="absolute inset-0 rounded-full border border-rose-500/50 animate-[ping_1s_infinite]" />
          )}
        </motion.button>

        {/* Ambient Waveform Bars rotating in orbit around the core */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {[...Array(12)].map((_, idx) => {
            const angle = (idx * 360) / 12;
            const height = status === 'speaking' 
              ? Math.floor(Math.random() * 18 + 6) 
              : status === 'listening' 
                ? Math.floor(Math.random() * 22 + 8) 
                : 4;
            return (
              <div
                key={idx}
                className="absolute w-1 rounded-sm transition-all duration-150"
                style={{
                  transform: `rotate(${angle}deg) translateY(-64px)`,
                  height: `${height}px`,
                  backgroundColor: status === 'listening' ? '#f43f5e' : choice.accent,
                  opacity: status === 'idle' ? 0.2 : 0.8
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Voice Transcript Bubble Overlay */}
      {transcript && status === 'listening' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-3 bg-red-950/20 border border-red-500/20 rounded-xl max-w-sm text-center"
        >
          <span className="text-xs font-mono text-red-300 italic tracking-wide">
            " {transcript} ... "
          </span>
        </motion.div>
      )}

      {/* Core status summary readout */}
      <div className="mt-6 text-center z-10">
        <h3 className={`font-mono text-xs font-bold tracking-widest ${currentMeta.color}`}>
          {currentMeta.title}
        </h3>
        <p className="font-mono text-[10px] text-slate-400 tracking-wide mt-1">
          {currentMeta.subtitle}
        </p>
      </div>

      {/* Quick wake instructions */}
      <div className="mt-4 flex gap-2 items-center text-[10px] text-slate-500 font-mono">
        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">CLICK REACTOR CORE</span>
        <span>To toggle Voice Recognition</span>
      </div>
    </div>
  );
}
