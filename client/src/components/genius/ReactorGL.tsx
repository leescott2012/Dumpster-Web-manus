import React, { useEffect, useRef } from "react";
import createREGL from "regl";

/**
 * Level-11 WebGL reactor core (regl, single fullscreen pass). A domain-warped
 * FBM plasma + a metaball heart + caustic veins + radial glow + an audio-peak
 * bloom flare, all in one fragment shader, additively blended over a transparent
 * canvas so it glows over the dark HUD. Drawn in gold so the parent's CSS
 * hue-rotate (color picker + rainbow) recolors it. Driven by refs from
 * useReactorAudio (level + bass/mid/treble + peak). If WebGL is unavailable it
 * calls onUnsupported() and the caller falls back to the Canvas2D core.
 */
interface Props {
  levelRef: React.MutableRefObject<number>;
  bandsRef?: React.MutableRefObject<[number, number, number]>;
  peakRef?: React.MutableRefObject<number>;
  state: "idle" | "listening" | "thinking" | "speaking";
  size?: number;
  onUnsupported?: () => void;
}

const FRAG = `
precision highp float;
uniform float uTime, uLevel, uBass, uMid, uTreble, uPeak;
uniform vec2 uRes;
uniform vec3 uAccent, uAccentHot;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
             mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y);
}
float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }

void main(){
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  uv.x *= uRes.x / uRes.y;
  float r = length(uv);
  float t = uTime;
  float lvl = uLevel;

  // Domain-warped plasma.
  vec2 q = uv * 1.6;
  vec2 warp = vec2(fbm(q + t*0.15), fbm(q + vec2(5.2,1.3) - t*0.12));
  float plasma = fbm(q + warp*(0.6 + 1.2*uBass) + t*0.10);

  // Metaball heart (center + 3 orbiters).
  float field = 0.0;
  for(int i=0;i<4;i++){
    float fi = float(i);
    float ang = t*(0.4 + fi*0.13) + fi*1.7;
    float orbit = (i==0) ? 0.0 : (0.18 + 0.22*uMid) * (0.6 + 0.4*sin(t + fi));
    vec2 c = vec2(cos(ang), sin(ang)) * orbit;
    float rr = (i==0 ? 0.34 : 0.18) * (1.0 + 0.5*lvl);
    vec2 d = uv - c;
    field += rr*rr / (dot(d,d) + 0.001);
  }
  float core = smoothstep(0.7, 1.7, field);

  // Caustic veins + radial glow. Tighter glow falloff so the core has a
  // defined edge instead of bleeding into a broad wash.
  float caust = pow(max(0.0, 1.0 - abs(plasma - 0.5)*2.0), 6.0);
  float glow = exp(-r * (3.6 - 1.3*lvl));
  float energy = clamp(core*0.85 + caust*0.5*core + glow*(0.24 + 0.5*lvl), 0.0, 1.35);

  // Hot nucleus — WARM GOLD (uAccentHot), not pure white, with a tight falloff
  // so the bright spot stays small and contained.
  float hot = exp(-r*22.0) * (0.30 + 0.55*lvl);
  vec3 col = mix(uAccent, uAccentHot, clamp(energy, 0.0, 1.0));
  col += uAccentHot * hot;
  col += uAccentHot * uPeak * glow * 0.5;
  col *= energy;

  // Filmic highlight roll-off: bright regions compress toward gold instead of
  // clipping to a white sun, so the plasma detail stays visible in the core.
  col = vec3(1.0) - exp(-col * 1.5);
  // Nudge saturation back up a touch (tone-mapping desaturates highlights).
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 1.18);

  // Alpha from brightness so the dark corners are TRANSPARENT (no opaque black
  // square over the HUD) — only the glowing plasma composites onto the radar.
  float alpha = clamp(max(col.r, max(col.g, col.b)) * 1.1, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

export function ReactorGL({ levelRef, bandsRef, peakRef, state, size = 340, onUnsupported }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let regl: ReturnType<typeof createREGL> | null = null;
    try {
      regl = createREGL({ canvas, attributes: { alpha: true, premultipliedAlpha: false, antialias: true, depth: false } });
    } catch (e) {
      console.warn("[reactor-gl] WebGL unavailable:", e);
      onUnsupported?.();
      return;
    }

    const cur = { uTime: 0, uLevel: 0, uBass: 0, uMid: 0, uTreble: 0, uPeak: 0, uRes: [canvas.width, canvas.height] as [number, number] };
    const draw = regl({
      vert: `precision highp float; attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`,
      frag: FRAG,
      attributes: { position: [[-1, -1], [3, -1], [-1, 3]] },
      count: 3,
      uniforms: {
        uTime: () => cur.uTime,
        uLevel: () => cur.uLevel,
        uBass: () => cur.uBass,
        uMid: () => cur.uMid,
        uTreble: () => cur.uTreble,
        uPeak: () => cur.uPeak,
        uRes: () => cur.uRes,
        uAccent: [0.55, 0.42, 0.12],
        uAccentHot: [1.0, 0.84, 0.46],
      },
      blend: { enable: true, func: { src: "one", dst: "one" } },
      depth: { enable: false },
    } as any);

    let raf = 0;
    let time = 0;
    const baseFor = (st: string) => (st === "speaking" ? 0.34 : st === "thinking" ? 0.22 : st === "listening" ? 0.06 : 0.04);

    const frame = () => {
      const lvl = levelRef?.current ?? 0;
      const [bass, mid, treble] = bandsRef?.current ?? [0, 0, 0];
      const peak = peakRef?.current ?? 0;
      const level = Math.max(lvl, baseFor(stateRef.current) + 0.03 * Math.sin(time * (stateRef.current === "speaking" ? 7 : 2)));
      cur.uTime = time; cur.uLevel = level; cur.uBass = bass; cur.uMid = mid; cur.uTreble = treble; cur.uPeak = peak;
      cur.uRes = [canvas.width, canvas.height];
      regl!.clear({ color: [0, 0, 0, 0], depth: 1 });
      draw();
      time += 0.016;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      } else if (!raf) {
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      try { regl?.destroy(); } catch { /* noop */ }
    };
  }, [size, levelRef, bandsRef, peakRef, onUnsupported]);

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
