/**
 * Vercel Serverless Function — POST /api/ai-chat
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAIChat } from "../server/aiChat.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
  memory: 512,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return handleAIChat(req, res);
}
