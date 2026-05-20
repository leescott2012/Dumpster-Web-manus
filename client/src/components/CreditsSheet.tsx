/**
 * CreditsSheet — buy credits, subscribe, or manage plan
 * Shows current balance, daily reset timer, credit packs, and subscription options.
 */
import { useState, useCallback, useEffect } from "react";
import { X, Zap, Crown, Clock, Loader, Check, Gift, Flame } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS, CREDIT_COSTS, CREDIT_LABELS } from "@/lib/credits";
import { getAuthHeaders } from "@/lib/supabase";

interface CreditsSheetProps {
  open: boolean;
  onClose: () => void;
  onNeedAuth: () => void;
}

export default function CreditsSheet({ open, onClose, onNeedAuth }: CreditsSheetProps) {
  var { user, profile, totalCredits } = useAuth();
  var [tab, setTab] = useState<"credits" | "pro">("credits");
  var [loading, setLoading] = useState<string | null>(null);
  var [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);

  // Fetch remaining lifetime early-bird slots when Pro tab is shown
  useEffect(function() {
    if (!open || tab !== "pro") return;
    fetch("/api/lifetime-slots")
      .then(function(r) { return r.json(); })
      .then(function(d) { if (typeof d.remaining === "number") setLifetimeSlots(d.remaining); })
      .catch(function() { /* noop */ });
  }, [open, tab]);

  var handleBuyCredits = useCallback(async function(packId: string) {
    if (!user) { onNeedAuth(); return; }
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
      console.error("[CreditsSheet] handleBuyCredits failed:", e);
    }
    setLoading(null);
  }, [user, onNeedAuth]);

  var handleSubscribe = useCallback(async function(planId: string) {
    if (!user) { onNeedAuth(); return; }
    setLoading(planId);
    try {
      var authH = await getAuthHeaders();
      var res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authH),
        body: JSON.stringify({ type: "subscription", planId: planId }),
      });
      var data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch (e) {
      toast.error("Checkout failed. Please try again.");
      console.error("[CreditsSheet] handleSubscribe failed:", e);
    }
    setLoading(null);
  }, [user, onNeedAuth]);

  if (!open) return null;

  var isPro = profile && profile.subscription_tier === "pro";
  var isLifetime = profile && profile.lifetime_purchase;

  // Calculate hours until daily reset
  var hoursUntilReset = 24;
  if (profile) {
    var resetAt = new Date(profile.daily_credits_reset_at);
    var nextReset = new Date(resetAt.getTime() + 24 * 60 * 60 * 1000);
    var msLeft = nextReset.getTime() - Date.now();
    hoursUntilReset = Math.max(0, Math.ceil(msLeft / (60 * 60 * 1000)));
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)", zIndex: 600,
      }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 601,
        background: "#0e0e0e", borderTop: "1px solid #2a2a2a",
        borderRadius: "20px 20px 0 0", overflow: "hidden",
        maxHeight: "88vh", display: "flex", flexDirection: "column",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333" }} />
        </div>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px 12px", borderBottom: "1px solid #1a1a1a", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
              {isPro ? "Pro Account" : "Get Credits"}
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
              {isPro
                ? (isLifetime ? "Lifetime member" : "Pro subscription active")
                : "Power up your AI features"
              }
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#666",
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Balance card */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.12) 0%, rgba(var(--accent-rgb),0.04) 100%)",
            border: "1px solid rgba(var(--accent-rgb),0.2)", borderRadius: 14,
            padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--accent)", textTransform: "uppercase" as const }}>
                {user ? "Your Balance" : "Sign in for credits"}
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginTop: 4 }}>
                {user ? String(totalCredits) : "---"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {user && profile && (
                <>
                  <div style={{ fontSize: 11, color: "#666", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    <Clock size={10} /> {"Resets in " + hoursUntilReset + "h"}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                    {profile.daily_credits_remaining + " daily + " + profile.credits + " purchased"}
                  </div>
                </>
              )}
              {isPro && (
                <div style={{
                  marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
                  borderRadius: 6, padding: "3px 8px", fontSize: 9, fontWeight: 700,
                  color: "#a78bfa", letterSpacing: "0.1em",
                }}>
                  <Crown size={9} /> PRO
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab toggle */}
        <div style={{ display: "flex", padding: "12px 24px 0", gap: 0, flexShrink: 0 }}>
          {([{ id: "credits" as const, label: "Buy Credits" }, { id: "pro" as const, label: "Go Pro" }]).map(function(t) {
            var active = tab === t.id;
            return (
              <button key={t.id} onClick={function() { setTab(t.id); }} style={{
                flex: 1, padding: "10px", background: "transparent", border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "#fff" : "#555", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.02em",
                transition: "all 0.15s",
              }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px" }}>
          {tab === "credits" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4, lineHeight: 1.6 }}>
                Credits let you use AI features. Free users get 15/day, Pro gets 200/day. Buy more anytime.
              </div>

              {CREDIT_PACKS.map(function(pack) {
                var isLoading = loading === pack.id;
                return (
                  <button
                    key={pack.id}
                    onClick={function() { handleBuyCredits(pack.id); }}
                    disabled={isLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: 16,
                      background: "#141414", border: "1px solid #2a2a2a", borderRadius: 14,
                      padding: "18px 20px", cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.15s", width: "100%", textAlign: "left" as const,
                    }}
                    onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseLeave={function(e) { e.currentTarget.style.borderColor = "#2a2a2a"; }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--accent)", flexShrink: 0,
                    }}>
                      <Zap size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#e8e8e8" }}>{pack.label}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{pack.tag}</div>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--accent)", flexShrink: 0 }}>
                      {isLoading ? <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : pack.priceLabel}
                    </div>
                  </button>
                );
              })}

              {/* Credit cost reference */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#444", textTransform: "uppercase" as const, marginBottom: 10 }}>
                  Credit Costs
                </div>
                {Object.keys(CREDIT_COSTS).map(function(key) {
                  return (
                    <div key={key} style={{
                      display: "flex", justifyContent: "space-between", padding: "6px 0",
                      borderBottom: "1px solid #1a1a1a", fontSize: 12,
                    }}>
                      <span style={{ color: "#888" }}>{CREDIT_LABELS[key] || key}</span>
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>{CREDIT_COSTS[key] + " credits"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "pro" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {isPro ? (
                <div style={{
                  background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
                  borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12,
                }}>
                  <Check size={20} color="#4ade80" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80" }}>
                      {isLifetime ? "Lifetime Pro" : "Pro Active"}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      200 daily credits, import your own API keys, no watermarks
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4, lineHeight: 1.6 }}>
                    Unlock unlimited dumps, 200 daily AI credits, premium models, import your own API keys, and more.
                  </div>

                  {/* Pro features list */}
                  <div style={{
                    background: "#141414", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 12,
                    padding: "16px 18px", marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.1em", marginBottom: 10 }}>
                      PRO INCLUDES
                    </div>
                    {[
                      "200 AI credits / day (vs 15 free)",
                      "Premium AI models (Claude Sonnet)",
                      "Import your own API keys",
                      "No watermarks on exports",
                      "Priority support",
                    ].map(function(feature) {
                      return (
                        <div key={feature} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, color: "#ccc" }}>
                          <Check size={13} color="#a78bfa" style={{ flexShrink: 0 }} />
                          {feature}
                        </div>
                      );
                    })}
                  </div>

                  {/* Plan cards */}
                  {SUBSCRIPTION_PLANS.map(function(plan) {
                    var isLoading = loading === plan.id;
                    return (
                      <button
                        key={plan.id}
                        onClick={function() { handleSubscribe(plan.id); }}
                        disabled={isLoading}
                        style={{
                          display: "flex", alignItems: "center", gap: 16,
                          background: plan.id === "lifetime" ? "rgba(167,139,250,0.06)" : "#141414",
                          border: plan.id === "lifetime" ? "1px solid rgba(167,139,250,0.3)" : "1px solid #2a2a2a",
                          borderRadius: 14, padding: "18px 20px", cursor: "pointer",
                          fontFamily: "inherit", transition: "all 0.15s", width: "100%",
                          textAlign: "left" as const,
                        }}
                        onMouseEnter={function(e) { e.currentTarget.style.borderColor = "#a78bfa"; }}
                        onMouseLeave={function(e) { e.currentTarget.style.borderColor = plan.id === "lifetime" ? "rgba(167,139,250,0.3)" : "#2a2a2a"; }}
                      >
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#a78bfa", flexShrink: 0,
                        }}>
                          {plan.id === "lifetime" ? <Gift size={20} /> : <Crown size={20} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: "#e8e8e8" }}>{plan.label}</span>
                            {plan.badge && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                                background: "rgba(167,139,250,0.15)", color: "#a78bfa",
                                padding: "2px 6px", borderRadius: 4,
                              }}>
                                {plan.badge}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                            {plan.id === "lifetime" ? "One-time payment, forever" : "Cancel anytime"}
                          </div>
                          {plan.id === "lifetime" && lifetimeSlots !== null && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 4, marginTop: 6,
                              fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                              color: lifetimeSlots <= 100 ? "#f87171" : lifetimeSlots <= 300 ? "#fb923c" : "#a78bfa",
                            }}>
                              <Flame size={10} />
                              {lifetimeSlots + " of 1,000 slots remaining"}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#a78bfa", flexShrink: 0 }}>
                          {isLoading ? <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : plan.priceLabel}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Referral section */}
              {profile && profile.referral_code && (
                <div style={{
                  marginTop: 16, background: "#141414", border: "1px solid #2a2a2a",
                  borderRadius: 12, padding: "14px 18px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 6 }}>
                    REFER FRIENDS — EARN CREDITS
                  </div>
                  <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, marginBottom: 10 }}>
                    Share your link. You and your friend both get 25 credits when they sign up.
                  </div>
                  <div style={{
                    background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8,
                    padding: "10px 12px", fontSize: 12, color: "#e8e8e8", fontFamily: "monospace",
                    wordBreak: "break-all" as const,
                  }}>
                    {window.location.origin + "?ref=" + profile.referral_code}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </>
  );
}
