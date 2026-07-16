/**
 * GET /api/check-username?username=foo — live availability check while typing.
 * PATCH /api/check-username — set the caller's own username (final save).
 *
 * Case-insensitive uniqueness (DB has a unique index on lower(username), this
 * endpoint just gives a friendly response instead of a raw 23505 constraint
 * error reaching the UI).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";
import { enforceRateLimit } from "../rateLimit.js";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/i;

function normalize(username: string): string {
  return username.trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await handleCheck(req, res);
    if (req.method === "PATCH") return await handleSet(req, res);
    return res.status(405).end();
  } catch (err) {
    captureServerError(err, "check-username", { method: req.method });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}

async function handleCheck(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!(await enforceRateLimit(req, res, "check_username", userId))) return;

  const raw = normalize(String(req.query.username || ""));
  if (!raw) return res.status(400).json({ error: "username required" });
  if (!USERNAME_RE.test(raw)) {
    return res.status(200).json({ available: false, reason: "3-20 characters, letters/numbers/underscore only" });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", raw)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  const takenByOther = !!data && data.id !== userId;
  return res.status(200).json({ available: !takenByOther });
}

async function handleSet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  if (!(await enforceRateLimit(req, res, "check_username", userId))) return;

  const body = (req.body || {}) as { username?: string; avatar_icon?: string; avatar_color?: string };
  const raw = normalize(String(body.username || ""));
  if (!USERNAME_RE.test(raw)) {
    return res.status(400).json({ error: "3-20 characters, letters/numbers/underscore only" });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", raw)
    .maybeSingle();
  if (lookupError) return res.status(500).json({ error: lookupError.message });
  if (existing && existing.id !== userId) {
    return res.status(409).json({ error: "Username taken", code: "taken" });
  }

  const patch: Record<string, unknown> = { username: raw };
  // Icon/color are optional and only ever set by their owner — no cross-user risk.
  if (typeof body.avatar_icon === "string") patch.avatar_icon = body.avatar_icon.slice(0, 40);
  if (typeof body.avatar_color === "string") patch.avatar_color = body.avatar_color.slice(0, 20);

  const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
  if (error) {
    // 23505 = unique-index race (two people claiming the same name at once)
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "Username taken", code: "taken" });
    }
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ ok: true, username: raw });
}
