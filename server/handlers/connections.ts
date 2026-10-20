/**
 * GET /api/connections?mode=search&q=foo   — username prefix search (excludes self), capped 20
 * GET /api/connections?mode=list           — my connections + pending requests (incoming/outgoing)
 * POST /api/connections { username }       — send a connection request to that username
 * PATCH /api/connections { id, status }    — addressee accepts/declines a pending request
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";
import { enforceRateLimit } from "../rateLimit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    if (req.method === "PATCH") return await handlePatch(req, res);
    return res.status(405).end();
  } catch (err) {
    captureServerError(err, "connections", { method: req.method });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  const mode = String(req.query.mode || "list");

  if (mode === "search") {
    // Instagram-style: starts at 1 char, ignores a leading "@", prefix matches first,
    // then "contains", then close spellings ("did you mean") when nothing matches.
    const q = String(req.query.q || "").trim().replace(/^@+/, "").replace(/[%_,()]/g, "");
    if (q.length < 1) return res.status(200).json({ results: [] });
    const cols = "id, username, avatar_icon, avatar_color";
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(cols)
      .ilike("username", `%${q}%`)
      .not("username", "is", null)
      .neq("id", userId)
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    const lq = q.toLowerCase();
    const rank = (u: string | null) => { const l = (u || "").toLowerCase(); return l === lq ? 0 : l.startsWith(lq) ? 1 : 2; };
    const direct = (data ?? []).sort((x, y) => rank(x.username) - rank(y.username) || (x.username || "").length - (y.username || "").length).slice(0, 20);
    if (direct.length > 0 || q.length < 3) return res.status(200).json({ results: direct });

    // ponytail: scan ≤500 usernames in-process; swap for pg_trgm similarity() if the user table outgrows this.
    const { data: pool } = await supabaseAdmin
      .from("profiles").select(cols).not("username", "is", null).neq("id", userId).limit(500);
    const maxDist = Math.max(2, Math.floor(q.length / 3));
    const close = (pool ?? [])
      .map((p) => ({ p, d: editDistance(lq, (p.username || "").toLowerCase()) }))
      .filter((x) => x.d <= maxDist)
      .sort((x, y) => x.d - y.d)
      .slice(0, 8)
      .map((x) => x.p);
    return res.status(200).json({ results: close, fuzzy: close.length > 0 });
  }

  // mode === "list"
  const { data, error } = await supabaseAdmin
    .from("connections")
    .select("id, requester_id, addressee_id, status, created_at, responded_at")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const rows = data ?? [];
  const otherIds = Array.from(
    new Set(rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)))
  );
  let profileById: Record<string, { username: string | null; avatar_icon: string | null; avatar_color: string | null }> = {};
  if (otherIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, username, avatar_icon, avatar_color")
      .in("id", otherIds);
    for (const p of profs ?? []) profileById[p.id] = p;
  }

  const enriched = rows.map((r) => {
    const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
    return { ...r, other: { id: otherId, ...profileById[otherId] } };
  });
  return res.status(200).json({ connections: enriched });
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  if (!(await enforceRateLimit(req, res, "connection_request", userId))) return;

  const body = (req.body || {}) as { username?: string };
  const username = String(body.username || "").trim();
  if (!username) return res.status(400).json({ error: "username required" });

  const { data: target, error: lookupError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (lookupError) return res.status(500).json({ error: lookupError.message });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === userId) return res.status(400).json({ error: "Can't connect with yourself" });

  const { data, error } = await supabaseAdmin
    .from("connections")
    .insert({ requester_id: userId, addressee_id: target.id, status: "pending" })
    .select("id")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "Request already exists", code: "duplicate" });
    }
    return res.status(500).json({ error: error.message });
  }

  await supabaseAdmin.from("notifications").insert({
    user_id: target.id,
    type: "connection_request",
    title: "New connection request",
    body: null,
    link: "/connections",
  });

  return res.status(200).json({ ok: true, id: data?.id });
}

async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  const body = (req.body || {}) as { id?: string; status?: string };
  if (!body.id || !["accepted", "declined"].includes(String(body.status))) {
    return res.status(400).json({ error: "id and valid status required" });
  }

  const { data: row, error: fetchError } = await supabaseAdmin
    .from("connections")
    .select("id, requester_id, addressee_id, status")
    .eq("id", body.id)
    .maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.addressee_id !== userId) return res.status(403).json({ error: "Only the addressee can respond" });
  if (row.status !== "pending") return res.status(409).json({ error: "Already responded" });

  const { error } = await supabaseAdmin
    .from("connections")
    .update({ status: body.status, responded_at: new Date().toISOString() })
    .eq("id", body.id);
  if (error) return res.status(500).json({ error: error.message });

  if (body.status === "accepted") {
    await supabaseAdmin.from("notifications").insert({
      user_id: row.requester_id,
      type: "connection_accepted",
      title: "Connection request accepted",
      body: null,
      link: "/connections",
    });
  }

  return res.status(200).json({ ok: true });
}
