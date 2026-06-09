import { useCallback, useEffect, useRef } from "react";

/**
 * Live microphone level for the reactor core. When listening starts, it opens a
 * mic stream + AudioContext AnalyserNode and continuously writes a smoothed
 * 0..1 amplitude into `levelRef`, which the HUD reads each animation frame to
 * deform the morphing blob — no React re-renders. Falls back silently (level 0)
 * if the mic is blocked; the HUD then uses its synthetic pulse.
 */
export function useReactorAudio() {
  const levelRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const tick = useCallback(() => {
    const a = analyserRef.current;
    const data = dataRef.current;
    if (a && data) {
      a.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255; // 0..1
      // Fast attack, slow release — punchy but smooth.
      levelRef.current = avg > levelRef.current ? avg : levelRef.current * 0.82 + avg * 0.18;
    } else {
      levelRef.current *= 0.9;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!ctxRef.current) {
        ctxRef.current = new Ctx();
        const a = ctxRef.current.createAnalyser();
        a.fftSize = 512;
        a.smoothingTimeConstant = 0.75;
        analyserRef.current = a;
        dataRef.current = new Uint8Array(a.frequencyBinCount);
      }
      if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      try { srcRef.current?.disconnect(); } catch { /* noop */ }
      const src = ctxRef.current.createMediaStreamSource(stream);
      src.connect(analyserRef.current!);
      srcRef.current = src;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.warn("[reactor-audio] mic unavailable:", e);
    }
  }, [tick]);

  const stop = useCallback(() => {
    try { srcRef.current?.disconnect(); } catch { /* noop */ }
    srcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    // Keep the rAF running so the level decays smoothly to 0.
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      try { srcRef.current?.disconnect(); } catch { /* noop */ }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try { ctxRef.current?.close(); } catch { /* noop */ }
    };
  }, []);

  return { levelRef, start, stop };
}
