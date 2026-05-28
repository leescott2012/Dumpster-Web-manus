import { useState, useEffect } from "react";
import { Gauge, ShieldAlert, Cpu, HardDrive, Wifi, Activity } from "lucide-react";
import { SystemMetrics } from "../types";

interface SystemWidgetProps {
  metrics: SystemMetrics;
  themeColor: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
}

export default function SystemWidget({
  metrics,
  themeColor
}: SystemWidgetProps) {
  const [internalMetrics, setInternalMetrics] = useState<SystemMetrics>(metrics);

  // Fluctuating values for aesthetic realism
  useEffect(() => {
    const timer = setInterval(() => {
      setInternalMetrics(prev => {
        const deltaTemp = (Math.random() - 0.5) * 1.5;
        const deltaCpu = (Math.random() - 0.5) * 12;
        const deltaMem = (Math.random() - 0.5) * 1.0;
        const deltaLatency = (Math.random() - 0.5) * 4;

        return {
          coreTemp: Math.min(110, Math.max(30, Number((prev.coreTemp + deltaTemp).toFixed(1)))),
          arcReactorPercent: Math.min(100, Math.max(90, Number((prev.arcReactorPercent + (Math.random() - 0.5) * 0.15).toFixed(2)))),
          cpuUsage: Math.min(100, Math.max(10, Math.round(prev.cpuUsage + deltaCpu))),
          memoryUsage: Math.min(100, Math.max(5, Number((prev.memoryUsage + deltaMem).toFixed(1)))),
          synapseLatency: Math.min(60, Math.max(5, Math.round(prev.synapseLatency + deltaLatency))),
          satelliteStatus: Math.random() > 0.98 ? 'syncing' : prev.satelliteStatus
        };
      });
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  const colorThemeMap = {
    'arc-blue': {
      text: "text-cyan-400",
      border: "border-cyan-500/30",
      accent: "#22d3ee",
      bgFill: "bg-cyan-500",
      bgFillAlpha: "bg-cyan-500/10",
      gaugeText: "text-cyan-300",
      glowClass: "shadow-[inset_0_0_12px_rgba(34,211,238,0.15)]"
    },
    'reactor-orange': {
      text: "text-amber-500",
      border: "border-amber-500/30",
      accent: "#f59e0b",
      bgFill: "bg-amber-500",
      bgFillAlpha: "bg-amber-500/10",
      gaugeText: "text-amber-400",
      glowClass: "shadow-[inset_0_0_12px_rgba(245,158,11,0.15)]"
    },
    'matrix-green': {
      text: "text-emerald-400",
      border: "border-emerald-400/30",
      accent: "#10b981",
      bgFill: "bg-emerald-500",
      bgFillAlpha: "bg-emerald-500/10",
      gaugeText: "text-emerald-300",
      glowClass: "shadow-[inset_0_0_12px_rgba(16,185,129,0.15)]"
    },
    'crimson-alert': {
      text: "text-rose-500",
      border: "border-rose-500/30",
      accent: "#ef4444",
      bgFill: "bg-rose-500",
      bgFillAlpha: "bg-rose-500/10",
      gaugeText: "text-rose-400",
      glowClass: "shadow-[inset_0_0_12px_rgba(239,68,68,0.15)]"
    }
  };

  const choice = colorThemeMap[themeColor];

  // Danger check for Temperature
  const isTempCritical = internalMetrics.coreTemp > 85;

  return (
    <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 space-y-4" id="system-hardware-monitoring">
      
      {/* Widget Header with Status logo */}
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
        <div className="flex items-center gap-2">
          <Activity className={`w-5 h-5 ${choice.text}`} />
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200">Genius CORE TELEMETRY</h2>
            <p className="text-[10px] font-mono text-slate-500">System metrics and subsystem diagnostics</p>
          </div>
        </div>
        <Wifi className="w-4 h-4 text-slate-500" />
      </div>

      {/* Grid of hardware gauges */}
      <div className="grid grid-cols-2 gap-4">
        
        {/* Core Temperature gauge */}
        <div className={`p-3.5 rounded-xl border border-slate-900 bg-slate-950/60 flex flex-col justify-between items-start relative overflow-hidden`}>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>Core Temperature</span>
          </div>

          <div className="my-2.5">
            <span className={`text-2xl font-mono font-black ${isTempCritical ? 'text-amber-500 animate-pulse' : choice.gaugeText}`}>
              {internalMetrics.coreTemp}°C
            </span>
            <div className="text-[8px] font-mono text-slate-600 mt-0.5">PEAK COEFF: 120.0C</div>
          </div>

          {/* Temperature status bar */}
          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isTempCritical ? 'bg-amber-500' : choice.bgFill}`} 
              style={{ width: `${Math.min(100, (internalMetrics.coreTemp / 120) * 100)}%` }}
            />
          </div>

          {isTempCritical && (
            <div className="absolute top-2 right-2 text-amber-500 text-[8px] font-mono font-bold flex items-center gap-0.5 uppercase">
              <ShieldAlert className="w-2.5 h-2.5" />
              <span>Overheat Risk</span>
            </div>
          )}
        </div>

        {/* Arc Reactor Level tracker */}
        <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/60 flex flex-col justify-between items-start relative">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span>Reactor Fuel</span>
          </div>

          <div className="my-2.5">
            <span className={`text-2xl font-mono font-black text-cyan-400`}>
              {internalMetrics.arcReactorPercent}%
            </span>
            <div className="text-[8px] font-mono text-slate-600 mt-0.5 font-bold text-cyan-300">CORE DECAY: CALIBRATED</div>
          </div>

          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-400 transition-all duration-300" 
              style={{ width: `${internalMetrics.arcReactorPercent}%` }}
            />
          </div>
        </div>

        {/* CPU Synapse Usage */}
        <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/60 flex flex-col justify-between items-start">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>Neural CPU Core</span>
          </div>

          <div className="my-2.5">
            <span className={`text-2xl font-mono font-black ${choice.gaugeText}`}>
              {internalMetrics.cpuUsage}%
            </span>
            <div className="text-[8px] font-mono text-slate-600 mt-0.5">8 ACTIVE THREADS</div>
          </div>

          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
            <div 
              className={`h-full ${choice.bgFill} transition-all duration-300`} 
              style={{ width: `${internalMetrics.cpuUsage}%` }}
            />
          </div>
        </div>

        {/* Cognitive Processing Synaptic Latency */}
        <div className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/60 flex flex-col justify-between items-start">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-none">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Synaptic Latency</span>
          </div>

          <div className="my-2.5">
            <span className="text-2xl font-mono font-black text-slate-100">
              {internalMetrics.synapseLatency} ms
            </span>
            <div className="text-[8px] font-mono text-slate-600 mt-0.5 uppercase">LINK: SATELLITE_A12</div>
          </div>

          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
            <div 
              className="h-full bg-slate-400 transition-all duration-300" 
              style={{ width: `${Math.min(100, (internalMetrics.synapseLatency / 60) * 100)}%` }}
            />
          </div>
        </div>

      </div>

      {/* Grid bottom: general system summaries */}
      <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900 overflow-hidden font-mono text-[9px] leading-relaxed text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>HOST PROTOCOL:</span>
          <span className="text-slate-300 uppercase">Secure Cloud Run Instance</span>
        </div>
        <div className="flex justify-between">
          <span>COGNITIVE MATRIX:</span>
          <span className="text-slate-300 uppercase">Gemini Generative Synapse v3.5</span>
        </div>
        <div className="flex justify-between">
          <span>SYS WORKSPACE VOLUME:</span>
          <span className="text-slate-400">STATELESS PERSISTENT (LOCALSTORAGE EXT)</span>
        </div>
      </div>

    </div>
  );
}
