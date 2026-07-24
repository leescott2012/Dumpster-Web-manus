/**
 * /api/admin-user-detail — Per-user activity drill-down
 *
 * Returns activity history, credit transactions, and last known IP
 * for a specific user. Admin-only endpoint.
 *
 * Query params:
 *   ?userId=<supabase-user-uuid>
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { enforceRateLimit } from "../rateLimit.js";
import { captureServerError } from "../sentry.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  // 1) Auth required
  const callerId = await getUserFromRequest(req);
  if (!callerId) {
    return res.status(401).json({ error: "Sign in required." });
  }

  // 2) Owner check
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) {
    return res.status(503).json({ error: "ADMIN_USER_ID env var not set." });
  }
  if (callerId !== adminId) {
    return res.status(403).json({ error: "Forbidden." });
  }

  // Unlike every AI endpoint, this PII/IP lookup had no rate limit at all
  // (backend security audit, 2026-07-01) — a compromised admin session could
  // enumerate every user's activity/IP with no throttle.
  const allowed = await enforceRateLimit(req, res, "admin_user_detail", callerId);
  if (!allowed) return;

  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId query param required." });
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [activityResult, creditsResult, userResult] = await Promise.all([
      // Last 50 activity events for this user
      supabaseAdmin
        .from("activity_log")
        .select("id, event, metadata, created_at")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(50),

      // Last 50 credit transactions for this user
      supabaseAdmin
        .from("credit_transactions")
        .select("id, amount, type, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),

      // Get user details including last IP (if stored in metadata)
      supabaseAdmin.auth.admin.getUserById(userId),
    ]);

    const activity = activityResult.data ?? [];
    const credits  = creditsResult.data ?? [];

    // Try to extract last IP from user metadata or activity log
    const userMeta = (userResult.data?.user as any)?.user_metadata ?? {};
    const lastIp: string | null =
      userMeta.last_ip ??
      (activity.find((a: any) => a.metadata?.ip)?.metadata as any)?.ip ??
      null;

    return res.status(200).json({ activity, credits, last_ip: lastIp });

  } catch (err) {
    captureServerError(err, "admin-user-detail", { userId: callerId });
    return res.status(500).json({ error: "Internal error" });
  }
}
