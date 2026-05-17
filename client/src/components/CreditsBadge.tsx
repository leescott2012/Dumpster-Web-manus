/**
 * CreditsBadge — compact credits display for the top navbar.
 * Shows: credit count + zap icon. Tap opens CreditsSheet.
 * If not logged in, shows "Sign In" button.
 */
import { Zap, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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

  // Logged in — show credits
  var isPro = profile && profile.subscription_tier === "pro";

  return (
    <button
      onClick={onCreditsClick}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        background: "rgba(var(--accent-rgb),0.08)", border: "1px solid rgba(var(--accent-rgb),0.2)",
        borderRadius: 8, padding: "6px 10px",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s",
      }}
      onMouseEnter={function(e) { e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={function(e) { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.2)"; }}
    >
      <Zap size={12} color="var(--accent)" fill="var(--accent)" />
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.01em" }}>
        {totalCredits}
      </span>
      {isPro && (
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
          background: "rgba(167,139,250,0.2)", color: "#a78bfa",
          padding: "1px 4px", borderRadius: 3, marginLeft: 2,
        }}>
          PRO
        </span>
      )}
    </button>
  );
}
