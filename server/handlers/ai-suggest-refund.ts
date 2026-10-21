/**
 * POST /api/ai-suggest-refund { token } — user discarded a freshly generated
 * Auto Gen dump; give the credits back. See server/dumpRefund.ts.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { refundCredits } from "../supabaseAdmin.js";
import { claimRefundToken, readRefundToken } from "../dumpRefund.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required" });
  const claim = readRefundToken((req.body || {}).token);
  if (!claim || claim.userId !== userId) return res.status(400).json({ error: "Invalid refund token" });
  if (!(await claimRefundToken(claim.id))) return res.status(409).json({ error: "Already refunded" });
  try {
    await refundCredits(userId, claim.daily, claim.purchased, "ai_suggest_rejected");
    return res.json({ refunded: claim.daily + claim.purchased });
  } catch (e) {
    console.error("[ai-suggest-refund] failed:", e);
    return res.status(500).json({ error: "Refund failed" });
  }
}
