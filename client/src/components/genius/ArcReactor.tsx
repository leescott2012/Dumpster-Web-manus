import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ArcReactorProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  isOnline?: boolean;
  themeColor?: string; // Kept for compatibility but we default to Gold
}

const GOLD = "#D4AF37"; // Chamillion Collective Gold

const StarField = ({ count = 50, status }: { count?: number; status: string }) => {
  const stars = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      size: Math.random() * 2 + 0.5,
      radius: 40 + Math.random() * 80,
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
      delay: Math.random() * 2,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            width: star.size,
            height: star.size,
            boxShadow: `0 0 4px ${GOLD}`,
          }}
          animate={{
            x: [
              Math.cos(star.angle) * star.radius,
              Math.cos(star.angle + Math.PI) * star.radius,
              Math.cos(star.angle + Math.PI * 2) * star.radius,
            ],
            y: [
              Math.sin(star.angle) * star.radius,
              Math.sin(star.angle + Math.PI) * star.radius,
              Math.sin(star.angle + Math.PI * 2) * star.radius,
            ],
            opacity: [0.2, 0.8, 0.2],
            scale: status === 'speaking' ? [1, 1.8, 1] : [1, 1.2, 1],
          }}
          transition={{
            duration: 10 / Math.abs(star.speed * 100),
            repeat: Infinity,
            ease: "linear",
            delay: star.delay,
          }}
        />
      ))}
    </div>
  );
};

const OrbitalRing = ({ radius, duration, opacity = 0.2, reverse = false, status }: any) => {
  const isActive = status === 'speaking' || status === 'listening';
  
  return (
    <motion.div
      className="absolute rounded-full border border-dashed"
      style={{
        width: radius * 2,
        height: radius * 2,
        borderColor: GOLD,
        opacity: opacity,
        left: `calc(50% - ${radius}px)`,
        top: `calc(50% - ${radius}px)`,
      }}
      animate={{ 
        rotate: reverse ? -360 : 360,
        scale: isActive ? [1, 1.05, 1] : 1,
        opacity: isActive ? [opacity, opacity * 2, opacity] : opacity
      }}
      transition={{
        rotate: { duration, repeat: Infinity, ease: "linear" },
        scale: { duration: 0.5, repeat: Infinity },
        opacity: { duration: 0.5, repeat: Infinity }
      }}
    />
  );
};

export default function ArcReactor({ status, isOnline = true }: ArcReactorProps) {
  const isSpeaking = status === 'speaking';
  const isThinking = status === 'thinking';
  const isListening = status === 'listening';

  return (
    <div className="relative w-64 h-64 flex items-center justify-center bg-transparent overflow-hidden">
      {/* Background Star Field (Galaxy Effect) */}
      <StarField count={40} status={status} />

      {/* Outer Glow Nebula */}
      <motion.div
        className="absolute w-48 h-48 rounded-full"
        style={{
          background: `radial-gradient(circle, ${GOLD}22 0%, transparent 70%)`,
        }}
        animate={{
          scale: isSpeaking ? [1, 1.3, 1] : [1, 1.1, 1],
          opacity: isOnline ? [0.2, 0.4, 0.2] : 0.1,
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Orbital Rings (Galaxy Structure) */}
      <OrbitalRing radius={110} duration={25} opacity={0.05} status={status} />
      <OrbitalRing radius={90} duration={18} opacity={0.1} reverse status={status} />
      <OrbitalRing radius={70} duration={12} opacity={0.15} status={status} />

      {/* Main Reactor Body */}
      <div className="relative z-10 w-40 h-40 flex items-center justify-center">
        
        {/* Rotating Outer Frame with Tech Ticks */}
        <motion.div
          className="absolute inset-0 border-2 border-[#D4AF37]/20 rounded-full border-t-transparent border-b-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
        
        <motion.div
          className="absolute inset-4 border border-[#D4AF37]/40 rounded-full border-l-transparent border-r-transparent"
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner Pulsing Core */}
        <motion.div
          className="relative w-24 h-24 rounded-full flex items-center justify-center"
          style={{
            background: `radial-gradient(circle, ${GOLD}33 0%, transparent 80%)`,
            boxShadow: isOnline ? `0 0 40px ${GOLD}22` : 'none',
          }}
          animate={{
            scale: isSpeaking ? [1, 1.2, 1] : isListening ? [1, 1.1, 1] : 1,
          }}
          transition={{ duration: 0.4, repeat: isSpeaking || isListening ? Infinity : 0 }}
        >
          {/* The Singularity (Center Point) */}
          <motion.div
            className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-[#D4AF37]"
            style={{
              background: '#000',
              boxShadow: isOnline ? `inset 0 0 15px ${GOLD}44, 0 0 15px ${GOLD}44` : 'none',
            }}
          >
            <AnimatePresence mode="wait">
              {isSpeaking ? (
                <motion.div
                  key="speaking"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex gap-1 items-center"
                >
                  {[1, 2, 3, 2, 1].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-[#D4AF37]"
                      animate={{ height: [6, 18, 6] }}
                      transition={{ duration: 0.3, repeat: Infinity, delay: i * 0.05 }}
                    />
                  ))}
                </motion.div>
              ) : isThinking ? (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              ) : (
                <motion.div
                  key="idle"
                  className="w-3 h-3 rounded-full bg-[#D4AF37]"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </AnimatePresence>
          </motion.div>

          {/* Floating Data Nodes (Orbital Stars) */}
          {[0, 120, 240].map((angle, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-[#D4AF37]"
              style={{
                boxShadow: `0 0 8px ${GOLD}`,
              }}
              animate={{
                x: [
                  Math.cos((angle * Math.PI) / 180) * 35,
                  Math.cos(((angle + 120) * Math.PI) / 180) * 35,
                  Math.cos(((angle + 240) * Math.PI) / 180) * 35,
                  Math.cos(((angle + 360) * Math.PI) / 180) * 35,
                ],
                y: [
                  Math.sin((angle * Math.PI) / 180) * 35,
                  Math.sin(((angle + 120) * Math.PI) / 180) * 35,
                  Math.sin(((angle + 240) * Math.PI) / 180) * 35,
                  Math.sin(((angle + 360) * Math.PI) / 180) * 35,
                ],
                scale: isSpeaking ? [1, 1.5, 1] : 1,
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
