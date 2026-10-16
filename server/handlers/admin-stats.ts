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
 *   - activity_log        → DAU, photo uploads, exports, free auto-label calls
 *   - Upstash Redis       → today's AI $ spend vs DAILY_BUDGET_USD, calls by feature
 *
 * ?ping=1 → auth + owner check only, returns { ok } (dashboard API latency).
 *
 * Set ADMIN_USER_ID in Vercel env to your Supabase user UUID.
 * Find it: Supabase → Authentication → Users → your row → copy UUID.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { getUserFromRequest } from "../creditGate.js";
import { createClient } from "@supabase/supabase-js";
import { captureServerError } from "../sentry.js";
import { getTodaySpend } from "../dailyBudget.js";

// Use service_role client directly for admin API access
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureUsageRow {
  action: string;
  count: number;          // charged calls
  credits: number;        // credits charged (gross)
  refunds: number;        // refunded calls (refund_<action> ledger rows)
  refunded_credits: number;
}

interface DauRow {
  date: string;
  count: number;
}

interface RevenueDay {
  date: string;
  amount_cents: number;
}

interface RevenueSummary {
  today_cents:  number;
  week_cents:   number;
  month_cents:  number;
  total_cents:  number;
  daily:        RevenueDay[];   // last `dauDays` days, oldest first
  currency:     string;          // ISO 4217, e.g. "usd"
  source:       "stripe" | "unavailable";
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  last_active_at: string | null; // latest of sign-in / activity_log / ledger row
  is_owner: boolean;
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
    ai_calls_today: number;       // charged calls, rolling 24h
    credits_spent_today: number;  // net of refunds, rolling 24h
    refunds_today: number;
    credits_refunded_today: number;
  };
  ops: {
    // Redis daily-budget counters (UTC day). source=unavailable → Upstash not configured.
    spend_cents: number;
    budget_cents: number;
    calls_by_action: Record<string, number>;
    source: "redis" | "unavailable";
  };
  feature_usage: FeatureUsageRow[];
  dau: DauRow[];
  users: UserRow[];
  revenue: RevenueSummary;
  range: string;
}

/**
 * Fetch revenue stats from Stripe — daily buckets + today/week/month sums.
 * Uses balance_transactions so we get NET amounts (after Stripe fees) and
 * naturally net out refunds. Pages through up to 500 transactions which is
 * plenty for a friends beta and most early production volume.
 *
 * Returns a zeroed `unavailable` summary if STRIPE_SECRET_KEY isn't set or
 * the API call fails — the rest of the dashboard keeps working.
 */
