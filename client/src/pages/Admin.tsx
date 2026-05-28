/**
 * /admin — Owner-only activity dashboard
 *
 * Shows:
 *   • 4 overview stat cards (users, DAU, AI calls today, credits spent today)
 *   • Daily active users bar chart (last 14 days)
 *   • Feature usage bar chart (AI actions, last 30 days)
 *   • User table (email, joined, last active, tier, credits, AI calls, exports)
 *
 * Access: self-contained sign-in. Visit /admin in any browser → if no
 *         Supabase session, show a Google sign-in card. After auth, the
 *         server checks ADMIN_USER_ID; non-admins get a polite 403 screen.
 *         This makes the dashboard accessible without first logging into
 *         the main app on the same device.
 */
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// ── Types (mirror api/admin-stats.ts response) ────────────────────────────────

interface FeatureUsageRow { action: string; count: number; credits: number; }
interface DauRow          { date: string;   count: number; }
interface UserRow {
  id: string; email: string; created_at: string;
  last_sign_in_at: string | null; tier: string; credits: number;
  ai_calls: number; credits_used: number; photos_uploaded: number; exports: number;
}
interface AdminStats {
  overview: {
    total_users: number; active_today: number; active_week: number;
    ai_calls_today: number; credits_spent_today: number;
  };
  feature_usage: FeatureUsageRow[];
  dau: DauRow[];
  users: UserRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function fmtAction(action: string): string {
  const map: Record<string, string> = {
    ai_suggest: "Auto Gen", ai_caption: "Caption", ai_chat: "Chat",
    ai_recycle: "Recycle", ig_scrub: "IG Scrub",
  };
  return map[action] ?? action;
}

const ACCENT = "#f5c518";

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
      padding: "18px 22px", minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{value}</div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
      <div style={{ color: "#888", marginBottom: 2 }}>{label}</div>
      <div style={{ color: ACCENT, fontWeight: 700 }}>{payload[0].value}</div>
    </div>
  );
}

// ── Sign-in screen ────────────────────────────────────────────────────────────

