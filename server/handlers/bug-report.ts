/**
 * POST /api/bug-report — Logs a bug to the bug_reports table.
 *
 * Open to any caller (signed-in or not) — pre-auth crashes need to be
 * loggable too. RLS in Supabase enforces user_id matching for authed
 * inserts. Service role bypasses for admin reads.
 *
 * GET — admin-only: returns recent bug reports for the dashboard panel.
 *   ?limit=50  (default 50, max 200)
 *   ?status=new|seen|fixed (optional)
 *
 * PATCH — admin-only: mark a bug as seen/fixed, add an admin note.
 *   body: { id, status?, admin_note? }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface BugReportBody {
  source:     string;
  message:    string;
  error_code?: string;
  stack?:     string;
  url?:       string;
  user_agent?: string;
  viewport?:  string;
  context?:   unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") return handlePost(req, res);
  if (req.method === "GET")  return handleGet(req, res);
  if (req.method === "PATCH") return handlePatch(req, res);
  return res.status(405).end();
}

// ── POST: log a new bug ──────────────────────────────────────────────────────
async function handlePost(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req); // may be null — that's OK
  const body = (req.body || {}) as BugReportBody;

  if (!body.source || !body.message) {
    return res.status(400).json({ error: "source and message required" });
  }

  // Read email separately (we want the snapshot even if user gets deleted later).
  let email: string | null = null;
  if (userId) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = data?.user?.email ?? null;
  }

  // Hard caps on text lengths so a runaway loop can't blow up storage.
  const truncate = (s: string | undefined, n: number) => (s ?? "").slice(0, n);

  const { data, error } = await supabaseAdmin
    .from("bug_reports")
    .insert({
      user_id:    userId,
      email,
      source:     truncate(body.source,   80),
      message:    truncate(body.message,  2000),
      error_code: truncate(body.error_code, 200) || null,
      stack:      truncate(body.stack,    8000) || null,
      url:        truncate(body.url,      2000) || null,
      user_agent: truncate(body.user_agent, 500) || null,
      viewport:   truncate(body.viewport, 32) || null,
      context:    body.context ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[bug-report] insert failed:", error);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ ok: true, id: data?.id });
}

// ── GET: list (admin only) ──────────────────────────────────────────────────
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return res.status(503).json({ error: "ADMIN_USER_ID not set." });
  if (userId !== adminId) return res.status(403).json({ error: "Forbidden." });

  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const status = (req.query.status as string | undefined)?.trim();

  let q = supabaseAdmin
    .from("bug_reports")
    .select("id, user_id, email, source, message, error_code, stack, url, user_agent, viewport, context, status, admin_note, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && ["new", "seen", "fixed", "wontfix"].includes(status)) {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ reports: data ?? [] });
}

// ── PATCH: mark seen/fixed (admin only) ─────────────────────────────────────
async function handlePatch(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return res.status(503).json({ error: "ADMIN_USER_ID not set." });
  if (userId !== adminId) return res.status(403).json({ error: "Forbidden." });

  const { id, status, admin_note } = (req.body || {}) as { id?: string; status?: string; admin_note?: string };
  if (!id) return res.status(400).json({ error: "id required" });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status && ["new", "seen", "fixed", "wontfix"].includes(status)) patch.status = status;
  if (typeof admin_note === "string") patch.admin_note = admin_note.slice(0, 2000);

  const { error } = await supabaseAdmin
    .from("bug_reports")
    .update(patch)
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
