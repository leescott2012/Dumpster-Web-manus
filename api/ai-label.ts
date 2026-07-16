/**
 * Vercel Serverless Function — POST /api/ai-label
 * Scans a batch of pool photos with Claude Vision and returns category + label
 * for each.
 *
 * Two credit-gate modes on ONE function (not two separate routes) — Vercel's
 * Hobby plan caps a deployment at 12 serverless functions, so this and the
 * system auto-heal path (client/src/lib/aiLabel.ts's autoScanPhotos) share
 * this file. Body flag `auto: true` selects the free/system-initiated path
 * (checkAutoCredits — same auth/rate-limit/budget gates, no credit charge);
 * omitted or false is the normal paid user-initiated Scan (checkCredits).
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAILabel, readBody, type AILabelBody } from "../server/aiLabel.js";
import { checkCredits, checkAutoCredits } from "../server/creditGate.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60, // fetch + base64 + Claude vision over up to 12 images
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  var body: AILabelBody;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  var auto = body.auto === true;
  var gate = auto
    ? await checkAutoCredits(req, res, "ai_label_auto")
    : await checkCredits(req, res, "ai_label");
  if (!gate.proceed) return;

  return handleAILabel(req, res, body);
}
