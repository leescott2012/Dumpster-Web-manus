/**
 * Vercel Serverless Function — POST /api/ai-caption
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAICaption } from "../server/aiCaption.js";
import { learnedForUser } from "../server/learned.js";
import { checkCredits, runCharged } from "../server/creditGate.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  var gate = await checkCredits(req, res, "ai_caption");
  if (!gate.proceed) return;
  await runCharged(res, gate, "ai-caption", async function() { return handleAICaption(req, res, await learnedForUser(gate.userId)); });
}
