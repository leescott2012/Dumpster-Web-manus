/**
 * Vercel Serverless Function — POST /api/ai-suggest
 * Wraps the shared handler that powers both Vite dev middleware and Express.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAISuggest } from "../server/aiSuggest.js";
import { checkCredits } from "../server/creditGate.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60, // 60s to fetch + base64 + call Claude with up to 20 images
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  var gate = await checkCredits(req, res, "ai_suggest");
  if (!gate.proceed) return;
  try {
    await handleAISuggest(req, res);
  } finally {
    // Refund credits if the request didn't actually succeed — no reason to
    // charge the user for a failed/errored Claude call.
    if (res.statusCode >= 400) await gate.refund();
  }
}
