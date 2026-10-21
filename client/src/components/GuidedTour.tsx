/**
 * GuidedTour — learn-by-doing walkthrough.
 * Dims the screen, rings the REAL control with a pulsing gold glow + arrow,
 * and waits for the user to tap it before moving on. Always has a Skip.
 * Mirrored natively in ios/DumpsterIOS/Views/SpotlightTutorialView.swift —
 * keep step order and copy identical.
 *
 * `swallow` steps: the tap is counted but not passed through (it would open a
 * sheet or create something mid-tour). Other steps let the tap work normally.
 */
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { IS_OWNER } from "@/lib/photoData";

var TOUR_KEY = "dumpster_tour_completed_v1";

interface TourStep {
  target: string;   // CSS selector
  title: string;
  body: string;
  swallow?: boolean;
  scroll?: boolean;
}

var STEPS: TourStep[] = [
  { target: "[data-tour='menu-btn']", title: "Menu", body: "Everything lives in the menu. Tap it." },
  { target: "[data-tour='menu-friends']", title: "Friends", body: "Find friends, peek at their dumps, leave comments.", swallow: true },
  { target: "[data-tour='menu-ai']", title: "AI Tools", body: "Your AI helpers live here. Tap to open." },
  { target: "[data-tour='tool-igscrub']", title: "Scrubs", body: "Pull photos and your style from an Instagram account.", swallow: true },
  { target: "[data-tour='dump-styles']", title: "Dump Styles", body: "Save named recipes so every dump comes out your way. Tap to look.", },
  { target: "[data-tour='menu-close']", title: "Close the menu", body: "Tap the X to head back." },
  { target: "[data-tour='dump-menu']", title: "Valet", body: "Your AI assistant. Tap the dots, then Valet, to reorder and set the vibe.", swallow: true, scroll: true },
  { target: ".photo-card", title: "Recycle", body: "Tap a photo's dots to swap it for a fresh one from your pool.", swallow: true, scroll: true },
  { target: "[data-tour='ai-suggest']", title: "Auto Gen", body: "One tap builds your best carousel from your pool.", swallow: true, scroll: true },
  { target: "[data-tour='new-dump']", title: "New Dump", body: "Start an empty dump and fill it yourself.", swallow: true, scroll: true },
  { target: "[data-tour='pool-section']", title: "The Pool", body: "Your unused photos wait here. Videos and captions have pools too. Tap it.", scroll: true },
];

var GOLD = "var(--accent)";

interface GuidedTourProps {
  active: boolean;
  onEnd: () => void;
}

