Confirmed. `GeniusHUD.tsx` is the live SVG-blob core: it already takes `levelRef`, runs a single `requestAnimationFrame` loop (`loop`), builds a Catmull-Rom blob path via `build(50, level, t, ...)` and writes it with `setAttribute('d', ...)` — exactly the integration seam. It uses an SVG `feTurbulence`-ish `#reactorGlow` filter and hardcodes color per-state (no accent uniform / no bands yet). `Admin.tsx` mounts it. That gives the precise plan:

---

## (5) Concrete file/component plan — GeniusHUD-style, rAF reading `levelRef`

**Verified seams in the live code:**
- `client/src/components/genius/GeniusHUD.tsx` — the real core. Single rAF `loop` at ~L81–89; writes the blob with `blobRef.current.setAttribute('d', build(50, level, t, ...))`; reads `levelRef?.current`; color is per-state `statusColor` (hardcoded `#D4AF37`), composited inside an `<svg viewBox="-120 -120 240 240">` with a `#reactorGlow` filter. **No bands, no accent prop, no canvas yet.**
- `client/src/components/genius/useReactorAudio.ts` — owns the `AnalyserNode` (`fftSize:512` → 256 bins) and writes one smoothed `levelRef`. Already fast-attack/slow-release. **Does not expose bins or bands.**
- `client/src/pages/Admin.tsx` — mounts `GeniusHUD`, owns `status` and the accent/theme color picker.
- `ArcReactor.tsx` is a *separate, older* gold HUD also imported by Admin — leave it or retire it; the level-10 work lands in `GeniusHUD`.

**What to add / replace (incremental, each step shippable):**

**Step 1 — Extend the audio hook to expose bands + peak (no renderer change yet).**
In `useReactorAudio.ts`, alongside `levelRef`, fill two more refs from the *same* `getByteFrequencyData` read (zero extra cost):
```ts
const bandsRef = useRef<[number,number,number]>([0,0,0]); // bass/mid/treble
const peakRef  = useRef(0);
// in tick(), after computing avg:
const n = data.length;                 // 256
const band = (lo:number, hi:number) => { let s=0; for (let i=lo;i<hi;i++) s+=data[i]; return s/(hi-lo)/255; };
const bass = band(0,16), mid = band(16,96), treble = band(96,n);
bandsRef.current = [
  bass   > bandsRef.current[0] ? bass   : bandsRef.current[0]*0.85 + bass*0.15,
  mid    > bandsRef.current[1] ? mid    : bandsRef.current[1]*0.85 + mid*0.15,
  treble > bandsRef.current[2] ? treble : bandsRef.current[2]*0.85 + treble*0.15,
];
// peak follower (fast up, slow down) on the existing level:
const lvl = levelRef.current;
peakRef.current = lvl > peakRef.current ? lvl : peakRef.current*0.90 + lvl*0.10;
```
Return `{ levelRef, bandsRef, peakRef, start, stop }`. **Keep this hook as the single analyser owner** — the WebGL loop reads these refs, it does *not* open its own analyser. This preserves your "read once/frame" rule.

**Step 2 — New WebGL component `ReactorCore.tsx` (the level-10 fill).**
`client/src/components/genius/ReactorCore.tsx`:
```tsx
export function ReactorCore(props: {
  levelRef: React.MutableRefObject<number>;
  bandsRef: React.MutableRefObject<[number,number,number]>;
  peakRef:  React.MutableRefObject<number>;
  accent: string;                 // hsl/hex from Admin's picker
  state: 'idle'|'listening'|'thinking'|'speaking';
  rainbow?: boolean;              // "rainbow while talking"
}) { /* mounts a <canvas>, owns one regl context + its own rAF */ }
```
- Owns a `<canvas>` absolutely positioned to fill the HUD's center box, **behind** the existing SVG (`z-index` below the `<svg>`, `mix-blend:screen` on the SVG so chrome glows through).
- One `regl` context. Build the passes from §2: glow halo, spores (instanced), plasma+metaball core, ping-pong tendril FBO, bloom+chromatic post. Shaders as plain template strings (no shader-loader needed).
- Its rAF reads `levelRef/bandsRef/peakRef.current` once, parses `accent` → HSL once, sets uniforms, draws. **No React state per frame.**
- `rainbow && state==='speaking'` → advance accent hue by `dt*speed` locally before setting `uAccent`.
- Cleanup: `regl.destroy()`, `cancelAnimationFrame`, drop GL context on unmount.

