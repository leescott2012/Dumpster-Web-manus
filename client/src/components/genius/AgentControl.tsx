import { useState, FormEvent } from "react";
import { Play, RotateCw, CheckCircle2, AlertTriangle, Cpu, Terminal, Sparkles, Volume2 } from "lucide-react";
import { Task } from "../types";
import { sfx } from "../utils/audioSynth";

interface AgentControlProps {
  onDeployAgent: (taskName: string, agentType: 'researcher' | 'coder' | 'social' | 'analyst') => Promise<void>;
  tasks: Task[];
  activeDeploying: boolean;
  themeColor: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
  onReadAloud: (text: string) => void;
}

export default function AgentControl({
  onDeployAgent,
  tasks,
  activeDeploying,
  themeColor,
  onReadAloud
}: AgentControlProps) {
  const [taskName, setTaskName] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<'researcher' | 'coder' | 'social' | 'analyst'>('researcher');

  const colorThemeMap = {
    'arc-blue': {
      text: "text-cyan-400",
      accentBg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      btnBg: "bg-cyan-600 hover:bg-cyan-500",
      accentText: "text-cyan-300"
    },
    'reactor-orange': {
      text: "text-amber-500",
      accentBg: "bg-amber-500/10",
      border: "border-amber-500/30",
      btnBg: "bg-amber-600 hover:bg-amber-500",
      accentText: "text-amber-300"
    },
    'matrix-green': {
      text: "text-emerald-400",
      accentBg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      btnBg: "bg-emerald-600 hover:bg-emerald-500",
      accentText: "text-emerald-300"
    },
    'crimson-alert': {
      text: "text-rose-500",
      accentBg: "bg-rose-500/10",
      border: "border-rose-500/30",
      btnBg: "bg-rose-600 hover:bg-rose-500",
      accentText: "text-rose-300"
    }
  };

  const choice = colorThemeMap[themeColor];

  const agentTemplates = [
    { type: 'researcher', name: "Research Sage V4", desc: "Indices and reports on topics", colorClass: "text-purple-400 border-purple-500/20 bg-purple-500/5 hover:border-purple-400/50" },
    { type: 'coder', name: "Code Scout Engine", desc: "Builds boilerplate and reviews syntax", colorClass: "text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-400/50" },
    { type: 'social', name: "Social Scribe Agent", desc: "Formulates marketing context", colorClass: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-400/50" },
    { type: 'analyst', name: "Oracle Market Analyst", desc: "Models spreadsheets and trends", colorClass: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/50" },
  ] as const;

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || activeDeploying) return;

    sfx.playScan();
    const taskText = taskName.trim();
    setTaskName("");
    await onDeployAgent(taskText, selectedAgent);
  };

  const handleReadSummary = (summaryText?: string) => {
    if (!summaryText) return;
    sfx.playBeep(800, 0.05);
    onReadAloud(summaryText);
  };

  return (
    <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 flex flex-col space-y-4" id="agent-workspace-dashboard">
      
      {/* Title block */}
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className={`w-5 h-5 ${choice.text}`} />
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200">Genius AUTONOMOUS AGENT CORE</h2>
            <p className="text-[10px] font-mono text-slate-500">Deploy background nodes to process real workloads</p>
          </div>
        </div>
        <div className="flex gap-1.5 text-[9px] font-mono px-2 py-1 bg-slate-950 border border-slate-850 rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mt-0.5"></span>
          <span className="text-slate-400">AGENTS_READY</span>
        </div>
      </div>

      {/* Task Creation Form */}
      <form onSubmit={handleFormSubmit} className="space-y-3">
        <div>
          <label className="block text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase mb-1">
            Task Description
          </label>
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            disabled={activeDeploying}
            placeholder="e.g. 'Synthesise market report for Tesla stock TSLA Q1'..."
            className="w-full bg-slate-950/80 border border-slate-850 focus:border-slate-700 outline-none text-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-mono placeholder:text-slate-600 transition-colors"
          />
        </div>

        {/* Agent Selectors */}
        <div>
          <label className="block text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase mb-1">
            Select specialized agent model subclass
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {agentTemplates.map((tpl) => {
              const isSelected = selectedAgent === tpl.type;
              return (
                <button
                  key={tpl.type}
                  type="button"
                  disabled={activeDeploying}
                  onClick={() => {
                    sfx.playBeep(440 + tpl.type.length * 40, 0.05);
                    setSelectedAgent(tpl.type);
                  }}
                  className={`p-3 border rounded-xl text-left cursor-pointer transition-all duration-200 ${tpl.colorClass} ${
                    isSelected 
                      ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-cyan-500/50 border-cyan-500/60' 
                      : 'opacity-60'
                  }`}
                >
                  <div className="text-[11px] font-mono font-bold">{tpl.name}</div>
                  <div className="text-[9px] font-sans text-slate-400 leading-tight mt-0.5">{tpl.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Deploy Button */}
        <button
          type="submit"
          disabled={activeDeploying || !taskName.trim()}
          className={`w-full py-2.5 rounded-xl font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${choice.btnBg} border border-transparent disabled:bg-slate-950 disabled:text-slate-600 disabled:border-slate-850 disabled:cursor-not-allowed`}
        >
          {activeDeploying ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>SPAWNING AGENT SYNAPSE...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>DEPLOY AUTOMATED WORKSPACE AGENT</span>
            </>
          )}
        </button>
      </form>

      {/* Deployments Monitor */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase">Active & Past Deployments</h3>
        {tasks.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-800 text-center rounded-xl font-mono text-[10px] text-slate-500">
            NO DEPLOYED NODES DETECTED IN THIS WORKSPACE SATELLITE
          </div>
        ) : (
          <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`p-4 bg-slate-950 border rounded-xl space-y-3 transition-all duration-500 ${
                  task.status === 'running' 
                    ? 'border-yellow-500/30 bg-yellow-500/5' 
                    : task.status === 'completed'
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-slate-850'
                }`}
              >
                {/* Header status info */}
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 font-bold uppercase rounded bg-slate-900 border border-slate-800 text-cyan-400">
                      {task.agentType === 'coder' ? 'CODE_SCOUT' : task.agentType === 'analyst' ? 'MARKET_ORACLE' : task.agentType === 'social' ? 'SCRIBE' : 'RESEARCH_SAGE'}
                    </span>
                    <h4 className="text-xs font-mono font-bold text-slate-200 mt-1">{task.name}</h4>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[9px]">
                    {task.status === 'running' && (
                      <span className="flex items-center gap-1 text-yellow-400 font-bold animate-pulse">
                        <RotateCw className="w-2.5 h-2.5 animate-spin" />
                        <span>PROCESSING</span>
                      </span>
                    )}
                    {task.status === 'completed' && (
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>SUCCESS</span>
                      </span>
                    )}
                    {task.status === 'failed' && (
                      <span className="flex items-center gap-1 text-rose-500 font-bold">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>FAILED</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* scrolling telemetry lines */}
                <div className="p-2 bg-slate-950 border border-slate-900/60 rounded-lg max-h-32 overflow-y-auto space-y-1 font-mono text-[9px]">
                  {task.logs.map((logStr, idx) => (
                    <div key={idx} className="text-slate-400 flex items-start gap-1">
                      <Terminal className="w-2.5 h-2.5 text-slate-600 mt-0.5 flex-shrink-0" />
                      <span className="whitespace-pre-wrap">{logStr}</span>
                    </div>
                  ))}
                </div>

                {/* Summary outcome display */}
                {task.status === 'completed' && task.summary && (
                  <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400">
                      <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse" />
                      <span>AGENT SYNOPSIS:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-normal font-sans tracking-wide">
                      {task.summary}
                    </p>
                    {/* Read summary aloud button */}
                    <button 
                      onClick={() => handleReadSummary(task.summary)}
                      className="mt-1 flex items-center gap-1.5 text-[9px] hover:text-cyan-400 text-slate-400 font-mono border border-slate-800/80 hover:border-cyan-500/30 bg-slate-950 px-2 py-1 rounded transition cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3 text-cyan-400" />
                      <span>READ RESULTS ALOUD</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
