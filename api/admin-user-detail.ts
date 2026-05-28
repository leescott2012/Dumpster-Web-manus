/**
 * /api/admin-user-detail — Per-user drill-down for the admin dashboard
 *
 * Returns the credit transaction history and activity log for a specific user.
 * Protected: only ADMIN_USER_ID can call this.
 *
 * GET /api/admin-user-detail?userId=<uuid>
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../server/creditGate.js";
import { supabaseAdmin } from "../server/supabaseAdmin.js";

interface TransactionRow {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

interface ActivityRow {
  id: string;
  event: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface UserDetail {
  transactions: TransactionRow[];
  activity: ActivityRow[];
  lastSignInIp: string | null;
  userEmail: string;
  lastSignIn: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return res.status(503).json({ error: "ADMIN_USER_ID env var not set." });
  if (userId !== adminId) return res.status(403).json({ error: "Forbidden." });

  const targetUserId = req.query.userId as string;
  if (!targetUserId) return res.status(400).json({ error: "userId param required." });

  try {
    const [txResult, actResult, userResult] = await Promise.all([
      supabaseAdmin
        .from("credit_transactions")
        .select("id, amount, type, description, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(50),

      supabaseAdmin
        .from("activity_log")
        .select("id, event, metadata, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(50),

      supabaseAdmin.auth.admin.getUserById(targetUserId),
    ]);

    const transactions = txResult.data ?? [];
    const activity = actResult.data ?? [];
    const authUser = userResult.data?.user;

    // Supabase exposes last_sign_in_ip on the auth admin user object
    const lastSignInIp = (authUser as any)?.last_sign_in_ip ?? null;

    return res.status(200).json({
      transactions,
      activity,
      lastSignInIp,
      userEmail: authUser?.email ?? "",
      lastSignIn: authUser?.last_sign_in_at ?? null,
    } as UserDetail);
  } catch (err) {
    console.error("[admin-user-detail] error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
