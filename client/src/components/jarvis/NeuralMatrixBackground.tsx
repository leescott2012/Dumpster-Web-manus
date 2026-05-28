import { useEffect, useRef } from "react";
import type { SystemState } from "./types";
import { STATE_RGB, STATE_SPEEDS } from "./types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  phaseSpeed: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function NeuralMatrixBackground({ state }: { state: SystemState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const colorRef = useRef({ r: 200, g: 169, b: 110 });

  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = 55;
    const MAX_DIST = 140;
    const particles: Particle[] = [];

    function spawn(w: number, h: number): Particle {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.15 + Math.random() * 0.35;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: 0.8 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.008 + Math.random() * 0.016,
      };
    }

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particles.length = 0;
      for (let i = 0; i < N; i++) {
        particles.push(spawn(canvas.width, canvas.height));
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf: number;

    function frame() {
      const s = stateRef.current;
      const target = STATE_RGB[s];
      const c = colorRef.current;
      c.r = lerp(c.r, target[0], 0.025);
      c.g = lerp(c.g, target[1], 0.025);
      c.b = lerp(c.b, target[2], 0.025);
      const r = Math.round(c.r);
      const g = Math.round(c.g);
      const b = Math.round(c.b);

      const speed = STATE_SPEEDS[s];
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        p.phase += p.phaseSpeed;
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        if (p.y < -8) p.y = h + 8;
        if (p.y > h + 8) p.y = -8;
      }

      // connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.22;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // nodes
      for (const p of particles) {
        const alpha = 0.2 + 0.5 * ((Math.sin(p.phase) + 1) / 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
