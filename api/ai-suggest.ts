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
  return handleAISuggest(req, res);
}
