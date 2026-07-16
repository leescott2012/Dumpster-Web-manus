/**
 * Vercel Serverless Function — POST /api/ai-label-auto
 * Same as /api/ai-label (Claude Vision category + label scan) but for
 * system-initiated auto-healing of stale/legacy photo categories — gated by
 * auth/rate-limit/budget like every AI endpoint, but does NOT charge the
 * user's credits (see checkAutoCredits).
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAILabel } from "../server/aiLabel.js";
import { checkAutoCredits } from "../server/creditGate.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  var gate = await checkAutoCredits(req, res, "ai_label_auto");
  if (!gate.proceed) return;
  return handleAILabel(req, res);
}
