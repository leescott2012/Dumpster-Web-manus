import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactorCore } from './ReactorCore';

interface HUDProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  isOnline: boolean;
  onTalk?: () => void;
  /** Live 0..1 mic amplitude that deforms the morphing core (optional). */
  levelRef?: React.MutableRefObject<number>;
  bandsRef?: React.MutableRefObject<[number, number, number]>;
  peakRef?: React.MutableRefObject<number>;
}

// Smooth closed blob path (Catmull-Rom -> cubic bezier) through control points.
function closedSpline(pts: [number, number][]): string {
  const n = pts.length;
  if (n < 3) return '';
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `;
  }
  return d + 'Z';
}

// Synthetic "breathing" so the core stays alive even without live mic input.
function stateBaseline(state: string, t: number): number {
  switch (state) {
    case 'listening': return 0.08 + 0.05 * Math.sin(t * 3);
    case 'thinking': return 0.28 + 0.16 * Math.abs(Math.sin(t * 4));
    case 'speaking': return 0.38 + 0.32 * Math.abs(Math.sin(t * 7.5));
    default: return 0.05 + 0.04 * Math.sin(t * 1.4);
  }
}

const BLOB_SEEDS = [0, 1.7, 3.4, 5.1, 6.8, 8.5, 10.2, 11.9, 13.6];

const GeniusHUD: React.FC<HUDProps> = ({ state, isOnline, onTalk, levelRef, bandsRef, peakRef }) => {
  const getStatusColor = () => {
    switch (state) {
      case 'listening': return '#D4AF37'; // Gold
      case 'thinking': return '#FFFFFF';
      case 'speaking': return '#D4AF37';
      default: return '#D4AF37';
    }
  };

  const statusColor = getStatusColor();

  // Refs read directly by the animation loop (no React re-renders per frame).
  const blobRef = useRef<SVGPathElement | null>(null);
  const auraRef = useRef<SVGPathElement | null>(null);
  const centerRef = useRef<SVGCircleElement | null>(null);
  const coreWrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const colorRef = useRef(statusColor);
  colorRef.current = statusColor;

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const N = BLOB_SEEDS.length;
    const build = (R: number, level: number, time: number, amp: number, phase: number): string => {
      const pts: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const wobble = 0.17 * Math.sin(time * 1.3 + BLOB_SEEDS[i] + phase) + 0.1 * Math.cos(time * 0.9 + BLOB_SEEDS[i] * 1.7);
        const r = R * (1 + wobble + level * amp * (0.55 + 0.45 * Math.sin(BLOB_SEEDS[i] + time * 2)));
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
      }
      return closedSpline(pts);
    };
    const loop = () => {
      t += 0.016;
      const live = levelRef?.current ?? 0;
      const level = Math.max(live, stateBaseline(stateRef.current, t));
      if (blobRef.current) blobRef.current.setAttribute('d', build(50, level, t, 0.6, 0));
      if (auraRef.current) auraRef.current.setAttribute('d', build(64, level, t * 0.85, 0.7, 1.6));
      if (centerRef.current) centerRef.current.setAttribute('r', (4 + level * 11).toFixed(2));
      if (coreWrapRef.current) coreWrapRef.current.style.filter = `drop-shadow(0 0 ${(12 + level * 46).toFixed(0)}px ${colorRef.current})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div className="relative w-full h-[600px] overflow-hidden bg-black flex items-center justify-center font-mono text-[#D4AF37]">
      {/* 3D Perspective Container */}
      <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '1000px' }}>
        
        {/* Holographic Hex Grid - Layer 1 (Deep) */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 0l25.98 15v30L30 60 4.02 45v-30z\' fill-opacity=\'0.1\' fill=\'%23D4AF37\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            backgroundSize: '60px 60px',
            transform: 'translateZ(-200px) rotateX(20deg)'
          }}
        />

        {/* Circular HUD Elements - Layer 2 (Mid) */}
        <div className="relative w-[500px] h-[500px] flex items-center justify-center" style={{ transform: 'translateZ(0px)' }}>
          
          {/* Outer Rotating Compass Ring */}
          <motion.div 
            className="absolute w-full h-full border-[1px] border-[#D4AF37] rounded-full opacity-10"
            style={{ borderStyle: 'double', borderWidth: '4px' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />

          {/* Scanning Lines Ring */}
          <motion.div 
            className="absolute w-[95%] h-[95%] border-[1px] border-[#D4AF37] rounded-full opacity-20"
            style={{ borderDasharray: '10 20' }}
            animate={{ rotate: -360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />

          {/* Technical Data Ring */}
          <div className="absolute w-[85%] h-[85%] rounded-full opacity-30 border border-[#D4AF37]/30">
            {[...Array(12)].map((_, i) => (
              <div 
                key={i}
                className="absolute w-full h-full"
                style={{ transform: `rotate(${i * 30}deg)` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-[#D4AF37]" />
                <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold">
                  {i * 30}°
                </div>
              </div>
            ))}
          </div>

          {/* Radar sweep */}
          <motion.div
            className="absolute w-[85%] h-[85%] rounded-full"
            style={{ background: 'conic-gradient(from 0deg, rgba(212,175,55,0) 0deg, rgba(212,175,55,0) 220deg, rgba(212,175,55,0.18) 320deg, rgba(212,175,55,0.55) 352deg, rgba(212,175,55,0) 360deg)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: state === 'idle' ? 6 : 2.2, repeat: Infinity, ease: 'linear' }}
          />

          {/* Orbiting energy sparks */}
          <motion.div
            className="absolute w-[78%] h-[78%]"
            animate={{ rotate: state === 'idle' ? 360 : -360 }}
            transition={{ duration: state === 'idle' ? 14 : 4, repeat: Infinity, ease: 'linear' }}
          >
            {[0, 72, 144, 216, 288].map((deg) => (
              <div key={deg} className="absolute top-1/2 left-1/2" style={{ transform: `rotate(${deg}deg) translateX(48%)` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" style={{ boxShadow: '0 0 10px 2px #D4AF37' }} />
              </div>
            ))}
          </motion.div>

          {/* Central morphing reactor core — deforms to live mic volume */}
          <div
            ref={coreWrapRef}
            className="relative z-10 flex items-center justify-center"
            style={{ cursor: onTalk && state === 'idle' ? 'pointer' : 'default' }}
            onClick={() => state === 'idle' && onTalk && onTalk()}
            title={state === 'idle' ? 'Click to speak to GENIUSS' : undefined}
          >
            {/* Ambient bloom behind the blob */}
            <motion.div
              className="absolute w-60 h-60 rounded-full blur-3xl"
              style={{ backgroundColor: `${statusColor}33` }}
              animate={{ opacity: state === 'idle' ? [0.25, 0.45, 0.25] : [0.5, 0.95, 0.5] }}
              transition={{ duration: state === 'idle' ? 3 : 1.1, repeat: Infinity }}
            />

            {levelRef && <ReactorCore levelRef={levelRef} bandsRef={bandsRef} peakRef={peakRef} state={state} />}

            <svg viewBox="-120 -120 240 240" className="w-[300px] h-[300px] overflow-visible">
              <defs>
                <radialGradient id="reactorFill" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="38%" stopColor={statusColor} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={statusColor} stopOpacity="0.04" />
                </radialGradient>
                <filter id="reactorGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* outer aura blob */}
              <path ref={auraRef} fill={statusColor} opacity={0.16} filter="url(#reactorGlow)" />
              {/* main morphing blob */}
              <path ref={blobRef} fill="url(#reactorFill)" stroke={statusColor} strokeWidth={1.3} filter="url(#reactorGlow)" />
              {/* bright reactive center */}
              <circle ref={centerRef} cx={0} cy={0} r={5} fill="#FFFFFF" />
            </svg>

            {/* State label overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={state}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  className="text-[10px] font-bold tracking-[0.3em] uppercase mix-blend-difference"
                >
                  {state}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Floating Data Widgets - Layer 3 (Front) */}
        <div className="absolute inset-0 pointer-events-none" style={{ transform: 'translateZ(50px)' }}>
          
          {/* Top Left: Bio-Metrics */}
          <div className="absolute top-10 left-10 w-48 p-4 border-l border-t border-[#D4AF37]/40 space-y-2">
            <div className="text-[9px] text-[#D4AF37]/60 uppercase tracking-widest">Neural Linkage</div>
            <div className="flex items-end gap-2">
              <div className="text-xl font-bold">98.4</div>
              <div className="text-[10px] pb-1 opacity-60">SYNC_RATE</div>
            </div>
            <div className="h-[2px] w-full bg-[#D4AF37]/10 overflow-hidden">
              <motion.div 
                className="h-full bg-[#D4AF37]" 
                animate={{ width: ['20%', '98%', '85%'] }}
                transition={{ duration: 5, repeat: Infinity }}
              />
            </div>
          </div>

          {/* Top Right: System Load */}
          <div className="absolute top-10 right-10 w-48 p-4 border-r border-t border-[#D4AF37]/40 text-right space-y-2">
            <div className="text-[9px] text-[#D4AF37]/60 uppercase tracking-widest">Power Core</div>
            <div className="flex items-end justify-end gap-2">
              <div className="text-xl font-bold">100%</div>
              <div className="text-[10px] pb-1 opacity-60">STABLE</div>
            </div>
            <div className="flex justify-end gap-1">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-2 h-1 bg-[#D4AF37]" />
              ))}
            </div>
          </div>

          {/* Bottom Left: Coordinates */}
          <div className="absolute bottom-20 left-10 text-[10px] space-y-1">
            <div className="flex gap-4">
              <span className="opacity-40">LAT:</span>
              <span>34.0194° N</span>
            </div>
            <div className="flex gap-4">
              <span className="opacity-40">LONG:</span>
              <span>118.4912° W</span>
            </div>
            <div className="pt-2 border-t border-[#D4AF37]/20">
              <span className="text-[8px] opacity-60">CHAMILLION_COLLECTIVE_INDUSTRIES_SECURE_LINK</span>
            </div>
          </div>

          {/* Bottom Right: Environment */}
          <div className="absolute bottom-20 right-10 text-[10px] text-right space-y-1">
            <div className="flex justify-end gap-4">
              <span>MALIBU_CA</span>
              <span className="opacity-40">LOC:</span>
            </div>
            <div className="flex justify-end gap-4">
              <span>72°F</span>
              <span className="opacity-40">TEMP:</span>
            </div>
            <div className="pt-2 border-t border-[#D4AF37]/20">
              <span className="text-[8px] opacity-60">ENVIRO_SCAN_V2.1</span>
            </div>
          </div>
        </div>

        {/* Perimeter HUD Markings */}
        <div className="absolute inset-4 border border-[#D4AF37]/10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1 bg-black border-x border-b border-[#D4AF37]/40 text-[9px] tracking-[0.5em]">
            MARK_LXXXV
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 px-4 py-1 bg-black border-x border-t border-[#D4AF37]/40 text-[9px] tracking-[0.5em]">
            SYSTEM_OVERRIDE_ACTIVE
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeniusHUD;
