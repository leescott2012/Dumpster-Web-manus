/**
 * Vercel Serverless Function — POST /api/ai-chat
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAIChat } from "../server/aiChat.js";
import { checkCredits } from "../server/creditGate.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
  memory: 512,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  var gate = await checkCredits(req, res, "ai_chat");
  if (!gate.proceed) return;
  return handleAIChat(req, res);
}