function SignInScreen({ onGoogle, signingIn, error }: { onGoogle: () => void; signingIn: boolean; error: string | null }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "#fff" }}>
      <div style={{ width: "100%", maxWidth: 360, background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 32 }}>
        <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Dumpster
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>Admin sign-in</h1>
        <p style={{ margin: "0 0 24px", color: "#888", fontSize: 13, lineHeight: 1.5 }}>
          Sign in with the admin Google account to see user activity.
        </p>

        <button
          onClick={onGoogle}
          disabled={signingIn}
          style={{
            width: "100%", padding: "12px 16px", background: "#fff", color: "#000",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: signingIn ? "wait" : "pointer", opacity: signingIn ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
          </svg>
          {signingIn ? "Redirecting…" : "Continue with Google"}
        </button>

        {error && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 8, fontSize: 12, color: "#f88" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: "#444", textAlign: "center" }}>
          <a href="/" style={{ color: "#666", textDecoration: "none" }}>← Back to app</a>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Track Supabase session (handles fresh sign-in via OAuth redirect)
  useEffect(function() {
    supabase.auth.getSession().then(function(r) {
      setSession(r.data.session);
      setSessionLoading(false);
    });
    const sub = supabase.auth.onAuthStateChange(function(_e, s) {
      setSession(s);
    });
    return function() { sub.data.subscription.unsubscribe(); };
  }, []);

  // Fetch stats — only when we have a session
  const fetchStats = useCallback(async function() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-stats", {
        headers: { Authorization: "Bearer " + session.access_token },
      });
      if (!res.ok) {
        const body = await res.json().catch(function() { return {}; });
        if (res.status === 403) {
          setError("This account isn't authorized to view the dashboard.");
        } else {
          setError(body.error ?? "HTTP " + res.status);
        }
        return;
      }
      setStats(await res.json());
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(function() {
    if (session) fetchStats();
  }, [session, fetchStats]);

  // ── Sign-in flow ───────────────────────────────────────────────────────────
  const handleGoogle = useCallback(async function() {
    setSigningIn(true);
    setError(null);
    const { error: oerr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/admin" },
    });
    if (oerr) {
      setError(oerr.message);
      setSigningIn(false);
    }
    // On success the browser navigates away to Google — no need to clear setSigningIn.
  }, []);

  const handleSignOut = useCallback(async function() {
    await supabase.auth.signOut();
    setSession(null);
    setStats(null);
    setError(null);
  }, []);

  // ── Render: session loading ────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
        Loading…
      </div>
    );
  }

  // ── Render: no session → sign-in screen ────────────────────────────────────
  if (!session) {
    return <SignInScreen onGoogle={handleGoogle} signingIn={signingIn} error={error} />;
  }

  // ── Render: signed in, loading stats ───────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
        Loading…
      </div>
    );
  }

  // ── Render: signed in but error (likely 403 not authorized) ────────────────
  if (error) {
    const notAuthorized = error.includes("authorized");
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 380, background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 32, color: "#fff" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>
            {notAuthorized ? "Not authorized" : "Couldn't load dashboard"}
          </h2>
          <p style={{ margin: "0 0 16px", color: "#888", fontSize: 13, lineHeight: 1.5 }}>
            {notAuthorized
              ? "Signed in as " + (session.user.email || "this account") + ", but this account isn't the admin. Sign out and try the admin account."
              : error}
          </p>
          {error.includes("ADMIN_USER_ID") && (
            <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
              Add <code style={{ color: ACCENT }}>ADMIN_USER_ID</code> to your Vercel environment variables.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={fetchStats}
              style={{ flex: 1, padding: "10px 16px", background: ACCENT, color: "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Retry
            </button>
            <button
              onClick={handleSignOut}
              style={{ flex: 1, padding: "10px 16px", background: "transparent", color: "#888", border: "1px solid #2a2a2a", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, feature_usage, dau, users } = stats;

  // Short date labels for DAU chart
  const dauLabelled = dau.map(d => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const featureLabelled = feature_usage.map(f => ({
    ...f,
    label: fmtAction(f.action),
  }));

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", padding: "32px 24px", maxWidth: 1100, margin: "0 auto", color: "#fff" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Admin Dashboard</h1>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
            Signed in as {session.user.email || session.user.id}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#555" }}>Last 30 days</span>
          <button
            onClick={fetchStats}
            style={{ padding: "6px 14px", background: "transparent", color: ACCENT, border: "1px solid #333", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Refresh
          </button>
          <button
            onClick={handleSignOut}
            style={{ padding: "6px 14px", background: "transparent", color: "#666", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Sign out
          </button>
          <a href="/" style={{ padding: "6px 14px", background: "transparent", color: "#666", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 13, textDecoration: "none" }}>
            ← App
          </a>
        </div>
      </div>

      {/* Overview cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Total Users"       value={overview.total_users} />
        <StatCard label="Active Today"      value={overview.active_today} />
        <StatCard label="Active This Week"  value={overview.active_week} />
        <StatCard label="AI Calls Today"    value={overview.ai_calls_today} />
        <StatCard label="Credits Used Today" value={overview.credits_spent_today} />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>

        {/* DAU chart */}
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: "20px 16px" }}>
          <div style={{ fontSize: 12, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
            Daily Active Users — 14 days
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dauLabelled} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {dauLabelled.map((_, i) => (
                  <Cell key={i} fill={i === dauLabelled.length - 1 ? ACCENT : "#2a2a2a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Feature usage chart */}
        <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: "20px 16px" }}>
          <div style={{ fontSize: 12, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
            AI Feature Usage — 30 days
          </div>
          {featureLabelled.length === 0 ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 13 }}>
              No AI calls yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={featureLabelled} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Users table */}
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Users ({users.length})
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {["Email", "Joined", "Last Active", "Tier", "Credits", "AI Calls", "Credits Used", "Photos", "Exports"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #1e1e1e", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: i < users.length - 1 ? "1px solid #1a1a1a" : "none", transition: "background 0.1s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#161616"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "10px 16px", color: "#ccc", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.email || <span style={{ color: "#444" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 16px", color: "#666", whiteSpace: "nowrap" }}>{fmtDate(u.created_at)}</td>
                  <td style={{ padding: "10px 16px", color: "#666", whiteSpace: "nowrap" }}>{fmtDate(u.last_sign_in_at)}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: u.tier === "pro" ? "rgba(245,197,24,0.15)" : "#1a1a1a",
                      color: u.tier === "pro" ? ACCENT : "#555",
                    }}>
                      {u.tier}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", color: u.credits > 0 ? "#ccc" : "#444" }}>{u.credits}</td>
                  <td style={{ padding: "10px 16px", color: u.ai_calls > 0 ? "#ccc" : "#444" }}>{u.ai_calls}</td>
                  <td style={{ padding: "10px 16px", color: u.credits_used > 0 ? "#ccc" : "#444" }}>{u.credits_used}</td>
                  <td style={{ padding: "10px 16px", color: u.photos_uploaded > 0 ? "#ccc" : "#444" }}>{u.photos_uploaded}</td>
                  <td style={{ padding: "10px 16px", color: u.exports > 0 ? ACCENT : "#444" }}>{u.exports}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 32, textAlign: "center", color: "#444" }}>No users yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
