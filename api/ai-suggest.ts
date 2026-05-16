/**
 * Vercel Serverless Function — POST /api/ai-suggest
 * Wraps the shared handler that powers both Vite dev middleware and Express.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { handleAISuggest } from "../server/aiSuggest.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60, // 60s to fetch + base64 + call Claude with up to 20 images
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  return handleAISuggest(req, res);
}
