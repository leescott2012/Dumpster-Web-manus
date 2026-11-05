/**
 * CreditsSheet — buy credits, subscribe, or manage plan
 * Shows current balance, daily reset timer, credit packs, and subscription options.
 */
import { useState, useCallback, useEffect } from "react";
import { X, Zap, Clock, Loader, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS, CREDIT_COSTS, CREDIT_LABELS } from "@/lib/credits";
import { getAuthHeaders } from "@/lib/supabase";
import { referralLink } from "@/lib/referral";
import PhotoBackdrop from "@/components/PhotoBackdrop";

interface CreditsSheetProps {
  open: boolean;
  onClose: () => void;
  onNeedAuth: () => void;
  /** Pool photo URLs shuffled in the background. */
  photos?: string[];
}

export default function CreditsSheet({ open, onClose, onNeedAuth, photos }: CreditsSheetProps) {
  var { user, profile, totalCredits } = useAuth();
  var [tab, setTab] = useState<"credits" | "pro">("credits");
  var [loading, setLoading] = useState<string | null>(null);
  var [packId, setPackId] = useState("credits_300");
  var [planId, setPlanId] = useState("pro_monthly");

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

  async function shareInvite(code: string) {
    var link = referralLink(code);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Dumpster", text: "Join me on Dumpster", url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return; // user closed the share sheet
      toast.error("Couldn't share. Copy the link above.");
    }
  }

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

  var selectedPack = CREDIT_PACKS.find(function(p) { return p.id === packId; }) || CREDIT_PACKS[0];
  var selectedPlan = SUBSCRIPTION_PLANS.find(function(p) { return p.id === planId; }) || SUBSCRIPTION_PLANS[0];
  var busy = loading !== null;

  var glass = {
    background: "rgba(14,14,14,0.62)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.14)",
  } as const;

  function optionCard(key: string, selected: boolean, onPick: () => void, title: string, price: string, chip: string | undefined, note: string) {
    return (
      <button key={key} onClick={onPick} aria-pressed={selected} style={Object.assign({}, glass, {
        flex: 1, minWidth: 0, position: "relative" as const, display: "flex", flexDirection: "column" as const, alignItems: "flex-start", textAlign: "left" as const, cursor: "pointer",
        borderRadius: 14, padding: "14px 12px", fontFamily: "inherit", color: "#fff",
        border: selected ? "2px solid var(--accent)" : glass.border,
        background: selected ? "rgba(60,48,25,0.68)" : glass.background,
      })}>
        {selected && (
          <span style={{
            position: "absolute", top: -9, right: -8, width: 22, height: 22, borderRadius: "50%",
            background: "var(--accent)", color: "#111", display: "flex", alignItems: "center", justifyContent: "center",
          }}><Check size={13} strokeWidth={3} /></span>
        )}
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: "8px 0" }}>{price}</div>
        {chip && <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, background: "rgba(255,255,255,0.16)", padding: "3px 6px", borderRadius: 4, marginBottom: 6 }}>{chip}</div>}
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{note}</div>
      </button>
    );
  }

  return (
    <>
      <PhotoBackdrop photos={photos} />

      <div style={{
        position: "fixed", inset: 0, zIndex: 601, color: "#fff", overflowY: "auto",
        display: "flex", flexDirection: "column",
        padding: "max(16px, env(safe-area-inset-top)) 18px max(20px, env(safe-area-inset-bottom))",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.2) 32%, rgba(0,0,0,0.7) 58%, #0a0a0a 100%)",
      }}>
        <div style={{ width: "100%", maxWidth: 460, alignSelf: "center", display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", color: "#fff", padding: 6, cursor: "pointer" }}>
              <X size={22} />
            </button>
            {user ? (
              <div style={Object.assign({}, glass, { display: "flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 700 })}>
                <Zap size={13} color="var(--accent)" /> {String(totalCredits)}
              </div>
            ) : (
              <button onClick={onNeedAuth} style={{ background: "none", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Sign in
              </button>
            )}
          </div>

          {/* Title */}
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 34, fontWeight: 800, letterSpacing: "-0.045em" }}>
              dumpster
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0, color: "var(--accent)", border: "1.5px solid var(--accent)", padding: "1px 7px", borderRadius: 3 }}>
                {tab === "pro" ? "pro" : "credits"}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", marginTop: 6 }}>
              {isPro ? (isLifetime ? "Lifetime member" : "Pro subscription active") : "Your camera roll, turned into posts"}
            </div>
            {user && profile && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <Clock size={10} /> {"Resets in " + hoursUntilReset + "h · " + profile.daily_credits_remaining + " daily + " + profile.credits + " purchased"}
              </div>
            )}
          </div>

          {/* Tab toggle */}
          <div style={Object.assign({}, glass, { display: "flex", borderRadius: 999, padding: 3, margin: "16px auto 0", width: 240 })}>
            {([{ id: "pro" as const, label: "Go Pro" }, { id: "credits" as const, label: "Buy Credits" }]).map(function(t) {
              var active = tab === t.id;
              return (
                <button key={t.id} onClick={function() { setTab(t.id); }} style={{
                  flex: 1, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit",
                  background: active ? "var(--accent)" : "transparent", color: active ? "#111" : "#fff",
                  fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                }}>{t.label}</button>
              );
            })}
          </div>

          <div style={{ flex: 1, minHeight: 40 }} />

          {tab === "pro" && (isPro ? (
            <div style={Object.assign({}, glass, { borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 })}>
              <Check size={20} color="#4ade80" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{isLifetime ? "Lifetime Pro" : "Pro Active"}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>300 AI credits every month</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: "0 4px", fontSize: 14, fontWeight: 600 }}>
                {["300 AI credits every month", "Auto Gen builds dumps for you", "Captions and Valet edits with AI", "Cancel anytime"].map(function(f) {
                  return <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}><Check size={15} strokeWidth={3} color="var(--accent)" />{f}</div>;
                })}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                {SUBSCRIPTION_PLANS.map(function(plan) {
                  return optionCard(plan.id, plan.id === planId, function() { setPlanId(plan.id); },
                    plan.interval === "year" ? "Yearly" : "Monthly", plan.priceLabel.replace(/\/(mo|yr)$/, ""), plan.badge,
                    plan.interval === "year" ? "Billed once a year" : "Billed each month");
                })}
              </div>
              <button onClick={function() { handleSubscribe(selectedPlan.id); }} disabled={busy} style={{
                marginTop: 14, height: 52, borderRadius: 26, border: "none", background: "var(--accent)", color: "#111",
                fontSize: 16, fontWeight: 800, fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {loading === selectedPlan.id ? <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <>Start Pro <ChevronRight size={18} /></>}
              </button>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, padding: "10px 4px 0" }}>
                Pro renews automatically unless cancelled before the period ends. Manage or cancel anytime in account settings.
              </div>
            </>
          ))}

          {tab === "credits" && (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                {CREDIT_PACKS.map(function(pack) {
                  return optionCard(pack.id, pack.id === packId, function() { setPackId(pack.id); },
                    pack.credits + " credits", pack.priceLabel, undefined, pack.tag);
                })}
              </div>
              <button onClick={function() { handleBuyCredits(selectedPack.id); }} disabled={busy} style={{
                marginTop: 14, height: 52, borderRadius: 26, border: "none", background: "var(--accent)", color: "#111",
                fontSize: 16, fontWeight: 800, fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {loading === selectedPack.id ? <Loader size={18} style={{ animation: "spin 0.8s linear infinite" }} /> : <>{"Buy " + selectedPack.credits + " credits · " + selectedPack.priceLabel} <ChevronRight size={18} /></>}
              </button>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, padding: "10px 4px 0" }}>
                One-time purchase, no subscription. New accounts start with 30 credits.
              </div>

              {profile && profile.referral_code && (
                <div data-tour="invite-friend" style={Object.assign({}, glass, { borderRadius: 14, padding: "14px 16px", marginTop: 18 })}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 6 }}>INVITE A FRIEND</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, marginBottom: 10 }}>
                    Earn 10 credits for each friend who finishes setup — enough for a new AI dump. Up to 5 friends.
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" as const, marginBottom: 10 }}>
                    {referralLink(profile.referral_code)}
                  </div>
                  <button onClick={function() { shareInvite(profile!.referral_code); }} style={{
                    width: "100%", padding: "11px", borderRadius: 22, border: "1.5px solid var(--accent)", cursor: "pointer",
                    background: "transparent", color: "var(--accent)", fontWeight: 800, fontSize: 13, fontFamily: "inherit",
                  }}>
                    Share invite link
                  </button>
                </div>
              )}

              <div style={Object.assign({}, glass, { borderRadius: 14, padding: "10px 16px", marginTop: 12 })}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)", textTransform: "uppercase" as const, padding: "4px 0 6px" }}>
                  Credit Costs
                </div>
                {Object.keys(CREDIT_COSTS).map(function(key) {
                  return (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.75)" }}>{CREDIT_LABELS[key] || key}</span>
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>{CREDIT_COSTS[key] + (key.endsWith("_per_photo") ? " credit/photo" : " credits")}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </>
  );
}
