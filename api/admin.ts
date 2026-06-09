/**
 * /api/admin — consolidated router for the admin-only endpoints.
 *
 * Vercel's Hobby plan caps a deployment at 12 Serverless Functions. These five
 * admin-only handlers (owner-gated, not in the user/billing path) are bundled
 * behind this single function and dispatched by the `fn` query param. The
 * original public URLs (/api/admin-stats, /api/genius-chat, /api/tts, etc.) are
 * preserved via rewrites in vercel.json, so no client changes are required.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import adminStats from "../server/handlers/admin-stats.js";
import adminUserDetail from "../server/handlers/admin-user-detail.js";
import bugReport from "../server/handlers/bug-report.js";
import geniusChat from "../server/handlers/genius-chat.js";
import tts from "../server/handlers/tts.js";

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

const ROUTES: Record<string, Handler> = {
  "admin-stats": adminStats as Handler,
  "admin-user-detail": adminUserDetail as Handler,
  "bug-report": bugReport as Handler,
  "genius-chat": geniusChat as Handler,
  "tts": tts as Handler,
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  const fn = String((req.query.fn as string | undefined) ?? "");
  const route = ROUTES[fn];
  if (!route) {
    return res.status(404).json({ error: `Unknown admin route: ${fn || "(none)"}` });
  }
  return route(req, res);
}
