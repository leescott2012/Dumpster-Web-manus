/**
 * PATCH /api/dump-visibility { dumpId, public } — toggle a dump's public flag.
 *
 * Deliberately NOT routed through /api/workspace's full-sync payload — that
 * handler rebuilds all of a user's dumps from a shape with no `public` field
 * and carries real safety weight (cross-account id-conflict checks, stale-row
 * deletion). This is a single, isolated update scoped to the caller's own row.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "PATCH") return res.status(405).end();

    const userId = await getUserFromRequest(req);
    if (!userId) return res.status(401).json({ error: "Sign in required." });

    const body = (req.body || {}) as { dumpId?: string; public?: boolean };
    if (!body.dumpId || typeof body.public !== "boolean") {
      return res.status(400).json({ error: "dumpId and public (boolean) required" });
    }

    const { data, error } = await supabaseAdmin
      .from("dumps")
      .update({ public: body.public })
      .eq("id", body.dumpId)
      .eq("user_id", userId) // ownership guard
      .select("id, public")
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Dump not found or not yours" });

    return res.status(200).json({ ok: true, dumpId: data.id, public: data.public });
  } catch (err) {
    captureServerError(err, "dump-visibility", { method: req.method });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}
