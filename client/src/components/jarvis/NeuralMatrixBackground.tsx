import { useEffect, useRef } from "react";
import type { SystemState } from "./types";
import { STATE_RGB, STATE_SPEEDS, STATE_INTENSITY } from "./types";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  phase: number; phaseSpeed: number;
}

interface Pulse {
  from: number; to: number;
  t: number; speed: number;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function NeuralMatrixBackground({ state }: { state: SystemState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef(state);
  const colorRef  = useRef({ r: 133, g: 106, b: 30 }); // starts dim gold
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = 60;
    const MAX_D = 130;
    const GRID = 38;
    const particles: Particle[] = [];
    const pulses: Pulse[] = [];

    function spawn(w: number, h: number): Particle {
      const a = Math.random() * Math.PI * 2;
      const s = 0.1 + Math.random() * 0.3;
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: 0.7 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.006 + Math.random() * 0.014,
      };
    }

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particles.length = 0;
      for (let i = 0; i < N; i++) particles.push(spawn(canvas.width, canvas.height));
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf: number;
    let frame = 0;

    function tick() {
      frame++;
      const s         = stateRef.current;
      const target    = STATE_RGB[s];
      const intensity = STATE_INTENSITY[s];
      const c         = colorRef.current;
      c.r = lerp(c.r, target[0], 0.022);
      c.g = lerp(c.g, target[1], 0.022);
      c.b = lerp(c.b, target[2], 0.022);
      const [R, G, B] = [Math.round(c.r), Math.round(c.g), Math.round(c.b)];
      const speed = STATE_SPEEDS[s];
      const { width: W, height: H } = canvas;

      ctx.clearRect(0, 0, W, H);

      // Static dot grid
      for (let gx = 0; gx <= W; gx += GRID) {
        for (let gy = 0; gy <= H; gy += GRID) {
          ctx.beginPath();
          ctx.arc(gx, gy, 0.7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${R},${G},${B},${(0.1 * intensity).toFixed(3)})`;
          ctx.fill();
        }
      }

      // Horizontal grid lines (very faint)
      for (let gy = 0; gy <= H; gy += GRID) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.strokeStyle = `rgba(${R},${G},${B},${(0.04 * intensity).toFixed(3)})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // Move particles
      for (const p of particles) {
        p.x += p.vx * speed; p.y += p.vy * speed; p.phase += p.phaseSpeed;
        if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
        if (p.y < -8) p.y = H + 8; if (p.y > H + 8) p.y = -8;
      }

      // Spawn data pulses when active
      if ((s === "thinking" || s === "listening") && frame % 40 === 0) {
        const fi = Math.floor(Math.random() * N);
        let ti = -1, best = MAX_D;
        for (let j = 0; j < N; j++) {
          if (j === fi) continue;
          const dx = particles[fi].x - particles[j].x;
          const dy = particles[fi].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < best) { best = d; ti = j; }
        }
        if (ti >= 0) pulses.push({ from: fi, to: ti, t: 0, speed: 0.035 + Math.random() * 0.035 });
      }

      // Connections
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_D) {
            const a = ((1 - d / MAX_D) * 0.2 * intensity).toFixed(3);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${R},${G},${B},${a})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Data pulses
      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const p = pulses[pi];
        p.t += p.speed;
        if (p.t >= 1) { pulses.splice(pi, 1); continue; }
        const fx = particles[p.from].x, fy = particles[p.from].y;
        const tx = particles[p.to].x,   ty = particles[p.to].y;
        const px = lerp(fx, tx, p.t),   py = lerp(fy, ty, p.t);
        const fade = 1 - p.t;
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${R},${G},${B},${(fade * 0.95).toFixed(3)})`; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${R},${G},${B},${(fade * 0.25).toFixed(3)})`; ctx.fill();
      }

      // Nodes
      for (const p of particles) {
        const a = (0.18 + 0.5 * ((Math.sin(p.phase) + 1) / 2)) * intensity;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${R},${G},${B},${a.toFixed(3)})`; ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    }

    tick();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
