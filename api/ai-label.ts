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
 * The flag is client-controlled, so the free path is capped server-side
 * (images per request + images per user per day) — see checkAutoCredits.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAILabel, readBody, type AILabelBody } from "../server/aiLabel.js";
import { checkCredits, checkAutoCredits, runCharged } from "../server/creditGate.js";
import { aiLabelCost } from "../shared/aiLabelCost.js";

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
  var imageCount = body && Array.isArray(body.photos) ? body.photos.length : 0;
  // Paid path: 1 credit per photo actually scanned (min 1, max 12 — the
  // handler ignores photos past 12). Refunds return exactly this amount.
  var cost = aiLabelCost(imageCount);
  var gate = auto
    ? await checkAutoCredits(req, res, "ai_label_auto", imageCount) // free but quota-bounded, see creditGate.ts
    : await checkCredits(req, res, "ai_label", { cost: cost, note: cost + (cost === 1 ? " photo" : " photos") });
  if (!gate.proceed) return;

  await runCharged(res, gate, "ai-label", function() { return handleAILabel(req, res, body); });
}
