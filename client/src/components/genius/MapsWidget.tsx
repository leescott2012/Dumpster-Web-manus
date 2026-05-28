import { useState, FormEvent } from "react";
import { Compass, Search, Globe, Link as LinkIcon, Radio } from "lucide-react";
import { sfx } from "../utils/audioSynth";

interface MapsWidgetProps {
  themeColor: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
  groundingSources: Array<{ uri: string; title: string }>;
}

export default function MapsWidget({
  themeColor,
  groundingSources
}: MapsWidgetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [targetName, setTargetName] = useState("Malibu Core Residence");
  const [coords, setCoords] = useState({ lat: 34.0259, lng: -118.7798, alt: 42 }); // Malibu mansion coordinates

  const colorThemeMap = {
    'arc-blue': {
      text: "text-cyan-400",
      accentBg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      btnBg: "bg-cyan-600 hover:bg-cyan-500",
      circleStroke: "stroke-cyan-500/20",
      beaconGlow: "bg-cyan-400 shadow-[0_0_12px_#22d3ee]",
      beamStreak: "bg-gradient-to-r from-cyan-500/0 via-cyan-400/20 to-cyan-500/0"
    },
    'reactor-orange': {
      text: "text-amber-500",
      accentBg: "bg-amber-500/10",
      border: "border-amber-500/30",
      btnBg: "bg-amber-600 hover:bg-amber-500",
      circleStroke: "stroke-amber-500/20",
      beaconGlow: "bg-amber-400 shadow-[0_0_12px_#f59e0b]",
      beamStreak: "bg-gradient-to-r from-amber-500/0 via-amber-400/20 to-amber-500/0"
    },
    'matrix-green': {
      text: "text-emerald-400",
      accentBg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      btnBg: "bg-emerald-600 hover:bg-emerald-500",
      circleStroke: "stroke-emerald-500/20",
      beaconGlow: "bg-emerald-400 shadow-[0_0_12px_#10b981]",
      beamStreak: "bg-gradient-to-r from-emerald-500/0 via-emerald-400/20 to-emerald-500/0"
    },
    'crimson-alert': {
      text: "text-rose-500",
      accentBg: "bg-rose-500/10",
      border: "border-rose-500/30",
      btnBg: "bg-rose-600 hover:bg-rose-500",
      circleStroke: "stroke-rose-500/20",
      beaconGlow: "bg-rose-400 shadow-[0_0_12px_#ef4444]",
      beamStreak: "bg-gradient-to-r from-rose-500/0 via-rose-400/20 to-rose-500/0"
    }
  };

  const choice = colorThemeMap[themeColor];

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    sfx.playScan();
    const query = searchQuery.trim();
    setTargetName(query);

    // Generate some interesting looking coordinates for searching locations
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      hash = query.charCodeAt(i) + ((hash << 5) - hash);
    }
    const derivedLat = Number(((hash % 180) - 90 + 0.123).toFixed(4));
    const derivedLng = Number((((hash * 31) % 360) - 180 + 0.567).toFixed(4));
    const derivedAlt = Math.abs(hash % 950);

    setCoords({ lat: derivedLat, lng: derivedLng, alt: derivedAlt });
    setSearchQuery("");
  };

  const triggerMalibuPreset = () => {
    sfx.playBeep(440, 0.05);
    setTargetName("Malibu Core Residence");
    setCoords({ lat: 34.0259, lng: -118.7798, alt: 42 });
  };

  const triggerChamillionCollectivePreset = () => {
    sfx.playBeep(520, 0.05);
    setTargetName("Chamillion Collective Tower NYC HQ");
    setCoords({ lat: 40.7580, lng: -73.9855, alt: 381 });
  };

  return (
    <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 space-y-4" id="satellite-intel-scout">
      
      {/* Header telemetry info */}
      <div className="flex items-center justify-between border-b border-slate-800/50 pb-3">
        <div className="flex items-center gap-2">
          <Globe className={`w-5 h-5 ${choice.text}`} />
          <div>
            <h2 className="text-sm font-mono font-bold text-slate-200">Genius SATELLITE scout</h2>
            <p className="text-[10px] font-mono text-slate-500">Orbital reconnaissance and strategic location targeting</p>
          </div>
        </div>
        <div className="flex gap-1 items-center bg-slate-950 px-2 py-0.5 border border-slate-850 rounded text-[9px] font-mono text-slate-500">
          <Radio className="w-2.5 h-2.5 animate-pulse text-rose-500" />
          <span>SYS_TE_GPS_ONLINE</span>
        </div>
      </div>

      {/* Target Search Form input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3.5 text-slate-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type reconnaissance location or landmark..."
            className="w-full bg-slate-950/80 border border-slate-850 text-slate-200 outline-none pl-9 pr-3 py-2 rounded-xl text-xs font-mono placeholder:text-slate-600 focus:border-slate-750 focus:ring-1 focus:ring-cyan-500/10 transition-all font-sans"
          />
        </div>
        <button
          type="submit"
          className={`px-3 py-2 rounded-xl font-mono text-xs uppercase cursor-pointer text-slate-550 border border-slate-800 bg-slate-950 hover:bg-slate-900 hover:text-white transition-all`}
        >
          Aim Radar
        </button>
      </form>

      {/* Main Radar Screen Visual graphic */}
      <div className="relative h-60 bg-slate-950 border border-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
        
        {/* Holographic scanner laser trace swipe */}
        <div className={`absolute top-0 bottom-0 w-24 opacity-25 animate-[pulse_1.5s_infinite] pointer-events-none ${choice.beamStreak}`} style={{ transform: 'skewX(-20deg) translateX(-150%)', animation: 'scanBeam 4s linear infinite' }} />

        {/* Circular Target Radar grids using SVG */}
        <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none opacity-50">
          {/* Circular concentric boundaries */}
          <circle cx="50%" cy="50%" r="20%" fill="none" className={choice.circleStroke} strokeWidth="1" />
          <circle cx="50%" cy="50%" r="40%" fill="none" className={choice.circleStroke} strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="50%" cy="50%" r="60%" fill="none" className={choice.circleStroke} strokeWidth="1" />
          <circle cx="50%" cy="50%" r="80%" fill="none" className={choice.circleStroke} strokeWidth="1" strokeDasharray="6 6" />

          {/* Sighting crosshairs */}
          <line x1="5%" y1="50%" x2="95%" y2="50%" className={choice.circleStroke} strokeWidth="1" />
          <line x1="50%" y1="5%" x2="50%" y2="95%" className={choice.circleStroke} strokeWidth="1" />

          {/* Compass indicators */}
          <text x="50%" y="12%" className="text-[8px] fill-slate-600 font-mono text-center" textAnchor="middle">000°_NORTH</text>
          <text x="50%" y="92%" className="text-[8px] fill-slate-600 font-mono text-center" textAnchor="middle">180°_SOUTH</text>
          <text x="94%" y="52%" className="text-[8px] fill-slate-600 font-mono text-center" textAnchor="middle">090°_EAST</text>
          <text x="6%" y="52%" className="text-[8px] fill-slate-600 font-mono text-center" textAnchor="middle">270°_WEST</text>
        </svg>

        {/* Tactical Crosshair Sighting Bracket */}
        <div className="absolute w-12 h-12 border border-rose-500/30 flex items-center justify-center animate-spin pointer-events-none" style={{ animationDuration: '40s' }}>
          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </div>

        {/* Active Target Point Beacon pulsing */}
        <div className="absolute top-1/2 left-1/2 flex items-center justify-center">
          <span className={`absolute flex h-5 w-5 rounded-full opacity-75 animate-[ping_1.5s_infinite] ${choice.beaconGlow}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${choice.beaconGlow.split(" ")[0]}`} />
        </div>

        {/* Dynamic coordinate readout in corner */}
        <div className="absolute top-3 left-3 bg-slate-950/90 border border-slate-900 p-2 rounded-lg font-mono text-[9px] text-slate-400 text-left space-y-0.5 pointer-events-none">
          <div className="font-bold text-slate-200">RADAR LOCK: ATTAINED</div>
          <div>TARGET: {targetName.toUpperCase()}</div>
          <div>LAT: {coords.lat > 0 ? `${coords.lat}° N` : `${Math.abs(coords.lat)}° S`}</div>
          <div>LNG: {coords.lng > 0 ? `${coords.lng}° E` : `${Math.abs(coords.lng)}° W`}</div>
          <div>ALT_COEFFICIENT: {coords.alt}M</div>
        </div>

        {/* Satellite status block right corner */}
        <div className="absolute bottom-3 right-3 bg-slate-950/90 border border-slate-900 p-2 rounded-lg font-mono text-[9px] text-slate-500 text-right pointer-events-none">
          <div>BAND: SECURE_K-BAND</div>
          <div>SIGNAL: 98.4% STABLE</div>
          <div className="text-emerald-500">RESOLVE: LOCK ACTIVE</div>
        </div>

        {/* Radar scope preset shortcuts */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 self-end">
          <button
            onClick={triggerMalibuPreset}
            className="text-[9px] font-mono px-2 py-1 bg-slate-950/90 border border-slate-900 hover:border-slate-750 text-slate-400 hover:text-white rounded cursor-pointer transition-all uppercase"
          >
            Home Base
          </button>
          <button
            onClick={triggerChamillionCollectivePreset}
            className="text-[9px] font-mono px-2 py-1 bg-slate-950/90 border border-slate-900 hover:border-slate-750 text-slate-400 hover:text-white rounded cursor-pointer transition-all uppercase"
          >
            Chamillion Collective Tower
          </button>
        </div>

      </div>

      {/* Real-world Grounding sources results links displayed when available */}
      {groundingSources && groundingSources.length > 0 && (
        <div className="p-3 bg-cyan-950/15 border border-cyan-500/20 rounded-xl space-y-2 text-left">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-cyan-400">
            <Compass className="w-3.5 h-3.5" />
            <span>REAL GOOGLE MAPS INTEL SOURCES:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10.5px]">
            {groundingSources.map((src, idx) => (
              <a
                key={idx}
                href={src.uri}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-slate-950/80 border border-slate-850 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 rounded-lg flex items-center justify-between font-sans transition-all leading-tight text-xs font-medium"
              >
                <span className="truncate pr-2">{src.title}</span>
                <LinkIcon className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Scan CSS animation definitions */}
      <style>{`
        @keyframes scanBeam {
          0% { transform: skewX(-20deg) translateX(-150%); }
          50% { transform: skewX(-20deg) translateX(150%); }
          100% { transform: skewX(-20deg) translateX(-150%); }
        }
      `}</style>

    </div>
  );
}
