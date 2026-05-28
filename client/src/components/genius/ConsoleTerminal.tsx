import React, { useState, useEffect, useRef } from "react";
import { Terminal, Send, Shield, Zap } from "lucide-react";
import { sfx } from "../utils/audioSynth";

interface ConsoleTerminalProps {
  logs: string[];
  themeColor: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
  onManualCommand: (command: string) => void;
}

export default function ConsoleTerminal({
  logs,
  themeColor,
  onManualCommand
}: ConsoleTerminalProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Color mapping variables
  const colorThemeMap = {
    'arc-blue': {
      text: "text-cyan-400",
      accentBg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      outlineGlow: "focus-within:border-cyan-400/60 focus-within:ring-cyan-500/20",
      headerText: "text-cyan-200"
    },
    'reactor-orange': {
      text: "text-amber-500",
      accentBg: "bg-amber-500/10",
      border: "border-amber-500/30",
      outlineGlow: "focus-within:border-amber-500/60 focus-within:ring-amber-500/20",
      headerText: "text-amber-200"
    },
    'matrix-green': {
      text: "text-emerald-400",
      accentBg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      outlineGlow: "focus-within:border-emerald-500/60 focus-within:ring-emerald-500/20",
      headerText: "text-emerald-200"
    },
    'crimson-alert': {
      text: "text-rose-500",
      accentBg: "bg-rose-500/10",
      border: "border-rose-500/30",
      outlineGlow: "focus-within:border-rose-400/60 focus-within:ring-rose-500/20",
      headerText: "text-rose-200"
    }
  };

  const choice = colorThemeMap[themeColor];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    sfx.playBeep(700, 0.05);
    onManualCommand(inputValue.trim());
    setInputValue("");
  };

  const executeCommandHeader = (command: string) => {
    sfx.playBeep(700, 0.05);
    onManualCommand(command);
  };

  return (
    <div className="flex flex-col bg-slate-950/80 border border-slate-900 rounded-xl overflow-hidden shadow-2xl h-96 relative font-mono text-xs" id="console-terminal-logger">
      
      {/* Top Banner Status Bar */}
      <div className={`p-2.5 bg-slate-950 border-b border-slate-900 flex justify-between items-center text-[10px] tracking-widest ${choice.text}`}>
        <div className="flex items-center gap-1.5 font-bold">
          <Terminal className="w-3.5 h-3.5" />
          <span>Genius NEURAL TERMINAL CLR_v3.5</span>
        </div>
        <div className="flex gap-2 items-center text-slate-500">
          <span className="flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" />
            <span>PROTECT: HIGH_SEC</span>
          </span>
          <span className="flex items-center gap-1 text-emerald-500">
            <Zap className="w-2.5 h-2.5 animate-pulse" />
            <span>ARC_CORE: ACTIVE</span>
          </span>
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div 
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent text-slate-300"
      >
        <div className="text-[10px] text-slate-500 pb-2 border-b border-slate-900/40 font-mono">
          SYSTEM HARDWARE SYNAPSE COMMENCED AT {new Date().toLocaleDateString()}
          <br />
          MODEL RESOLUTION: GEMINI 3.5 FLASH COGNITIVE PIPELINE
        </div>

        {logs.map((log, index) => {
          // Color code logs depending on their tag
          let logColor = "text-slate-300";
          if (log.includes("[BOOT]") || log.includes("[INFO]")) {
            logColor = "text-slate-400";
          } else if (log.includes("[USER]")) {
            logColor = "text-yellow-400/90 font-semibold";
          } else if (log.includes("[Genius]") || log.includes("[SUCCESS]")) {
            logColor = "text-cyan-400";
          } else if (log.includes("[CRITICAL]") || log.includes("[FAIL]")) {
            logColor = "text-rose-500 font-bold";
          } else if (log.includes("[AGENT]")) {
            logColor = "text-purple-400";
          }

          return (
            <div key={index} className={`leading-relaxed text-[11px] whitespace-pre-wrap break-all ${logColor}`}>
              {log}
            </div>
          );
        })}
      </div>

      {/* Terminal Hot Commands */}
      <div className="p-2 bg-slate-950/90 border-t border-slate-900/60 flex flex-wrap gap-1.5 items-center">
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mr-1">Routines:</span>
        <button 
          onClick={() => executeCommandHeader("reactor diagnostics")}
          className="text-[10px] border border-slate-850 bg-slate-950 hover:bg-slate-900 hover:text-cyan-400 text-slate-400 px-2 py-0.5 rounded transition font-mono uppercase"
        >
          Diagnose Core
        </button>
        <button 
          onClick={() => executeCommandHeader("agent status")}
          className="text-[10px] border border-slate-850 bg-slate-950 hover:bg-slate-900 hover:text-cyan-400 text-slate-400 px-2 py-0.5 rounded transition font-mono uppercase"
        >
          Check Agents
        </button>
        <button 
          onClick={() => executeCommandHeader("weather update")}
          className="text-[10px] border border-slate-850 bg-slate-950 hover:bg-slate-900 hover:text-cyan-400 text-slate-400 px-2 py-0.5 rounded transition font-mono uppercase"
        >
          Climate Scouting
        </button>
        <button 
          onClick={() => executeCommandHeader("clear console")}
          className="text-[10px] border border-slate-850 bg-slate-950 hover:bg-slate-900 hover:text-cyan-400 text-slate-400 px-2 py-0.5 rounded transition font-mono uppercase"
        >
          Clear Logs
        </button>
      </div>

      {/* Holographic Input Command Bar */}
      <form 
        onSubmit={handleSubmit} 
        className={`p-2 bg-slate-950 border-t border-slate-900 flex items-center gap-2 transition-all duration-300 ${choice.outlineGlow} focus-within:ring-2`}
      >
        <span className={`font-mono text-bold ${choice.text}`}>$</span>
        <input 
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter override command, or type query to Genius..."
          className="flex-1 bg-transparent text-slate-200 outline-none placeholder-slate-600 pr-2 font-mono text-[11px]"
        />
        <button 
          type="submit"
          className={`p-1.5 rounded-lg hover:bg-slate-900 transition-colors ${choice.text}`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

    </div>
  );
}
