/**
 * OutOfCreditsOverlay — focused prompt when a user tries an AI action
 * without enough credits. Shows deficit, quick-buy packs, Go Pro, or sign-in.
 */
import { useState, useCallback, useEffect } from "react";
import { Zap, X, Crown, Loader, User, Flame } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CREDIT_PACKS, CREDIT_COSTS, CREDIT_LABELS } from "@/lib/credits";
import { getAuthHeaders } from "@/lib/supabase";

interface OutOfCreditsOverlayProps {
  open: boolean;
  action: string;          // e.g. "ai_suggest"
  onClose: () => void;
  onAuthClick: () => void; // open sign-in sheet
  onProClick: () => void;  // open credits sheet on Pro tab
}

export default function OutOfCreditsOverlay({ open, action, onClose, onAuthClick, onProClick }: OutOfCreditsOverlayProps) {
  var { user, totalCredits } = useAuth();
  var [loading, setLoading] = useState<string | null>(null);
  var [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);

  // Fetch remaining lifetime slots when overlay opens
  useEffect(function() {
    if (!open || !user) return;
    fetch("/api/lifetime-slots")
      .then(function(r) { return r.json(); })
      .then(function(d) { if (typeof d.remaining === "number") setLifetimeSlots(d.remaining); })
      .catch(function() { /* noop */ });
  }, [open, user]);

  var cost = CREDIT_COSTS[action] || 0;
  var label = CREDIT_LABELS[action] || action;
  var deficit = Math.max(0, cost - totalCredits);

  var handleBuy = useCallback(async function(packId: string) {
    if (!user) { onAuthClick(); return; }
    setLoading(packId);
    try {
      var authH = await getAuthHeaders();
      var res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authH),
        body: JSON.stringify({ type: "credits", packId: packId }),
      });
      var data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error("Checkout failed. Please try again.");
      console.error("[OutOfCreditsOverlay] handleBuy failed:", e);
    }
    setLoading(null);
  }, [user, onAuthClick]);

  if (!open) return null;

  // ── Not logged in variant ──────────────────────────────────────────
  if (!user) {
    return (
      <>
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          zIndex: 700,
        }} />
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 701, width: 380, maxWidth: "calc(100vw - 48px)",
          background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 20,
          overflow: "hidden",
        }}>
          {/* Top gradient bar */}
          <div style={{ height: 3, background: "linear-gradient(90deg, var(--accent), #a78bfa)" }} />

          <div style={{ padding: "32px 28px 28px", textAlign: "center" }}>
            {/* Icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
              background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User size={24} color="var(--accent)" />
            </div>

            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 8 }}>
              Sign in for free credits
            </div>
            <div style={{ fontSize: 13, color: "#777", lineHeight: 1.65, marginBottom: 28 }}>
              {"Get 15 AI credits per day when you create a free account. " + label + " costs " + cost + " credits."}
            </div>

            <button onClick={function() { onClose(); onAuthClick(); }} style={{
              width: "100%", padding: "14px 20px", borderRadius: 12,
              background: "var(--accent)", border: "none", color: "#000",
              fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              letterSpacing: "0.02em", marginBottom: 10,
            }}>
              Sign In for Free
            </button>
            <button onClick={onClose} style={{
              width: "100%", padding: "12px 20px", borderRadius: 12,
              background: "transparent", border: "1px solid #2a2a2a", color: "#666",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>
              Not now
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Logged in, out of credits ──────────────────────────────────────
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        zIndex: 700,
      }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 701, width: 400, maxWidth: "calc(100vw - 48px)",
        background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 20,
        overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column",
      }}>
        {/* Top gradient bar */}
        <div style={{ height: 3, background: "linear-gradient(90deg, var(--accent), #f87171)" }} />

        {/* Close */}
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, zIndex: 2,
          width: 30, height: 30, borderRadius: "50%",
          background: "#1a1a1a", border: "1px solid #2a2a2a",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#555",
        }}>
          <X size={14} />
        </button>

        <div style={{ padding: "28px 28px 24px", overflowY: "auto" }}>
          {/* Credit gauge */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px",
              background: totalCredits === 0
                ? "rgba(248,113,113,0.1)"
                : "rgba(var(--accent-rgb),0.1)",
              border: totalCredits === 0
                ? "2px solid rgba(248,113,113,0.3)"
                : "2px solid rgba(var(--accent-rgb),0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column",
            }}>
              <Zap size={18} color={totalCredits === 0 ? "#f87171" : "var(--accent)"} fill={totalCredits === 0 ? "#f87171" : "var(--accent)"} />
              <span style={{
                fontSize: 16, fontWeight: 900, marginTop: 2,
                color: totalCredits === 0 ? "#f87171" : "var(--accent)",
              }}>
                {totalCredits}
              </span>
            </div>

            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
              {totalCredits === 0 ? "Out of credits" : "Not enough credits"}
            </div>
            <div style={{ fontSize: 13, color: "#777", lineHeight: 1.6 }}>
              <span style={{ color: "#e8e8e8", fontWeight: 700 }}>{label}</span>
              {" needs "}
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>{cost + " credits"}</span>
              {totalCredits > 0 ? (". You need " + deficit + " more.") : "."}
            </div>
          </div>

          {/* Quick buy packs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" as const, marginBottom: 2 }}>
              Quick top-up
            </div>
            {CREDIT_PACKS.map(function(pack) {
              var isLoading = loading === pack.id;
              var coversDeficit = pack.credits >= deficit;
              return (
                <button
                  key={pack.id}
                  onClick={function() { handleBuy(pack.id); }}
                  disabled={isLoading}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    background: coversDeficit ? "rgba(var(--accent-rgb),0.06)" : "#141414",
                    border: coversDeficit ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid #222",
                    borderRadius: 12, padding: "14px 16px", cursor: "pointer",
                    fontFamily: "inherit", transition: "all 0.15s", width: "100%",
                    textAlign: "left" as const,
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onMouseLeave={function(e) { e.currentTarget.style.borderColor = coversDeficit ? "rgba(var(--accent-rgb),0.25)" : "#222"; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Zap size={16} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e8e8e8" }}>{pack.label}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{pack.tag}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>
                    {isLoading ? <Loader size={16} style={{ animation: "spin 0.8s linear infinite" }} /> : pack.priceLabel}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
            <span style={{ fontSize: 10, color: "#444", fontWeight: 600, letterSpacing: "0.1em" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
          </div>

          {/* Go Pro CTA */}
          <button onClick={function() { onClose(); onProClick(); }} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 20px", borderRadius: 12,
            background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)",
            color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
            onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#a78bfa"; }}
            onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(167,139,250,0.25)"; }}
          >
            <Crown size={15} /> Go Pro — 200 credits/day
          </button>

          {/* Lifetime early-bird counter */}
          {lifetimeSlots !== null && lifetimeSlots > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              marginTop: 8, padding: "8px 12px", borderRadius: 10,
              background: lifetimeSlots <= 100
                ? "rgba(248,113,113,0.06)"
                : lifetimeSlots <= 300
                  ? "rgba(251,146,60,0.06)"
                  : "rgba(167,139,250,0.04)",
              border: lifetimeSlots <= 100
                ? "1px solid rgba(248,113,113,0.15)"
                : lifetimeSlots <= 300
                  ? "1px solid rgba(251,146,60,0.15)"
                  : "1px solid rgba(167,139,250,0.12)",
            }}>
              <Flame size={12} color={
                lifetimeSlots <= 100 ? "#f87171" : lifetimeSlots <= 300 ? "#fb923c" : "#a78bfa"
              } />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.01em",
                color: lifetimeSlots <= 100 ? "#f87171" : lifetimeSlots <= 300 ? "#fb923c" : "#a78bfa",
              }}>
                {lifetimeSlots + " of 1,000 lifetime slots left — $19.99 forever"}
              </span>
            </div>
          )}

          {/* Dismiss */}
          <button onClick={onClose} style={{
            width: "100%", padding: "11px", marginTop: 10, borderRadius: 10,
            background: "transparent", border: "none", color: "#555",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            Not now
          </button>
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </>
  );
}
