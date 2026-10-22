/**
 * GET   /api/dm                      — conversation list (last message + unread per friend) + unreadTotal
 * GET   /api/dm?with=<userId>        — thread between caller and that user, oldest first
 * POST  /api/dm { recipientId, body } — send a message (accepted friends only, no blocks)
 * PATCH /api/dm { with, action: "block" | "unblock" } — stop / resume messages with a friend
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
import { notify, usernameOf } from "../notify.js";
import { DM_MAX_LEN, canMessage, dmKey, dmTitle } from "../../shared/notifications.js";

const MAX_BODY_LEN = DM_MAX_LEN;

/** dm_blocks missing (supabase-social.sql not applied) => no blocks, feature hidden via blockingAvailable=false. */
async function blockState(me: string, other: string): Promise<{ available: boolean; byMe: boolean; byThem: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("dm_blocks").select("blocker_id, blocked_id")
    .or(`and(blocker_id.eq.${me},blocked_id.eq.${other}),and(blocker_id.eq.${other},blocked_id.eq.${me})`);
  if (error) return { available: false, byMe: false, byThem: false };
  return {
    available: true,
    byMe: (data ?? []).some((r) => r.blocker_id === me),
    byThem: (data ?? []).some((r) => r.blocker_id === other),
  };
}

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
    if (req.method === "PATCH") return await handlePatch(req, res);
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
  if (!withId) return await handleList(userId, res);
  if (!/^[0-9a-f-]{36}$/i.test(withId)) return res.status(400).json({ error: "bad user id" });

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

  // The collapsed "N new messages" bell row for this friend is now read too.
  await supabaseAdmin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId).eq("dedupe_key", dmKey(withId)).is("read_at", null);

  const blk = await blockState(userId, withId);
  return res.status(200).json({
    messages: data ?? [], blockingAvailable: blk.available, blockedByMe: blk.byMe, blockedByThem: blk.byThem,
  });
}

async function handleList(userId: string, res: VercelResponse) {
  const { data: conns, error: cErr } = await supabaseAdmin
    .from("connections").select("requester_id, addressee_id")
    .eq("status", "accepted").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (cErr) return res.status(500).json({ error: cErr.message });
  const friendIds = new Set((conns ?? []).map((c) => (c.requester_id === userId ? c.addressee_id : c.requester_id)));
  if (friendIds.size === 0) return res.status(200).json({ conversations: [], unreadTotal: 0 });

  // ponytail: scan the latest 500 messages in-process; swap for a SQL view/RPC if threads outgrow this.
  const { data: msgs, error } = await supabaseAdmin
    .from("dm_messages").select("sender_id, recipient_id, body, read_at, created_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false }).limit(500);
  if (error) return res.status(500).json({ error: error.message });

  const byFriend = new Map<string, { last: { body: string; created_at: string; mine: boolean }; unread: number }>();
  for (const m of msgs ?? []) {
    const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (!friendIds.has(other)) continue;
    let c = byFriend.get(other);
    if (!c) { c = { last: { body: m.body, created_at: m.created_at, mine: m.sender_id === userId }, unread: 0 }; byFriend.set(other, c); }
    if (m.recipient_id === userId && !m.read_at) c.unread++;
  }
  const ids = Array.from(byFriend.keys());
  const { data: profs } = ids.length
    ? await supabaseAdmin.from("profiles").select("id, username, avatar_icon, avatar_color").in("id", ids)
    : { data: [] as { id: string; username: string | null; avatar_icon: string | null; avatar_color: string | null }[] };
  const pById = new Map((profs ?? []).map((p) => [p.id, p]));
  const conversations = ids
    .map((id) => ({ other: pById.get(id) ?? { id, username: null, avatar_icon: null, avatar_color: null }, last: byFriend.get(id)!.last, unread: byFriend.get(id)!.unread }))
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  return res.status(200).json({ conversations, unreadTotal: conversations.reduce((n, c) => n + c.unread, 0) });
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  const b = (req.body || {}) as { with?: string; action?: string };
  const other = String(b.with || "");
  if (!/^[0-9a-f-]{36}$/i.test(other) || other === userId || !["block", "unblock"].includes(String(b.action))) {
    return res.status(400).json({ error: "with and action (block|unblock) required" });
  }
  const q = b.action === "block"
    ? await supabaseAdmin.from("dm_blocks").upsert({ blocker_id: userId, blocked_id: other })
    : await supabaseAdmin.from("dm_blocks").delete().eq("blocker_id", userId).eq("blocked_id", other);
  if (q.error) return res.status(503).json({ error: "Blocking isn't available yet" }); // table missing -> fail closed
  return res.status(200).json({ ok: true });
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

  const accepted = await isAcceptedConnection(userId, recipientId);
  if (!accepted) {
    return res.status(403).json({ error: "You're not connected with this user", code: "not_connected" });
  }
  const blk = await blockState(userId, recipientId);
  if (!canMessage({ accepted, blockedEitherWay: blk.byMe || blk.byThem, self: false })) {
    return res.status(403).json({ error: blk.byMe ? "You blocked this person. Unblock to message." : "Can't message this person.", code: "blocked" });
  }

  const { data, error } = await supabaseAdmin
    .from("dm_messages")
    .insert({ sender_id: userId, recipient_id: recipientId, body: text })
    .select("id, created_at")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const who = await usernameOf(userId);
  await notify({
    userId: recipientId, type: "dm", actorId: userId, title: dmTitle(who, 1), body: text.slice(0, 140),
    link: `/messages/${userId}`, dedupeKey: dmKey(userId), rolling: { title: (n) => dmTitle(who, n) },
  });

  return res.status(200).json({ ok: true, id: data?.id, created_at: data?.created_at });
}
