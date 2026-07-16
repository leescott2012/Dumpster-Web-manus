/**
 * GET   /api/notifications                 — newest first, capped 50
 * PATCH /api/notifications { id }          — mark one read
 * PATCH /api/notifications { markAllRead }  — mark all read
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "PATCH") return await handlePatch(req, res);
    return res.status(405).end();
  } catch (err) {
    captureServerError(err, "notifications", { method: req.method });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;
  return res.status(200).json({ notifications: data ?? [], unreadCount });
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  const body = (req.body || {}) as { id?: string; markAllRead?: boolean };
  const now = new Date().toISOString();

  if (body.markAllRead) {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (!body.id) return res.status(400).json({ error: "id or markAllRead required" });
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ read_at: now })
    .eq("id", body.id)
    .eq("user_id", userId); // ownership guard — can't mark someone else's notification read
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
