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
import { notify, usernameOf } from "../notify.js";

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

function isDemoAccount(email: string | null | undefined): boolean {
  return !!email && email.endsWith("@demo.dumpster.invalid");
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

  if (mode === "profile") {
    // A connection's profile: their public dumps (all of them if it's you).
    const targetId = String(req.query.userId || "");
    if (!targetId) return res.status(400).json({ error: "userId required" });
    if (targetId !== userId) {
      const { data: link } = await supabaseAdmin
        .from("connections").select("id").eq("status", "accepted")
        .or(`and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`)
        .limit(1).maybeSingle();
      if (!link) return res.status(403).json({ error: "Connect with this person to see their profile." });
    }
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id, username, display_name, avatar_icon, avatar_color").eq("id", targetId).maybeSingle();
    if (!prof) return res.status(404).json({ error: "User not found" });
    let dq = supabaseAdmin.from("dumps").select("id, title, subtitle, created_at").eq("user_id", targetId).order("created_at", { ascending: false });
    if (targetId !== userId) dq = dq.eq("public", true);
    const { data: dumps } = await dq;
    const dumpIds = (dumps ?? []).map((d) => d.id);
    const { data: links } = dumpIds.length
      ? await supabaseAdmin.from("dump_photos").select("dump_id, photo_id, order").in("dump_id", dumpIds).order("order")
      : { data: [] as { dump_id: string; photo_id: string; order: number | null }[] };
    const photoIds = Array.from(new Set((links ?? []).map((l) => l.photo_id)));
    const { data: photos } = photoIds.length
      ? await supabaseAdmin.from("photos").select("id, url, label").in("id", photoIds)
      : { data: [] as { id: string; url: string; label: string | null }[] };
    const photoById = new Map((photos ?? []).map((p) => [p.id, p]));
    const { data: counts } = dumpIds.length
      ? await supabaseAdmin.from("dump_comments").select("dump_id").in("dump_id", dumpIds)
      : { data: [] as { dump_id: string }[] };
    const out = (dumps ?? []).map((d) => ({
      id: d.id, title: d.title, subtitle: d.subtitle,
      photos: (links ?? []).filter((l) => l.dump_id === d.id).map((l) => photoById.get(l.photo_id)).filter(Boolean),
      commentCount: (counts ?? []).filter((c) => c.dump_id === d.id).length,
    }));
    return res.status(200).json({ profile: prof, dumps: out });
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
    .select("id, email")
    .ilike("username", username)
    .maybeSingle();
  if (lookupError) return res.status(500).json({ error: lookupError.message });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === userId) return res.status(400).json({ error: "Can't connect with yourself" });

  const { data, error } = await supabaseAdmin
    .from("connections")
    // Seeded demo friend (can't sign in to accept) auto-accepts so the profile + comments flow is testable.
    .insert(isDemoAccount(target.email)
      ? { requester_id: userId, addressee_id: target.id, status: "accepted", responded_at: new Date().toISOString() }
      : { requester_id: userId, addressee_id: target.id, status: "pending" })
    .select("id")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "Request already exists", code: "duplicate" });
    }
    return res.status(500).json({ error: error.message });
  }

  if (!isDemoAccount(target.email)) {
    await notify({
      userId: target.id, type: "connection_request", actorId: userId, link: "/connections",
      title: (await usernameOf(userId)) + " sent you a friend request",
      dedupeKey: "friend_request:" + data?.id,
    });
  }

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
    await notify({
      userId: row.requester_id, type: "connection_accepted", actorId: userId, link: "/connections",
      title: (await usernameOf(userId)) + " accepted your friend request",
      dedupeKey: "friend_accepted:" + row.id,
    });
  }

  return res.status(200).json({ ok: true });
}
