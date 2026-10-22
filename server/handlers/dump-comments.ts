/**
 * GET  /api/dump-comments?dumpId=…            — comments on a dump (oldest first)
 * POST /api/dump-comments { dumpId, body }    — leave a comment
 *
 * Allowed for the dump's owner, or for an accepted connection of the owner when
 * the dump is public. Everything goes through the service role (table has RLS on, no policies).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";
import { notify, usernameOf } from "../notify.js";
import { commentKey, commentTitle } from "../../shared/notifications.js";

async function loadDumpIfAllowed(userId: string, dumpId: string) {
  const { data: dump } = await supabaseAdmin.from("dumps").select("id, user_id, title, public").eq("id", dumpId).maybeSingle();
  if (!dump) return null;
  if (dump.user_id === userId) return dump;
  if (!dump.public) return null;
  const { data: link } = await supabaseAdmin
    .from("connections").select("id").eq("status", "accepted")
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${dump.user_id}),and(requester_id.eq.${dump.user_id},addressee_id.eq.${userId})`)
    .limit(1).maybeSingle();
  return link ? dump : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await getUserFromRequest(req);
    if (!userId) return res.status(401).json({ error: "Sign in required." });

    if (req.method === "GET") {
      const dumpId = String(req.query.dumpId || "");
      if (!dumpId || !(await loadDumpIfAllowed(userId, dumpId))) return res.status(404).json({ error: "Dump not found" });
      const { data, error } = await supabaseAdmin
        .from("dump_comments").select("id, author_id, body, created_at").eq("dump_id", dumpId).order("created_at").limit(200);
      if (error) return res.status(500).json({ error: error.message });
      const ids = Array.from(new Set((data ?? []).map((c) => c.author_id)));
      const { data: profs } = ids.length
        ? await supabaseAdmin.from("profiles").select("id, username, avatar_icon, avatar_color").in("id", ids)
        : { data: [] as { id: string; username: string | null; avatar_icon: string | null; avatar_color: string | null }[] };
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));
      return res.status(200).json({
        comments: (data ?? []).map((c) => ({ ...c, author: byId.get(c.author_id) ?? null, mine: c.author_id === userId })),
      });
    }

    if (req.method === "POST") {
      const b = (req.body || {}) as { dumpId?: string; body?: string };
      const text = String(b.body || "").trim().slice(0, 500);
      if (!b.dumpId || !text) return res.status(400).json({ error: "dumpId and body required" });
      const dump = await loadDumpIfAllowed(userId, b.dumpId);
      if (!dump) return res.status(404).json({ error: "Dump not found" });
      const { data, error } = await supabaseAdmin
        .from("dump_comments").insert({ dump_id: b.dumpId, author_id: userId, body: text }).select("id, created_at").single();
      if (error) return res.status(500).json({ error: error.message });
      // Fire-and-forget: owner gets "commented on your dump"; earlier commenters get a reply ping.
      await (async () => {
        const who = await usernameOf(userId);
        const name = dump.title || "your dump";
        if (dump.user_id !== userId) {
          await notify({
            userId: dump.user_id, type: "dump_comment", actorId: userId, body: text.slice(0, 120), link: "/connections",
            title: commentTitle(who, name, 1), data: { dumpId: b.dumpId }, dedupeKey: commentKey(b.dumpId!),
            rolling: { title: (n) => commentTitle(who, name, n) },
          });
        }
        const { data: prior } = await supabaseAdmin
          .from("dump_comments").select("author_id").eq("dump_id", b.dumpId!).neq("author_id", userId).limit(50);
        const others = Array.from(new Set((prior ?? []).map((c) => c.author_id))).filter((id) => id !== dump.user_id).slice(0, 10);
        for (const id of others) {
          await notify({
            userId: id, type: "comment_reply", actorId: userId, body: text.slice(0, 120), link: "/connections",
            title: who + " also commented on " + (dump.title || "a dump"), data: { dumpId: b.dumpId },
            dedupeKey: commentKey(b.dumpId!), rolling: { title: (n) => n + " new comments on " + (dump.title || "a dump") },
          });
        }
      })().catch((e) => console.error("[dump-comments] notify failed:", e));
      return res.status(200).json({ ok: true, id: data.id, created_at: data.created_at });
    }

    return res.status(405).end();
  } catch (err) {
    captureServerError(err, "dump-comments", { method: req.method });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}
