/**
 * GET  /api/dm?with=<userId>  — thread between caller and that user, oldest first
 * POST /api/dm { recipientId, body } — send a message
 *
 * The connection check is done here explicitly (not left to RLS alone) per
 * the spec's open-risks note: a declined/revoked connection must block new
 * sends immediately with a clean error, not a generic constraint-violation.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";
import { enforceRateLimit } from "../rateLimit.js";

const MAX_BODY_LEN = 4000;

async function isAcceptedConnection(a: string, b: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("connections")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .maybeSingle();
  return !!data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    return res.status(405).end();
  } catch (err) {
    captureServerError(err, "dm", { method: req.method });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  const withId = String(req.query.with || "");
  if (!withId) return res.status(400).json({ error: "with (user id) required" });

  const { data, error } = await supabaseAdmin
    .from("dm_messages")
    .select("id, sender_id, recipient_id, body, read_at, created_at")
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${withId}),and(sender_id.eq.${withId},recipient_id.eq.${userId})`
    )
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });

  // Mark received messages as read on open.
  await supabaseAdmin
    .from("dm_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", withId)
    .eq("recipient_id", userId)
    .is("read_at", null);

  return res.status(200).json({ messages: data ?? [] });
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  if (!(await enforceRateLimit(req, res, "dm_send", userId))) return;

  const body = (req.body || {}) as { recipientId?: string; body?: string };
  const recipientId = String(body.recipientId || "");
  const text = String(body.body || "").trim().slice(0, MAX_BODY_LEN);
  if (!recipientId || !text) return res.status(400).json({ error: "recipientId and body required" });
  if (recipientId === userId) return res.status(400).json({ error: "Can't message yourself" });

  if (!(await isAcceptedConnection(userId, recipientId))) {
    return res.status(403).json({ error: "You're not connected with this user", code: "not_connected" });
  }

  const { data, error } = await supabaseAdmin
    .from("dm_messages")
    .insert({ sender_id: userId, recipient_id: recipientId, body: text })
    .select("id, created_at")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await supabaseAdmin.from("notifications").insert({
    user_id: recipientId,
    type: "dm",
    title: "New message",
    body: text.slice(0, 140),
    link: `/messages/${userId}`,
  });

  return res.status(200).json({ ok: true, id: data?.id, created_at: data?.created_at });
}
