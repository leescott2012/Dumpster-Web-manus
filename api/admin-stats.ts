/**
 * /api/admin-stats — Admin analytics endpoint
 *
 * Returns aggregated user activity for the /admin dashboard.
 * Protected: only the account set in ADMIN_USER_ID env var can access this.
 *
 * Query params:
 *   ?range=7d   → last 7 days
 *   ?range=30d  → last 30 days (default)
 *   ?range=all  → all time
 *
 * Queries (all via service_role — bypasses RLS):
 *   - auth.users          → total users, join dates, last sign-in
 *   - profiles            → credits, subscription tier
 *   - credit_transactions → AI feature usage and spend
 *   - activity_log        → DAU, photo uploads, exports
 *
 * Set ADMIN_USER_ID in Vercel env to your Supabase user UUID.
 * Find it: Supabase → Authentication → Users → your row → copy UUID.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../server/creditGate.js";
import { supabaseAdmin } from "../server/supabaseAdmin.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureUsageRow {
  action: string;
  count: number;
  credits: number;
}

interface DauRow {
  date: string;
  count: number;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  tier: string;
  credits: number;
  ai_calls: number;
  credits_used: number;
  photos_uploaded: number;
  exports: number;
}

interface AdminStats {
  overview: {
    total_users: number;
    active_today: number;
    active_week: number;
    ai_calls_today: number;
    credits_spent_today: number;
  };
  feature_usage: FeatureUsageRow[];
  dau: DauRow[];
  users: UserRow[];
  range: string;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  // 1) Auth required
  const userId = await getUserFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: "Sign in required." });
  }

  // 2) Owner check
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) {
    return res.status(503).json({ error: "ADMIN_USER_ID env var not set." });
  }
  if (userId !== adminId) {
    return res.status(403).json({ error: "Forbidden." });
  }

  // 3) Parse date range
  const range = (req.query.range as string) ?? "30d";
  let rangeMs: number | null;
  let dauDays: number;

  if (range === "7d") {
    rangeMs = 7 * 24 * 60 * 60 * 1000;
    dauDays = 7;
  } else if (range === "all") {
    rangeMs = null; // no filter
    dauDays = 30;
  } else {
    // default: 30d
    rangeMs = 30 * 24 * 60 * 60 * 1000;
    dauDays = 14;
  }

  const rangeStart = rangeMs
    ? new Date(Date.now() - rangeMs).toISOString()
    : new Date(0).toISOString();

  try {
    const oneDayAgo    = new Date(Date.now() -      24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();

    // ── Parallel data fetches ─────────────────────────────────────────────────
    const [usersResult, profilesResult, txResult, activityResult] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),

      supabaseAdmin
        .from("profiles")
        .select("id, credits, subscription_tier"),

      supabaseAdmin
        .from("credit_transactions")
        .select("user_id, amount, type, created_at")
        .lt("amount", 0)
        .gte("created_at", rangeStart),

      supabaseAdmin
        .from("activity_log")
        .select("user_id, event, metadata, created_at")
        .gte("created_at", rangeStart),
    ]);

    const authUsers  = usersResult.data?.users ?? [];
    const profiles   = profilesResult.data ?? [];
    const txRows     = txResult.data ?? [];
    const actRows    = activityResult.data ?? [];

    // ── Index maps ────────────────────────────────────────────────────────────
    const profileById = new Map<string, { credits: number; subscription_tier: string }>();
    for (const p of profiles) {
      profileById.set(p.id, p);
    }

    // ── Overview ──────────────────────────────────────────────────────────────
    const total_users = authUsers.length;

    const sessionEvents = actRows.filter(r => r.event === "session_start");
    const active_today = new Set(
      sessionEvents.filter(r => r.created_at >= oneDayAgo).map(r => r.user_id)
    ).size;
    const active_week = new Set(
      sessionEvents.filter(r => r.created_at >= sevenDaysAgo).map(r => r.user_id)
    ).size;

    const txToday = txRows.filter(r => r.created_at >= oneDayAgo);
    const ai_calls_today      = txToday.length;
    const credits_spent_today = txToday.reduce((s, r) => s + Math.abs(r.amount), 0);

    // ── Feature usage ─────────────────────────────────────────────────────────
    const featureMap = new Map<string, { count: number; credits: number }>();
    for (const tx of txRows) {
      const key = tx.type as string;
      const existing = featureMap.get(key) ?? { count: 0, credits: 0 };
      existing.count++;
      existing.credits += Math.abs(tx.amount);
      featureMap.set(key, existing);
    }
    const feature_usage: FeatureUsageRow[] = Array.from(featureMap.entries())
      .map(([action, v]) => ({ action, count: v.count, credits: v.credits }))
      .sort((a, b) => b.count - a.count);

    // ── DAU ───────────────────────────────────────────────────────────────────
    const dauWindowStart = new Date(Date.now() - dauDays * 24 * 60 * 60 * 1000).toISOString();
    const dauMap = new Map<string, Set<string>>();
    for (const r of sessionEvents) {
      if (r.created_at < dauWindowStart) continue;
      const day = r.created_at.slice(0, 10);
      if (!dauMap.has(day)) dauMap.set(day, new Set());
      dauMap.get(day)!.add(r.user_id as string);
    }
    const dau: DauRow[] = [];
    for (let d = 0; d < dauDays; d++) {
      const dt = new Date(Date.now() - (dauDays - 1 - d) * 24 * 60 * 60 * 1000);
      const key = dt.toISOString().slice(0, 10);
      dau.push({ date: key, count: dauMap.get(key)?.size ?? 0 });
    }

    // ── Per-user stats ─────────────────────────────────────────────────────────
    const userTx = new Map<string, { calls: number; credits: number }>();
    for (const tx of txRows) {
      const uid = tx.user_id as string;
      const existing = userTx.get(uid) ?? { calls: 0, credits: 0 };
      existing.calls++;
      existing.credits += Math.abs(tx.amount);
      userTx.set(uid, existing);
    }

    const userPhotos  = new Map<string, number>();
    const userExports = new Map<string, number>();
    for (const r of actRows) {
      const uid = r.user_id as string;
      if (r.event === "photo_uploaded") {
        const cnt = (r.metadata as { count?: number })?.count ?? 1;
        userPhotos.set(uid, (userPhotos.get(uid) ?? 0) + cnt);
      }
      if (r.event === "dump_exported") {
        userExports.set(uid, (userExports.get(uid) ?? 0) + 1);
      }
    }

    const users: UserRow[] = authUsers.map(u => {
      const profile = profileById.get(u.id);
      const tx      = userTx.get(u.id);
      return {
        id:              u.id,
        email:           u.email ?? "",
        created_at:      u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        tier:            profile?.subscription_tier ?? "free",
        credits:         profile?.credits ?? 0,
        ai_calls:        tx?.calls ?? 0,
        credits_used:    tx?.credits ?? 0,
        photos_uploaded: userPhotos.get(u.id) ?? 0,
        exports:         userExports.get(u.id) ?? 0,
      };
    }).sort((a, b) => {
      const aTime = a.last_sign_in_at ?? a.created_at;
      const bTime = b.last_sign_in_at ?? b.created_at;
      return bTime.localeCompare(aTime);
    });

    const stats: AdminStats = {
      overview: { total_users, active_today, active_week, ai_calls_today, credits_spent_today },
      feature_usage,
      dau,
      users,
      range,
    };

    return res.status(200).json(stats);

  } catch (err) {
    console.error("[admin-stats] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
