import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HUDProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  isOnline: boolean;
}

const GeniusHUD: React.FC<HUDProps> = ({ state, isOnline }) => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (state) {
      case 'listening': return '#D4AF37'; // Gold
      case 'thinking': return '#FFFFFF';
      case 'speaking': return '#D4AF37';
      default: return '#D4AF37';
    }
  };

  const statusColor = getStatusColor();

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

          {/* Central Arc Reactor Core */}
          <div className="relative z-10 flex items-center justify-center">
            {/* Pulsing Core Glow */}
            <motion.div
              className="absolute w-40 h-40 rounded-full blur-2xl"
              style={{ backgroundColor: `${statusColor}22` }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            {/* Main Orb */}
            <motion.div
              className="relative w-32 h-32 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: `radial-gradient(circle, ${statusColor}33 0%, transparent 70%)`,
                border: `2px solid ${statusColor}66`,
                boxShadow: `0 0 20px ${statusColor}44`
              }}
              animate={{
                borderColor: state === 'listening' ? ['#D4AF3766', '#FFFFFF66', '#D4AF3766'] : '#D4AF3766'
              }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {/* Inner Rotating Tech Elements */}
              <motion.div 
                className="absolute inset-2 border border-[#D4AF37]/40 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#D4AF37] rounded-full" />
              </motion.div>

              {/* State Text */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={state}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  className="text-[10px] font-bold tracking-[0.3em] uppercase z-20"
                >
                  {state}
                </motion.div>
              </AnimatePresence>

              {/* Waveform Visualization (Speaking) */}
              {state === 'speaking' && (
                <div className="absolute bottom-4 flex gap-1 items-end h-8">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-[#D4AF37]"
                      animate={{ height: [4, 16, 4] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
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