**Step 3 — Wire into `GeniusHUD.tsx`.**
- Accept new props: `bandsRef`, `peakRef`, `accent`, `state` (rename/forward existing `state`), `rainbow`.
- Render `<ReactorCore .../>` as the first child inside the existing center `<svg>`'s wrapper div (behind the SVG layer). **Keep the SVG blob** (`blobRef`) — it becomes the WebGL-absent fallback; hide it (`opacity:0` / not rendered) only when `ReactorCore` reports a successful GL init via an `onReady` callback. The Catmull-Rom `build()` loop stays as-is for fallback.
- Drive the existing SVG `statusColor` from the new `accent` prop instead of hardcoded gold, and apply CSS `hue-rotate` on the SVG chrome wrapper from the same accent so SVG + WebGL stay in lockstep.

**Step 4 — `Admin.tsx`.**
- Pull `bandsRef, peakRef` out of `useReactorAudio()` and pass them plus the existing accent/picker value and `rainbow` flag into `GeniusHUD`. No other changes — `status` already flows.

**New deps:** add `regl` only (`pnpm add regl`, ~10kb gz). No three.js. No shader build step. ~3 new files touched + 1 new component + 1 hook edit.

---

## (6) Perf guardrails + mobile / reduced-motion fallback

**Frame budget (one rAF, the existing one pattern):**
- Read analyser **once/frame** (already true; bands+peak piggyback on the same `getByteFrequencyData`). WebGL loop only reads refs — never re-reads the analyser.
- Canvas at `min(devicePixelRatio, 2)` desktop. Bloom FBO at **half-res**; tendril FBOs at **half-res**. ~6 draw calls total.
- Budget on M-class/mid-discrete: halo 0.3 + spores 0.5 + plasma 2.5 + tendrils 1.0 + bloom 1.5 ≈ **5.8ms**, leaving headroom under 16.6ms.
- Pause the WebGL rAF when `state==='idle'` **and** `document.hidden` (`visibilitychange`), and when the canvas is offscreen (`IntersectionObserver`) — saves battery during long admin sessions.

**Tiered fallback (React surface never branches — same component, internal tier):**
1. **Tier 3 (full):** all passes, DPR≤2, spores ~1200.
2. **Tier 2 (mobile / weak GPU):** detect via `WEBGL_debug_renderer_info` blocklist, `navigator.hardwareConcurrency < 4`, or any 3 sampled frames > 20ms → drop the bloom pass (replace with a cheap CSS `drop-shadow` glow on the canvas element), FBM 3→2 octaves, spores → 400, tendril FBO → quarter-res, DPR≤1.5.
3. **Tier 1 (no WebGL / `prefers-reduced-motion`):** don't mount the canvas at all; `GeniusHUD` keeps rendering its **existing SVG Catmull-Rom blob morphing to `levelRef`** (current shipped behavior) — graceful, never blank. `prefers-reduced-motion` also disables "rainbow while talking" (hue holds at the picked accent).

**Discipline that keeps it fast:** zero per-frame allocations in the WebGL loop (pre-allocate uniform objects, reuse typed arrays); spores/tendrils are GPU-side lifetime (no CPU particle loop); framer-motion stays on SVG chrome only and never animates layout; accent is a single uniform so theming/rainbow is one code path shared with the SVG `hue-rotate`.

**Reusability knob:** `<ReactorCore accent={...} />` — accent is the only brand input; spinning up a client variant is a one-line color change, and the same value re-themes the SVG chrome via `hue-rotate`. Ship as `<ReactorCore level bands peak accent state rainbow />`, props identical to what the blob already consumes — drop-in.

---

**Files referenced (all absolute):**
- `/Users/leescott/Desktop/photos/dumpster-web/client/src/components/genius/GeniusHUD.tsx` — live core; add `ReactorCore`, forward bands/peak/accent, keep SVG blob as Tier-1 fallback.
- `/Users/leescott/Desktop/photos/dumpster-web/client/src/components/genius/useReactorAudio.ts` — add `bandsRef` + `peakRef` off the existing analyser read.
- `/Users/leescott/Desktop/photos/dumpster-web/client/src/components/genius/ReactorCore.tsx` — **new** WebGL/regl component (all §2 layers).
- `/Users/leescott/Desktop/photos/dumpster-web/client/src/pages/Admin.tsx` — pass new refs + accent + rainbow into `GeniusHUD`.
- `/Users/leescott/Desktop/photos/dumpster-web/client/src/components/genius/ArcReactor.tsx` — older separate gold HUD; out of scope (retire or leave).
