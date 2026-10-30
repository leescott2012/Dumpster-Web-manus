/**
 * GET   /api/notifications                 — newest first, capped 50
 * PATCH /api/notifications { id }          — mark one read
 * PATCH /api/notifications { markAllRead }  — mark all read
 * POST  /api/notifications { day: "YYYY-MM-DD" } — "app open" tick: creates today's reminders
 *       (Instagram reminder, credits low) exactly once per day via dedupe_key. No cron needed.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";
import { notify } from "../notify.js";
import { creditsAreLow, creditsLowKey, isValidDay, pickTip, reminderIgKey, shouldRemindIg, tipKey, tipLink } from "../../shared/notifications.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "PATCH") return await handlePatch(req, res);
    if (req.method === "POST") return await handleTick(req, res);
    return res.status(405).end();
  } catch (err) {
    captureServerError(err, "notifications", { method: req.method });
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  // New columns first; fall back to the legacy shape if supabase-social.sql isn't applied yet.
  let rows: Record<string, unknown>[] | null = null;
  const rich = await supabaseAdmin
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at, actor_id, data")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(60);
  if (!rich.error) rows = rich.data as Record<string, unknown>[];
  else {
    const legacy = await supabaseAdmin
      .from("notifications").select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(60);
    if (legacy.error) return res.status(500).json({ error: legacy.error.message });
    rows = legacy.data as Record<string, unknown>[];
  }
  // True unread total (the list is capped, the badge shouldn't be).
  const { count } = await supabaseAdmin
    .from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return res.status(200).json({ notifications: rows ?? [], unreadCount: count ?? (rows ?? []).filter((n) => !n.read_at).length });
}

async function handleTick(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  const day = (req.body || {}).day;
  const nowMs = Date.now();
  if (!isValidDay(day, nowMs)) return res.status(400).json({ error: "day (YYYY-MM-DD) required" });

  const [{ data: u }, { data: prof }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("profiles")
      .select("credits, daily_credits_remaining, daily_credits_reset_at, lifetime_purchase, subscription_tier")
      .eq("id", userId).maybeSingle(),
  ]);
  const meta = (u?.user?.user_metadata ?? {}) as { ig_handle?: string; ig_pending?: unknown };

  // Instagram: tapped "Later" in onboarding and still not linked -> one reminder a day.
  if (shouldRemindIg({ pendingDay: meta.ig_pending, linked: !!meta.ig_handle, today: day })) {
    await notify({
      userId, type: "reminder", link: "/taste", dedupeKey: reminderIgKey(day),
      title: "Finish linking your Instagram so Valet knows your style",
      body: "Tap to open Taste Profile and build it from Instagram.",
    });
  }

  // Credits low (Pro is a monthly pool now, so it gets the nudge too; only legacy lifetime is skipped).
  if (prof && !prof.lifetime_purchase
    && creditsAreLow({ credits: prof.credits, daily: prof.daily_credits_remaining, dailyResetAt: prof.daily_credits_reset_at, nowMs })) {
    await notify({
      userId, type: "credits_low", link: "/credits", dedupeKey: creditsLowKey(day),
      title: "You're running low on credits", body: "Tap to top up.",
    });
  }

  // Daily TIP: a feature they've never tried. One per day, each tip once ever, not on day one (the tour covers that).
  const accountAgeMs = nowMs - Date.parse(u?.user?.created_at ?? "");
  if (accountAgeMs > 24 * 3600 * 1000) {
    const [{ data: usedRows }, { data: tipRows }] = await Promise.all([
      supabaseAdmin.from("activity_log").select("event").eq("user_id", userId).limit(5000),
      supabaseAdmin.from("notifications").select("dedupe_key, data").eq("user_id", userId).eq("type", "tip"),
    ]);
    const sent = new Set((tipRows ?? []).map((r) => String(r.dedupe_key ?? "").replace(/^tip:/, "")));
    const sentToday = (tipRows ?? []).some((r) => (r.data as { day?: string } | null)?.day === day);
    const tip = sentToday ? null : pickTip(new Set((usedRows ?? []).map((r) => String(r.event))), sent);
    if (tip) await notify({ userId, type: "tip", link: tipLink(tip.id), dedupeKey: tipKey(tip.id), title: tip.title, body: tip.body, data: { day, tip: tip.id } });
  }
  return res.status(200).json({ ok: true });
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
