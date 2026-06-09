/**
 * CreditsBadge — compact credits display for the top navbar.
 * Shows: SVG ring gauge + credit count + zap icon. Tap opens CreditsSheet.
 * Pulses orange when low, red when empty.
 * If not logged in, shows "Sign In" button.
 */
import { Zap, User, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isOwnerId } from "@/lib/photoData";
import { DAILY_FREE_CREDITS } from "@/lib/credits";

interface CreditsBadgeProps {
  onCreditsClick: () => void;
  onAuthClick: () => void;
}

export default function CreditsBadge({ onCreditsClick, onAuthClick }: CreditsBadgeProps) {
  var { user, profile, totalCredits, loading } = useAuth();

  if (loading) return null;

  // Not logged in — show sign in
  if (!user) {
    return (
      <button
        data-tour="sign-in"
        onClick={onAuthClick}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)",
          borderRadius: 8, padding: "6px 12px",
          color: "var(--accent)", fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
          transition: "all 0.15s",
        }}
        onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.25)"; }}
      >
        <User size={13} /> Sign In
      </button>
    );
  }

  // Logged in — show credits with ring gauge
  var isPro = profile && profile.subscription_tier === "pro";
  var tier = (profile && profile.subscription_tier) || "free";
  var maxDaily = DAILY_FREE_CREDITS[tier] || 15;
  // Ring gauge: % of daily allowance (purchased credits can push over 100%)
  var pct = Math.min(1, totalCredits / maxDaily);
  var isLow = totalCredits > 0 && totalCredits <= 5;
  var isEmpty = totalCredits === 0;

  // SVG ring gauge params
  var ringSize = 28;
  var ringStroke = 2.5;
  var ringRadius = (ringSize - ringStroke) / 2;
  var ringCircumference = 2 * Math.PI * ringRadius;
  var ringOffset = ringCircumference * (1 - pct);
  var ringColor = isEmpty ? "#f87171" : isLow ? "#fb923c" : "var(--accent)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {isOwnerId(user.id) && (
        <a
          href="/admin"
          data-tour="owner-dashboard"
          title="Open GENIUSS Dashboard"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.25)",
            borderRadius: 10, padding: "6px 12px",
            color: "var(--accent)", fontSize: 11, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
            textDecoration: "none", whiteSpace: "nowrap",
          }}
          onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.25)"; }}
        >
          <LayoutDashboard size={13} /> Dashboard
        </a>
      )}
    <button
      onClick={onCreditsClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: isEmpty
          ? "rgba(248,113,113,0.08)"
          : isLow
            ? "rgba(251,146,60,0.08)"
            : "rgba(var(--accent-rgb),0.08)",
        border: isEmpty
          ? "1px solid rgba(248,113,113,0.25)"
          : isLow
            ? "1px solid rgba(251,146,60,0.25)"
            : "1px solid rgba(var(--accent-rgb),0.2)",
        borderRadius: 10, padding: "4px 10px 4px 4px",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.3s",
        animation: isEmpty ? "creditsPulse 2s ease-in-out infinite" : isLow ? "creditsPulse 3s ease-in-out infinite" : "none",
      }}
      onMouseEnter={function(e) { e.currentTarget.style.borderColor = ringColor; }}
      onMouseLeave={function(e) {
        e.currentTarget.style.borderColor = isEmpty
          ? "rgba(248,113,113,0.25)"
          : isLow
            ? "rgba(251,146,60,0.25)"
            : "rgba(var(--accent-rgb),0.2)";
      }}
    >
      {/* Ring gauge with zap icon inside */}
      <div style={{ position: "relative", width: ringSize, height: ringSize, flexShrink: 0 }}>
        <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
          {/* Background track */}
          <circle
            cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
            fill="none" stroke="#222" strokeWidth={ringStroke}
          />
          {/* Progress arc */}
          <circle
            cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
            fill="none" stroke={ringColor} strokeWidth={ringStroke}
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
          />
        </svg>
        <Zap
          size={11}
          color={ringColor}
          fill={ringColor}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {/* Credit count */}
      <span style={{
        fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em",
        color: isEmpty ? "#f87171" : isLow ? "#fb923c" : "var(--accent)",
        transition: "color 0.3s",
      }}>
        {totalCredits}
      </span>

      {isPro && (
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
          background: "rgba(167,139,250,0.2)", color: "#a78bfa",
          padding: "1px 4px", borderRadius: 3,
        }}>
          PRO
        </span>
      )}

      <style>{
        "@keyframes creditsPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }"
      }</style>
    </button>
    </div>
  );
}