async function fetchRevenue(rangeStartIso: string, dauDays: number): Promise<RevenueSummary> {
  const empty = (source: "stripe" | "unavailable" = "unavailable"): RevenueSummary => {
    const daily: RevenueDay[] = [];
    for (let d = 0; d < dauDays; d++) {
      const dt = new Date(Date.now() - (dauDays - 1 - d) * 24 * 60 * 60 * 1000);
      daily.push({ date: dt.toISOString().slice(0, 10), amount_cents: 0 });
    }
    return { today_cents: 0, week_cents: 0, month_cents: 0, total_cents: 0, daily, currency: "usd", source };
  };

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return empty("unavailable");

  try {
    const stripe = new Stripe(key);
    const sinceSec = Math.floor(new Date(rangeStartIso).getTime() / 1000);

    let currency = "usd";
    let totalNetCents = 0;
    const dayMap = new Map<string, number>();
    const nowSec = Math.floor(Date.now() / 1000);
    const oneDaySec   = 24 * 60 * 60;
    const sevenDaySec =  7 * oneDaySec;
    const thirtyDaySec = 30 * oneDaySec;
    let todayCents = 0, weekCents = 0, monthCents = 0;

    // Page up to 5 pages × 100 = 500 records, defensive cap.
    let startingAfter: string | undefined = undefined;
    for (let page = 0; page < 5; page++) {
      const list: Stripe.ApiList<Stripe.BalanceTransaction> = await stripe.balanceTransactions.list({
        limit: 100,
        created: { gte: sinceSec },
        starting_after: startingAfter,
      });

      for (const bt of list.data) {
        // Keep "charge" (sale) and "refund" — refund.net is negative which subtracts naturally.
        if (bt.type !== "charge" && bt.type !== "refund" && bt.type !== "payment") continue;
        currency = bt.currency || currency;
        totalNetCents += bt.net;

        const ageSec = nowSec - bt.created;
        if (ageSec <= oneDaySec)   todayCents += bt.net;
        if (ageSec <= sevenDaySec) weekCents  += bt.net;
        if (ageSec <= thirtyDaySec) monthCents += bt.net;

        const dayKey = new Date(bt.created * 1000).toISOString().slice(0, 10);
        dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + bt.net);
      }

      if (!list.has_more || list.data.length === 0) break;
      startingAfter = list.data[list.data.length - 1].id;
    }

    // Fill daily buckets oldest-first (parity with DAU chart x-axis).
    const daily: RevenueDay[] = [];
    for (let d = 0; d < dauDays; d++) {
      const dt = new Date(Date.now() - (dauDays - 1 - d) * 24 * 60 * 60 * 1000);
      const key = dt.toISOString().slice(0, 10);
      daily.push({ date: key, amount_cents: dayMap.get(key) ?? 0 });
    }

    return {
      today_cents:  todayCents,
      week_cents:   weekCents,
      month_cents:  monthCents,
      total_cents:  totalNetCents,
      daily,
      currency,
      source: "stripe",
    };
  } catch (err) {
    captureServerError(err, "admin-stats.stripe_revenue");
    return empty("unavailable");
  }
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

  // Cheap authenticated health ping for the dashboard's API latency readout.
  if (req.query.ping) return res.status(200).json({ ok: true });

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
    const [usersResult, profilesResult, txResult, activityResult, revenue, ops] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 } as any),

      supabaseAdmin
        .from("profiles")
        .select("id, credits, subscription_tier"),

      supabaseAdmin
        .from("credit_transactions")
        .select("user_id, amount, type, created_at")
        .gte("created_at", rangeStart),

      supabaseAdmin
        .from("activity_log")
        .select("user_id, event, metadata, created_at")
        .gte("created_at", rangeStart),

      // Stripe revenue (daily + sums). Independent of Supabase, so we parallelise.
      fetchRevenue(rangeStart, dauDays),

      getTodaySpend().catch((err) => {
        captureServerError(err, "admin-stats.daily_budget");
        return { cents: 0, limitCents: 0, calls: {}, source: "unavailable" as const };
      }),
    ]);

    const authUsers  = usersResult.data?.users ?? [];
    const profiles   = profilesResult.data ?? [];
    const allTx      = txResult.data ?? [];
    // Charges are negative rows; refunds are positive `refund_<action>` rows
    // (supabaseAdmin.refundCredits). Other positive rows are purchases/grants.
    const txRows     = allTx.filter((r: any) => r.amount < 0);
    const refundRows = allTx.filter((r: any) => typeof r.type === "string" && r.type.startsWith("refund_"));
    const actRows    = activityResult.data ?? [];

    // ── Index maps ────────────────────────────────────────────────────────────
    const profileById = new Map<string, { credits: number; subscription_tier: string }>();
    for (const p of profiles) {
      profileById.set(p.id, p);
    }

    // ── Overview ──────────────────────────────────────────────────────────────
    const total_users = authUsers.length;

    // "Active" = any activity_log event OR any AI charge — session_start alone
    // misses users whose tab stayed open across days.
    const activityEvents = [
      ...actRows.map((r: any) => ({ user_id: r.user_id as string, created_at: r.created_at as string })),
      ...txRows.map((r: any) => ({ user_id: r.user_id as string, created_at: r.created_at as string })),
    ];
    const active_today = new Set(
      activityEvents.filter(r => r.created_at >= oneDayAgo).map(r => r.user_id)
    ).size;
    const active_week = new Set(
      activityEvents.filter(r => r.created_at >= sevenDaysAgo).map(r => r.user_id)
    ).size;

    const txToday      = txRows.filter((r: any) => r.created_at >= oneDayAgo);
    const refundsToday = refundRows.filter((r: any) => r.created_at >= oneDayAgo);
    const ai_calls_today         = txToday.length;
    const credits_refunded_today = refundsToday.reduce((s: number, r: any) => s + r.amount, 0);
    const credits_spent_today    = txToday.reduce((s: number, r: any) => s + Math.abs(r.amount), 0) - credits_refunded_today;

    // ── Feature usage ─────────────────────────────────────────────────────────
    const featureMap = new Map<string, Omit<FeatureUsageRow, "action">>();
    const feat = (key: string) => {
      let v = featureMap.get(key);
      if (!v) { v = { count: 0, credits: 0, refunds: 0, refunded_credits: 0 }; featureMap.set(key, v); }
      return v;
    };
    for (const tx of txRows as any[]) {
      const v = feat(tx.type as string);
      v.count++;
      v.credits += Math.abs(tx.amount);
    }
    for (const tx of refundRows as any[]) {
      const v = feat((tx.type as string).slice("refund_".length));
      v.refunds++;
      v.refunded_credits += tx.amount;
    }
    const feature_usage: FeatureUsageRow[] = Array.from(featureMap.entries())
      .map(([action, v]) => ({ action, ...v }))
      .sort((a, b) => b.count - a.count);

    // ── DAU ───────────────────────────────────────────────────────────────────
    const dauWindowStart = new Date(Date.now() - dauDays * 24 * 60 * 60 * 1000).toISOString();
    const dauMap = new Map<string, Set<string>>();
    for (const r of activityEvents) {
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
    for (const tx of refundRows) {
      const existing = userTx.get(tx.user_id as string);
      if (existing) existing.credits -= tx.amount; // net of refunds
    }

    // Latest real activity per user. auth.last_sign_in_at only moves on an
    // explicit sign-in (token refreshes don't touch it), so on its own it
    // reads days stale for anyone who stays signed in.
    const lastActive = new Map<string, string>();
    for (const r of [...activityEvents, ...refundRows as any[]]) {
      const prev = lastActive.get(r.user_id);
      if (!prev || r.created_at > prev) lastActive.set(r.user_id, r.created_at);
    }

    const userPhotos  = new Map<string, number>();
    const userExports = new Map<string, number>();
    for (const r of actRows as any[]) {
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
      const signIn  = u.last_sign_in_at ?? null;
      const act     = lastActive.get(u.id) ?? null;
      // Compare as Date: auth uses "Z", Postgres uses "+00:00" — string compare would lie.
      const last_active_at = !act ? signIn : !signIn ? act
        : (new Date(act).getTime() > new Date(signIn).getTime() ? act : signIn);
      return {
        id:              u.id,
        email:           u.email ?? "",
        created_at:      u.created_at,
        last_sign_in_at: signIn,
        last_active_at,
        is_owner:        u.id === adminId,
        tier:            profile?.subscription_tier ?? "free",
        credits:         profile?.credits ?? 0,
        ai_calls:        tx?.calls ?? 0,
        credits_used:    tx?.credits ?? 0,
        photos_uploaded: userPhotos.get(u.id) ?? 0,
        exports:         userExports.get(u.id) ?? 0,
      };
    }).sort((a, b) => {
      const aTime = new Date(a.last_active_at ?? a.created_at).getTime();
      const bTime = new Date(b.last_active_at ?? b.created_at).getTime();
      return bTime - aTime;
    });

    const stats: AdminStats = {
      overview: {
        total_users, active_today, active_week, ai_calls_today, credits_spent_today,
        refunds_today: refundsToday.length, credits_refunded_today,
      },
      ops: { spend_cents: ops.cents, budget_cents: ops.limitCents, calls_by_action: ops.calls, source: ops.source },
      feature_usage,
      dau,
      users,
      revenue,
      range,
    };

    return res.status(200).json(stats);

  } catch (err) {
    captureServerError(err, "admin-stats", { userId });
    return res.status(500).json({ error: "Internal error" });
  }
}
