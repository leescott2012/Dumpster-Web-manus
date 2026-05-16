/**
 * Vercel Serverless Function — POST /api/ai-caption
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAICaption } from "../server/aiCaption.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return handleAICaption(req, res);
}
