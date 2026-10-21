/**
 * POST /api/ai-suggest-refund { token } — user discarded a freshly generated
 * Auto Gen dump; give the credits back. See server/dumpRefund.ts.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { refundCredits, supabaseAdmin } from "../supabaseAdmin.js";
import { claimRefundToken, readRefundToken } from "../dumpRefund.js";

// Each refund returns credits but the AI call was already paid for, so cap
// refunds per user per rolling 24h (ledger rows type = refund_ai_suggest_rejected).
const MAX_REFUNDS_PER_DAY = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required" });
  const claim = readRefundToken((req.body || {}).token);
  if (!claim || claim.userId !== userId) return res.status(400).json({ error: "Invalid refund token" });
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: cntErr } = await supabaseAdmin
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "refund_ai_suggest_rejected")
    .gte("created_at", since);
  if (cntErr) return res.status(500).json({ error: "Refund check failed" });
  if ((count ?? 0) >= MAX_REFUNDS_PER_DAY) {
    return res.status(429).json({ error: "Daily refund limit reached", refunded: 0 });
  }
  if (!(await claimRefundToken(claim.id))) return res.status(409).json({ error: "Already refunded" });
  try {
    await refundCredits(userId, claim.daily, claim.purchased, "ai_suggest_rejected");
    return res.json({ refunded: claim.daily + claim.purchased });
  } catch (e) {
    console.error("[ai-suggest-refund] failed:", e);
    return res.status(500).json({ error: "Refund failed" });
  }
}
