import React, { useEffect, useRef } from "react";

/**
 * Premium Canvas2D reactor core. Renders behind the crisp SVG blob outline and
 * paints a gooey metaball heart, caustic veins, a drifting spore field, audio-
 * peak bloom flares and a hot reactive center — all in gold (#D4AF37) so the
 * parent's CSS hue-rotate (color picker + "rainbow while talking") recolors it
 * in lockstep with the rest of the HUD. Driven entirely by refs from
 * useReactorAudio (level + bass/mid/treble + peak); no React re-renders.
 */
interface Props {
  levelRef: React.MutableRefObject<number>;
  bandsRef?: React.MutableRefObject<[number, number, number]>;
  peakRef?: React.MutableRefObject<number>;
  state: "idle" | "listening" | "thinking" | "speaking";
  size?: number;
}

const G = [212, 175, 55]; // gold base; recolored by parent hue-rotate

export function ReactorCore({ levelRef, bandsRef, peakRef, state, size = 340 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = size;
    canvas.width = S * dpr;
    canvas.height = S * dpr;
    ctx.scale(dpr, dpr);
    const cx = S / 2;
    const cy = S / 2;
    const rgb = (a: number) => `rgba(${G[0]},${G[1]},${G[2]},${a})`;

    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number };
    const parts: P[] = [];

    let raf = 0;
    let t = 0;
    let lastPeak = 0;
    const baseFor = (st: string) =>
      st === "speaking" ? 0.34 : st === "thinking" ? 0.22 : st === "listening" ? 0.06 : 0.04;

    const draw = () => {
      t += 0.016;
      const live = levelRef?.current ?? 0;
      const [bass, mid, treble] = bandsRef?.current ?? [0, 0, 0];
      const peak = peakRef?.current ?? 0;
      const st = stateRef.current;
      const level = Math.max(live, baseFor(st) + 0.03 * Math.sin(t * (st === "speaking" ? 7 : 2)));

      // Motion-trail fade.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(0, 0, S, S);

      ctx.globalCompositeOperation = "lighter";

      // Ambient halo.
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.5);
      halo.addColorStop(0, rgb(0.16 + 0.26 * level));
      halo.addColorStop(0.5, rgb(0.05 + 0.08 * level));
      halo.addColorStop(1, rgb(0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, S, S);

      // Metaball core — center + orbiting satellites merge under additive blend.
      const baseR = 40 * (1 + 0.5 * level);
      const balls = 5;
      for (let i = 0; i < balls; i++) {
        const ang = t * (0.5 + i * 0.12) + (i * Math.PI * 2) / balls;
        const orbit = i === 0 ? 0 : (12 + 20 * mid) * (0.6 + 0.4 * Math.sin(t * 1.3 + i));
        const bx = cx + Math.cos(ang) * orbit;
        const by = cy + Math.sin(ang) * orbit;
        const r = (i === 0 ? baseR : baseR * 0.55) * (1 + 0.4 * bass);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, `rgba(255,255,255,${0.65 * (0.5 + level)})`);
        g.addColorStop(0.32, rgb(0.55));
        g.addColorStop(1, rgb(0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Caustic veins (treble-driven light streaks).
      const veins = 6;
      for (let i = 0; i < veins; i++) {
        const a = (i / veins) * Math.PI * 2 + t * 0.6;
        const len = baseR * (1.3 + 1.7 * treble);
        const ex = cx + Math.cos(a) * len;
        const ey = cy + Math.sin(a) * len;
        const grad = ctx.createLinearGradient(cx, cy, ex, ey);
        grad.addColorStop(0, rgb(0));
        grad.addColorStop(0.5, rgb(0.12 + 0.4 * treble));
        grad.addColorStop(1, rgb(0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1 + 2 * treble;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // Spores — spawn with level, burst on audio peaks.
      const peakHit = peak > lastPeak + 0.06;
      lastPeak = peak;
      const spawn = Math.floor(level * 3) + (peakHit ? 14 : 0);
      for (let i = 0; i < spawn && parts.length < 220; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.4 + Math.random() * (1.4 + 3 * level);
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 40 + Math.random() * 50, r: 0.6 + Math.random() * 1.6 });
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++;
        const k = 1 - p.life / p.max;
        if (k <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        ctx.fillStyle = rgb(0.5 * k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bloom flare on peaks.
      if (peak > 0.5) {
        const fl = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.5 * peak);
        fl.addColorStop(0, `rgba(255,255,255,${0.22 * peak})`);
        fl.addColorStop(0.4, rgb(0.18 * peak));
        fl.addColorStop(1, rgb(0));
        ctx.fillStyle = fl;
        ctx.fillRect(0, 0, S, S);
      }

      // Hot reactive center.
      const cr = 9 + level * 22;
      const hot = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      hot.addColorStop(0, "rgba(255,255,255,0.85)");
      hot.addColorStop(1, rgb(0));
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onVis = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      } else if (!raf) {
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size, levelRef, bandsRef, peakRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        width: size,
        height: size,
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    />
  );
}
