/**
 * Vercel Serverless Function — POST /api/ai-label
 * Scans a batch of pool photos with Claude Vision and returns category + label
 * for each. Gated by credits like the other AI endpoints.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAILabel } from "../server/aiLabel.js";
import { checkCredits } from "../server/creditGate.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60, // fetch + base64 + Claude vision over up to 12 images
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  var gate = await checkCredits(req, res, "ai_label");
  if (!gate.proceed) return;
  return handleAILabel(req, res);
}
