import React from "react";
import { Sliders, Volume2, VolumeX, Shield, User, SlidersHorizontal, Radio } from "lucide-react";
import { GeniusSettings } from "../types";
import { sfx } from "../../lib/geniusAudio";

interface SettingsPanelProps {
  settings: GeniusSettings;
  onSettingsChange: (newSettings: GeniusSettings) => void;
  themeColor: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
}

export default function SettingsPanel({
  settings,
  onSettingsChange,
  themeColor
}: SettingsPanelProps) {

  const colorThemeMap = {
    'arc-blue': {
      text: "text-cyan-400",
      accentBg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      outlineGlow: "focus:border-cyan-400/60 focus:ring-cyan-500/10"
    },
    'reactor-orange': {
      text: "text-amber-500",
      accentBg: "bg-amber-500/10",
      border: "border-amber-500/30",
      outlineGlow: "focus:border-amber-500/60 focus:ring-amber-500/10"
    },
    'matrix-green': {
      text: "text-emerald-400",
      accentBg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      outlineGlow: "focus:border-emerald-400/60 focus:ring-emerald-500/10"
    },
    'crimson-alert': {
      text: "text-rose-500",
      accentBg: "bg-rose-500/10",
      border: "border-rose-500/30",
      outlineGlow: "focus:border-rose-400/60 focus:ring-rose-500/10"
    }
  };

  const choice = colorThemeMap[themeColor];

  // Specific theme button click handler
  const handleThemeClick = (theme: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert') => {
    sfx.playBeep(status === 'idle' ? 440 : 880, 0.08);
    onSettingsChange({ ...settings, colorTheme: theme });
  };

  // Generic settings field modification
  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, userName: e.target.value });
  };

  const handleCheckboxChange = (field: 'audioEnabled' | 'wakeWordActive') => {
    sfx.playBeep(600, 0.05);
    onSettingsChange({ ...settings, [field]: !settings[field] });
  };

  const handleVoicePitchChange = (pitch: 'Deep Butler' | 'High Tech Voice' | 'Robotic Guard' | 'Standard') => {
    sfx.playBeep(520, 0.05);
    onSettingsChange({ ...settings, voicePitch: pitch });
  };

  return (
    <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 space-y-4" id="settings-configuration-panel">
      
      {/* Settings Title Header */}
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className={`w-5 h-5 ${choice.text}`} />
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200">Genius CORE PREFERENCES</h2>
            <p className="text-[10px] font-mono text-slate-500">Fine tune voice synthesis, themes, and authorization tags</p>
          </div>
        </div>
        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
      </div>

      {/* Grid of details */}
      <div className="space-y-4">
        
        {/* User identification credentials */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>Authorized Username Tag</span>
          </label>
          <input 
            type="text"
            value={settings.userName}
            onChange={handleUserNameChange}
            placeholder="e.g. Sir, Commander, Sir..."
            className={`w-full bg-slate-950/80 border border-slate-850 text-slate-200 px-3 py-2 rounded-xl text-xs font-mono outline-none focus:ring-1 transition-all ${choice.outlineGlow}`}
          />
        </div>

        {/* Theme select panels */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Holographic HUD Accent Theme</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            
            {/* Blue theme */}
            <button
              onClick={() => handleThemeClick('arc-blue')}
              className={`py-2 border rounded-xl text-xs font-mono font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                settings.colorTheme === 'arc-blue' 
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30' 
                  : 'border-slate-850 hover:border-slate-700 bg-slate-950/40 text-slate-500'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block mb-1 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />
              <span className="text-[9px] uppercase tracking-wider">ARC CYAN</span>
            </button>

            {/* Amber Orange */}
            <button
              onClick={() => handleThemeClick('reactor-orange')}
              className={`py-2 border rounded-xl text-xs font-mono font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                settings.colorTheme === 'reactor-orange' 
                  ? 'border-amber-400 bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30' 
                  : 'border-slate-850 hover:border-slate-700 bg-slate-950/40 text-slate-500'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block mb-1 shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
              <span className="text-[9px] uppercase tracking-wider">CORE ORANGE</span>
            </button>

            {/* Green */}
            <button
              onClick={() => handleThemeClick('matrix-green')}
              className={`py-2 border rounded-xl text-xs font-mono font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                settings.colorTheme === 'matrix-green' 
                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30' 
                  : 'border-slate-850 hover:border-slate-700 bg-slate-950/40 text-slate-500'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block mb-1 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <span className="text-[9px] uppercase tracking-wider">MATRIX GREEN</span>
            </button>

            {/* Crimson alert */}
            <button
              onClick={() => handleThemeClick('crimson-alert')}
              className={`py-2 border rounded-xl text-xs font-mono font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                settings.colorTheme === 'crimson-alert' 
                  ? 'border-rose-400 bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30' 
                  : 'border-slate-850 hover:border-slate-700 bg-slate-950/40 text-slate-500'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block mb-1 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
              <span className="text-[9px] uppercase tracking-wider">CRIMSON DANGER</span>
            </button>

          </div>
        </div>

        {/* Binary triggers (audio feedback / wakeup keywords) */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Audio voice toggle */}
          <button
            type="button"
            onClick={() => handleCheckboxChange('audioEnabled')}
            className={`p-3 border rounded-xl flex items-center justify-between text-left cursor-pointer transition-all ${
              settings.audioEnabled 
                ? 'border-slate-850 bg-slate-950 text-slate-200' 
                : 'border-slate-900 bg-slate-950/25 text-slate-500'
            }`}
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase font-bold tracking-wider">Voice Synthesis</div>
              <div className="text-[8px] font-sans text-slate-400">Read Genius outputs aloud</div>
            </div>
            {settings.audioEnabled ? (
              <Volume2 className={`w-4 h-4 ${choice.text}`} />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Wake Word setup */}
          <button
            type="button"
            onClick={() => handleCheckboxChange('wakeWordActive')}
            className={`p-3 border rounded-xl flex items-center justify-between text-left cursor-pointer transition-all ${
              settings.wakeWordActive 
                ? 'border-slate-850 bg-slate-950 text-slate-200' 
                : 'border-slate-900 bg-slate-950/25 text-slate-500'
            }`}
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase font-bold tracking-wider">Trigger Word</div>
              <div className="text-[8px] font-sans text-slate-400">Speak "Genius" to wake system</div>
            </div>
            <Radio className={`w-4 h-4 ${settings.wakeWordActive ? choice.text : 'text-slate-500'}`} />
          </button>

        </div>

        {/* Synthesizer audio voices profiles config */}
        {settings.audioEnabled && (
          <div className="space-y-2 pt-2 border-t border-slate-900/60 transition-all duration-300">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Voice Synthesis pitch/rate style modulation
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "Standard", name: "British Butler (Def)" },
                { id: "Deep Butler", name: "Slightly Deeper (Classic Genius)" },
                { id: "High Tech Voice", name: "Friday Synth (AI Mod)" },
                { id: "Robotic Guard", name: "Droning Sentry (Ultra Low Pitch)" }
              ].map((vc) => (
                <button
                  key={vc.id}
                  onClick={() => handleVoicePitchChange(vc.id as any)}
                  className={`p-2 border rounded-lg text-left text-[10px] font-mono cursor-pointer transition-all hover:bg-slate-950/60 ${
                    settings.voicePitch === vc.id
                      ? `border-cyan-500/40 bg-cyan-500/10 text-cyan-400 font-bold`
                      : 'border-slate-900 text-slate-400 bg-slate-950/20'
                  }`}
                >
                  {vc.name}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
