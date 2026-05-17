/**
 * GuidedTour — interactive step-by-step walkthrough.
 * Highlights UI elements with a spotlight, shows tooltip with step info,
 * auto-scrolls to each target, and tracks completion in localStorage.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronRight, ChevronLeft, X, Sparkles, ArrowUpDown, Plus, Type, MessageCircle, Upload, User } from "lucide-react";
import { IS_OWNER } from "@/lib/photoData";

var TOUR_KEY = "dumpster_tour_completed_v1";

// ── Tour step definition ──────────────────────────────────────────────────

interface TourStep {
  target: string;            // data-tour attribute value or CSS selector
  title: string;
  body: string;
  icon: typeof Sparkles;
  iconColor: string;
  position: "top" | "bottom" | "left" | "right";
  scrollTo?: boolean;        // auto-scroll to element (default true)
}

var STEPS: TourStep[] = [
  {
    target: "[data-tour='dump-1']",
    title: "Your Dumps",
    body: "Each dump is an Instagram carousel. Photos play left to right. You have 3 demo dumps to start with.",
    icon: ArrowUpDown,
    iconColor: "var(--accent)",
    position: "bottom",
    scrollTo: true,
  },
  {
    target: "[data-photo-id='stock-01']",
    title: "Tap to Select",
    body: "Tap any photo to highlight it. Then tap the ... dots in the corner for options like favorite, remove, or recycle.",
    icon: Sparkles,
    iconColor: "var(--accent)",
    position: "bottom",
  },
  {
    target: "[data-tour='plus-card']",
    title: "Add Photos",
    body: "Tap the + card to add photos from your pool into this dump. You can also hold and drag photos between dumps.",
    icon: Plus,
    iconColor: "#4ade80",
    position: "left",
  },
  {
    target: "[data-tour='dump-menu']",
    title: "Dump Actions",
    body: "Tap ... to open the action menu. Chat with AI about your dump, generate captions, export, rate it, or delete.",
    icon: MessageCircle,
    iconColor: "#a78bfa",
    position: "bottom",
  },
  {
    target: "[data-tour='ai-suggest']",
    title: "AI Suggest",
    body: "Let AI analyze your pool photos and automatically group them into carousel dumps based on vibe, color, and theme.",
    icon: Sparkles,
    iconColor: "var(--accent)",
    position: "bottom",
  },
  {
    target: "[data-tour='new-dump']",
    title: "Create Dumps",
    body: "Start a fresh empty dump and build your carousel from scratch by adding photos from the pool.",
    icon: Plus,
    iconColor: "var(--accent)",
    position: "bottom",
  },
  {
    target: "#photo-pool",
    title: "The Pool",
    body: "All your unused photos live here. Drag them into dumps, or let AI sort them. You can also switch to the Caption tab.",
    icon: Type,
    iconColor: "#4ade80",
    position: "top",
    scrollTo: true,
  },
  {
    target: "[data-tour='upload-card']",
    title: "Upload Your Photos",
    body: "Add your own photos and videos here. Once uploaded, use AI Suggest to auto-create your carousels.",
    icon: Upload,
    iconColor: "var(--accent)",
    position: "left",
  },
  {
    target: "[data-tour='sign-in']",
    title: "Sign In for More",
    body: "Create a free account to save your work, get 15 daily AI credits, and unlock Pro features.",
    icon: User,
    iconColor: "#a78bfa",
    position: "bottom",
    scrollTo: true,
  },
];

// ── Component ─────────────────────────────────────────────────────────────

interface GuidedTourProps {
  active: boolean;
  onEnd: () => void;
}

export default function GuidedTour({ active, onEnd }: GuidedTourProps) {
  var [step, setStep] = useState(0);
  var [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  var [leaving, setLeaving] = useState(false);
  var resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measure and scroll to current target
  var measureTarget = useCallback(function() {
    if (!active) return;
    var s = STEPS[step];
    if (!s) return;
    var el = document.querySelector(s.target) as HTMLElement | null;
    if (!el) { setTargetRect(null); return; }
    if (s.scrollTo !== false) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Delay measurement to let scroll finish
    setTimeout(function() {
      var el2 = document.querySelector(s.target) as HTMLElement | null;
      if (!el2) return;
      var rect = el2.getBoundingClientRect();
      // If element is still off-viewport (scroll not finished), do instant scroll + re-measure
      if (rect.top > window.innerHeight || rect.bottom < 0) {
        el2.scrollIntoView({ behavior: "instant", block: "center" });
        setTimeout(function() {
          var el3 = document.querySelector(s.target) as HTMLElement | null;
          if (el3) setTargetRect(el3.getBoundingClientRect());
        }, 100);
      } else {
        setTargetRect(rect);
      }
    }, 600);
  }, [active, step]);

  useEffect(function() { measureTarget(); }, [measureTarget]);

  // Re-measure on resize/scroll
  useEffect(function() {
    if (!active) return;
    var handleResize = function() {
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(measureTarget, 200);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return function() {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
    };
  }, [active, measureTarget]);

  var finish = useCallback(function() {
    setLeaving(true);
    try { localStorage.setItem(TOUR_KEY, "1"); } catch (_) { /* noop */ }
    setTimeout(function() { setLeaving(false); onEnd(); }, 350);
  }, [onEnd]);

  var next = useCallback(function() {
    if (step >= STEPS.length - 1) { finish(); return; }
    setStep(function(s) { return s + 1; });
  }, [step, finish]);

  var prev = useCallback(function() {
    setStep(function(s) { return Math.max(0, s - 1); });
  }, []);

  if (!active || IS_OWNER) return null;

  var current = STEPS[step];
  if (!current) return null;
  var Icon = current.icon;

  // Tooltip positioning — always clamped to viewport
  var tooltip = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } as Record<string, string>;
  var arrowStyle = {} as Record<string, string>;
  var showArrow = false;

  if (targetRect) {
    var pad = 16;
    var tooltipW = 320;
    var tooltipH = 220;
    var vh = window.innerHeight;
    var vw = window.innerWidth;

    // Center x of the target element
    var cx = targetRect.left + targetRect.width / 2;
    var cy = targetRect.top + targetRect.height / 2;
    var leftX = Math.max(pad, Math.min(vw - tooltipW - pad, cx - tooltipW / 2));

    // Try preferred position, fall back if it would go off-screen
    var pos = current.position;
    if (pos === "bottom" && targetRect.bottom + pad + tooltipH > vh) pos = "top";
    if (pos === "top" && targetRect.top - pad - tooltipH < 0) pos = "bottom";

    // For very tall elements, anchor tooltip to the visible center of the screen
    var elementTooTall = targetRect.height > vh * 0.6;

    if (elementTooTall) {
      // Float tooltip in the visible center-right area
      tooltip = {
        top: Math.max(pad, Math.min(vh - tooltipH - pad, vh / 2 - tooltipH / 2)) + "px",
        left: Math.max(pad, Math.min(vw - tooltipW - pad, vw / 2 - tooltipW / 2)) + "px",
        transform: "none",
      };
      showArrow = false;
    } else if (pos === "bottom") {
      var topVal = Math.min(vh - tooltipH - pad, targetRect.bottom + pad);
      tooltip = { top: topVal + "px", left: leftX + "px", transform: "none" };
      showArrow = true;
      arrowStyle = {
        position: "absolute", top: "-6px",
        left: Math.min(tooltipW - 24, Math.max(12, cx - leftX)) + "px",
        width: "12px", height: "6px", background: "#141414",
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      };
    } else if (pos === "top") {
      var topVal2 = Math.max(pad, targetRect.top - tooltipH - pad);
      tooltip = { top: topVal2 + "px", left: leftX + "px", transform: "none" };
      showArrow = true;
      arrowStyle = {
        position: "absolute", bottom: "-6px",
        left: Math.min(tooltipW - 24, Math.max(12, cx - leftX)) + "px",
        width: "12px", height: "6px", background: "#141414",
        clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)",
      };
    } else if (pos === "left") {
      var topVal3 = Math.max(pad, Math.min(vh - tooltipH - pad, cy - tooltipH / 2));
      tooltip = { top: topVal3 + "px", left: Math.max(pad, targetRect.left - tooltipW - pad) + "px", transform: "none" };
      showArrow = true;
      arrowStyle = {
        position: "absolute", right: "-6px",
        top: Math.min(tooltipH - 24, Math.max(12, cy - topVal3)) + "px",
        width: "6px", height: "12px", background: "#141414",
        clipPath: "polygon(0% 0%, 100% 50%, 0% 100%)",
      };
    } else {
      var topVal4 = Math.max(pad, Math.min(vh - tooltipH - pad, cy - tooltipH / 2));
      tooltip = { top: topVal4 + "px", left: Math.min(vw - tooltipW - pad, targetRect.right + pad) + "px", transform: "none" };
      showArrow = true;
      arrowStyle = {
        position: "absolute", left: "-6px",
        top: Math.min(tooltipH - 24, Math.max(12, cy - topVal4)) + "px",
        width: "6px", height: "12px", background: "#141414",
        clipPath: "polygon(100% 0%, 0% 50%, 100% 100%)",
      };
    }

    // Final viewport clamp — ensure tooltip never goes off-screen
    var parsedTop = parseFloat(tooltip.top);
    if (!isNaN(parsedTop)) {
      if (parsedTop < pad) tooltip.top = pad + "px";
      if (parsedTop > vh - tooltipH - pad) tooltip.top = (vh - tooltipH - pad) + "px";
    }
    var parsedLeft = parseFloat(tooltip.left);
    if (!isNaN(parsedLeft)) {
      if (parsedLeft < pad) tooltip.left = pad + "px";
      if (parsedLeft > vw - tooltipW - pad) tooltip.left = (vw - tooltipW - pad) + "px";
    }
  }

  // Spotlight cutout dimensions
  var spot = targetRect ? {
    x: targetRect.left - 8,
    y: targetRect.top - 8,
    w: targetRect.width + 16,
    h: targetRect.height + 16,
    r: 14,
  } : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      opacity: leaving ? 0 : 1, transition: "opacity 0.35s",
      pointerEvents: leaving ? "none" : "auto",
    }}>
      {/* SVG overlay with spotlight cutout */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} onClick={function(e) { e.stopPropagation(); }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.x} y={spot.y} width={spot.w} height={spot.h}
                rx={spot.r} ry={spot.r} fill="black"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tour-mask)" />
        {/* Spotlight glow ring */}
        {spot && (
          <rect
            x={spot.x} y={spot.y} width={spot.w} height={spot.h}
            rx={spot.r} ry={spot.r}
            fill="none" stroke="var(--accent)" strokeWidth="2"
            style={{ filter: "drop-shadow(0 0 12px rgba(var(--accent-rgb),0.5))" }}
          />
        )}
      </svg>

      {/* Close button */}
      <button onClick={finish} style={{
        position: "fixed", top: 16, right: 16, zIndex: 10001,
        width: 36, height: 36, borderRadius: "50%",
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "#888",
      }}>
        <X size={16} />
      </button>

      {/* Tooltip card */}
      <div style={{
        position: "fixed", zIndex: 10001,
        width: 320,
        ...tooltip,
        background: "#141414", border: "1px solid #2a2a2a",
        borderRadius: 16, padding: "20px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
      }}>
        {/* Arrow */}
        {targetRect && showArrow && <div style={arrowStyle} />}

        {/* Step counter */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "rgba(var(--accent-rgb),0.1)",
              border: "1px solid rgba(var(--accent-rgb),0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={14} color={current.iconColor} />
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
              color: "#555", textTransform: "uppercase" as const,
            }}>
              {"Step " + (step + 1) + " of " + STEPS.length}
            </span>
          </div>
          <button onClick={finish} style={{
            background: "none", border: "none", color: "#555",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
            padding: "2px 6px",
          }}>
            Skip
          </button>
        </div>

        {/* Title */}
        <div style={{
          fontSize: 16, fontWeight: 800, color: "#fff",
          letterSpacing: "-0.02em", marginBottom: 6,
        }}>
          {current.title}
        </div>

        {/* Body */}
        <div style={{
          fontSize: 13, color: "#999", lineHeight: 1.65,
          marginBottom: 18,
        }}>
          {current.body}
        </div>

        {/* Progress dots */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          marginBottom: 16,
        }}>
          {STEPS.map(function(_, i) {
            return (
              <div key={i} style={{
                width: i === step ? 18 : 6, height: 6,
                borderRadius: 3,
                background: i === step ? "var(--accent)" : i < step ? "rgba(var(--accent-rgb),0.3)" : "#2a2a2a",
                transition: "all 0.25s",
              }} />
            );
          })}
        </div>

        {/* Nav buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && (
            <button onClick={prev} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "10px 16px", borderRadius: 10,
              background: "#1a1a1a", border: "1px solid #2a2a2a",
              color: "#888", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <button onClick={next} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "10px 20px", borderRadius: 10,
            background: "var(--accent)", border: "none",
            color: "#000", fontSize: 13, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "0.02em",
          }}>
            {step === STEPS.length - 1 ? "Get Started" : "Next"}
            {step < STEPS.length - 1 && <ChevronRight size={14} strokeWidth={3} />}
          </button>
        </div>
      </div>
    </div>
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
