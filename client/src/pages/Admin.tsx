/**
 * /admin — Owner-only activity dashboard
 *
 * Shows:
 *   • 4 overview stat cards (users, DAU, AI calls today, credits spent today)
 *   • Daily active users bar chart (last 14 days)
 *   • Feature usage bar chart (AI actions, last 30 days)
 *   • User table (email, joined, last active, tier, credits, AI calls, exports)
 *
 * Access: IS_OWNER only — hard redirect to "/" for everyone else.
 * Data:   fetched from /api/admin-stats with JWT auth.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { IS_OWNER } from "@/lib/photoData";
import { supabase } from "@/lib/supabase";

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

// ── Main component ────────────────────────────────────────────────────────────

export default function Admin() {
  const [, navigate] = useLocation();
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Gate: IS_OWNER only
  useEffect(function() {
    if (!IS_OWNER) navigate("/");
  }, [navigate]);

  // Fetch stats
  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not signed in."); setLoading(false); return; }

      const res = await fetch("/api/admin-stats", {
        headers: { Authorization: "Bearer " + session.access_token },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "HTTP " + res.status);
        setLoading(false);
        return;
      }

      setStats(await res.json());
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(function() { if (IS_OWNER) fetchStats(); }, []); // eslint-disable-line

  if (!IS_OWNER) return null;

  // ── Loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a0a0a", padding: 32, color: "#f55" }}>
        <h2 style={{ margin: "0 0 12px", color: "#fff" }}>Admin Dashboard</h2>
        <p>Error: {error}</p>
        {error.includes("ADMIN_USER_ID") && (
          <p style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
            Add <code style={{ color: ACCENT }}>ADMIN_USER_ID</code> to your Vercel environment variables.
            Value = your Supabase user UUID (Authentication → Users → copy your UUID).
          </p>
        )}
        <button
          onClick={fetchStats}
          style={{ marginTop: 16, padding: "8px 18px", background: ACCENT, color: "#000", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Retry
        </button>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Admin Dashboard</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#555" }}>Last 30 days</span>
          <button
            onClick={fetchStats}
            style={{ padding: "6px 14px", background: "transparent", color: ACCENT, border: "1px solid #333", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Refresh
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