export default function GuidedTour({ active, onEnd }: GuidedTourProps) {
  var [step, setStep] = useState(-1); // -1 = welcome card
  var [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  var [missing, setMissing] = useState(false);
  var stepRef = useRef(step);
  stepRef.current = step;

  useEffect(function () {
    if (active) { setStep(-1); setRect(null); }
  }, [active]);

  function finish() {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch (_) { /* noop */ }
    onEnd();
  }
  function begin() {
    setStep(0);
  }
  function advance() {
    if (stepRef.current >= STEPS.length - 1) finish();
    else setStep(stepRef.current + 1);
  }

  // Find, scroll to, and track the current target.
  useEffect(function () {
    if (!active || step < 0) return;
    var s = STEPS[step];
    setRect(null); setMissing(false);
    var scrolled = false;
    var started = Date.now();
    var t = setInterval(function () {
      var el = document.querySelector(s.target) as HTMLElement | null;
      if (!el) { if (Date.now() - started > 2500) setMissing(true); setRect(null); return; }
      if (s.scroll && !scrolled) { scrolled = true; el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      setMissing(false);
      setRect(function (p) {
        return p && Math.abs(p.x - r.left) < 1 && Math.abs(p.y - r.top) < 1 && Math.abs(p.w - r.width) < 1 && Math.abs(p.h - r.height) < 1
          ? p : { x: r.left, y: r.top, w: r.width, h: r.height };
      });
    }, 120);
    return function () { clearInterval(t); };
  }, [active, step]);

  // Wait for the tap on the real control.
  useEffect(function () {
    if (!active || step < 0) return;
    var s = STEPS[step];
    function onClick(e: MouseEvent) {
      var el = document.querySelector(s.target);
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
      if (s.swallow) { e.preventDefault(); e.stopPropagation(); }
      setTimeout(advance, 350);
    }
    document.addEventListener("click", onClick, true);
    return function () { document.removeEventListener("click", onClick, true); };
  }, [active, step]);

  if (!active || IS_OWNER) return null;

  var skip = (
    <button onClick={finish} aria-label="Skip tour" style={{
      position: "fixed", top: "calc(14px + env(safe-area-inset-top, 0px))", left: 14, zIndex: 10002, // left: right side holds the menu button the first step points at
      display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20,
      background: "rgba(20,20,20,0.9)", border: "1px solid #2a2a2a", color: "#ccc",
      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    }}>Skip <X size={13} /></button>
  );

  if (step < 0) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        {skip}
        <div style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 8 }}>Welcome to Dumpster</div>
          <div style={{ fontSize: 14, color: "#aaa", lineHeight: 1.6, marginBottom: 20 }}>
            A 1-minute tour. Tap the glowing spots to learn by doing.
          </div>
          <button onClick={begin} style={{ width: "100%", padding: "13px", borderRadius: 10, background: GOLD, border: "none", color: "#000", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            Start the tour
          </button>
        </div>
      </div>
    );
  }

  var s = STEPS[step];
  var vh = window.innerHeight, vw = window.innerWidth;
  var pad = 8;
  var hole = rect ? { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), w: rect.w + pad * 2, h: rect.h + pad * 2 } : null;
  var dim: React.CSSProperties = { position: "fixed", background: "rgba(0,0,0,0.8)", zIndex: 10000 };
  var targetInUpperHalf = hole ? hole.y + hole.h / 2 < vh / 2 : false;
  var cx = hole ? hole.x + hole.w / 2 : vw / 2;

  return (
    <>
      {/* Dim in four pieces so the hole passes taps through to the real control */}
      {hole ? (
        <>
          <div style={{ ...dim, left: 0, top: 0, width: "100%", height: hole.y }} />
          <div style={{ ...dim, left: 0, top: hole.y + hole.h, width: "100%", bottom: 0 }} />
          <div style={{ ...dim, left: 0, top: hole.y, width: hole.x, height: hole.h }} />
          <div style={{ ...dim, left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
        </>
      ) : (
        <div style={{ ...dim, inset: 0 }} />
      )}
      <style>{"@keyframes tourPulse{0%{box-shadow:0 0 0 0 rgba(var(--accent-rgb),.7),0 0 18px 4px rgba(var(--accent-rgb),.5)}70%{box-shadow:0 0 0 18px rgba(var(--accent-rgb),0),0 0 18px 4px rgba(var(--accent-rgb),.5)}100%{box-shadow:0 0 0 0 rgba(var(--accent-rgb),0),0 0 18px 4px rgba(var(--accent-rgb),.5)}}@keyframes tourBob{0%,100%{transform:translateY(0)}50%{transform:translateY(7px)}}"}</style>
      {hole && (
        <>
          <div style={{
            position: "fixed", left: hole.x, top: hole.y, width: hole.w, height: hole.h, zIndex: 10001,
            borderRadius: Math.min(hole.w, hole.h) > 60 ? 16 : 999, border: "2px solid " + GOLD,
            pointerEvents: "none", animation: "tourPulse 1.6s ease-out infinite",
          }} />
          <div style={{
            position: "fixed", left: cx - 12, zIndex: 10001, pointerEvents: "none", color: GOLD, fontSize: 26, lineHeight: "26px", width: 24, textAlign: "center",
            top: targetInUpperHalf ? Math.min(vh - 40, hole.y + hole.h + 6) : Math.max(4, hole.y - 32),
            animation: "tourBob 1s ease-in-out infinite",
            filter: "drop-shadow(0 0 6px rgba(var(--accent-rgb),.7))",
          }}>{targetInUpperHalf ? "▲" : "▼"}</div>
        </>
      )}
      {skip}
      <div style={{
        position: "fixed", zIndex: 10002, left: 16, right: 16, maxWidth: 360, margin: "0 auto",
        ...(targetInUpperHalf || !hole ? { bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" } : { top: "calc(64px + env(safe-area-inset-top, 0px))" }),
        background: "#141414", border: "1px solid #2a2a2a", borderRadius: 16, padding: "16px 18px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "#666", marginBottom: 6 }}>
          {"STEP " + (step + 1) + " OF " + STEPS.length}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{s.title}</div>
        <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.55 }}>{s.body}</div>
        {missing && (
          <button onClick={advance} style={{ marginTop: 12, padding: "9px 16px", borderRadius: 10, background: GOLD, border: "none", color: "#000", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            Next
          </button>
        )}
      </div>
    </>
  );
}

/** Check if tour was already completed */
export function isTourCompleted(): boolean {
  try { return localStorage.getItem(TOUR_KEY) === "1"; } catch (_) { return false; }
}

/** Reset tour so it can be shown again */
export function resetTour(): void {
  try { localStorage.removeItem(TOUR_KEY); } catch (_) { /* noop */ }
}
