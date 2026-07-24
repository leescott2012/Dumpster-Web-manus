/**
 * /api/social — consolidated router for username/connections/DM/notifications/
 * dump-visibility endpoints. Same reasoning as api/admin.ts: Vercel Hobby caps
 * a deployment at 12 Serverless Functions, so new user-facing endpoints are
 * bundled behind this one function and dispatched by the `fn` query param.
 * Friendly public URLs are preserved via rewrites in vercel.json.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import checkUsername from "../server/handlers/check-username.js";
import connections from "../server/handlers/connections.js";
import dm from "../server/handlers/dm.js";
import notifications from "../server/handlers/notifications.js";
import dumpVisibility from "../server/handlers/dump-visibility.js";
import { captureServerError } from "../server/sentry.js";

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

const ROUTES: Record<string, Handler> = {
  "check-username": checkUsername as Handler,
  "connections": connections as Handler,
  "dm": dm as Handler,
  "notifications": notifications as Handler,
  "dump-visibility": dumpVisibility as Handler,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fn = String((req.query.fn as string | undefined) ?? "");
  const route = ROUTES[fn];
  if (!route) {
    return res.status(404).json({ error: `Unknown social route: ${fn || "(none)"}` });
  }
  try {
    return await route(req, res);
  } catch (err) {
    captureServerError(err, "social-router", { fn });
    if (!res.headersSent) res.status(500).json({ error: "Internal error" });
  }
}
