/**
 * PhotoBackdrop — full-screen dimmed backdrop behind the sign-in / credits
 * sheets: the user's own pool photos slowly shuffle (cross-fade + gentle
 * zoom). Photos never leave the device. Falls back to a bundled photo when
 * the pool is empty (e.g. before first upload).
 */
import { useEffect, useMemo, useState } from "react";

const FALLBACK = ["/landing/hand-dark.jpg", "/landing/hand-up.jpg"];
const MAX = 10;
const INTERVAL_MS = 4500;

function shuffled<T>(a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function PhotoBackdrop({ photos, onClick }: { photos?: string[]; onClick?: () => void }) {
  const list = useMemo(() => {
    const own = (photos || []).filter(Boolean);
    return shuffled(own.length ? own : FALLBACK).slice(0, MAX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(photos || []).length]);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % list.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [list]);

  return (
    <div onClick={onClick} style={{ position: "fixed", inset: 0, zIndex: 600, background: "#050505", overflow: "hidden" }}>
      <style>{"@keyframes pbdZoom{from{transform:scale(1)}to{transform:scale(1.12)}}"}</style>
      {list.map((src, n) => (
        <img
          key={src + n}
          src={src}
          alt=""
          draggable={false}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            opacity: n === i ? 1 : 0, transition: "opacity 1.4s ease",
            animation: n === i ? `pbdZoom ${INTERVAL_MS + 1500}ms linear forwards` : "none",
          }}
        />
      ))}
      {/* dark scrim keeps the sheet readable and the house dark look */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.78))" }} />
    </div>
  );
}
