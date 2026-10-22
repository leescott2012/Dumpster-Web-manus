/**
 * notify() — the one place server code creates notifications. NEVER throws:
 * a notification failure must not break the action that caused it.
 * Works before supabase-social.sql is applied (falls back to the legacy columns).
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { nextRollingCount, type NotificationType } from "../shared/notifications.js";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
  data?: Record<string, unknown>;
  /** Unique per user: the same key can only ever create one row (idempotent daily/once-only items). */
  dedupeKey?: string;
  /** With dedupeKey: instead of ignoring repeats, update the row ("3 new messages") and mark it unread. */
  rolling?: { title: (count: number) => string };
}

export async function notify(n: NotifyInput): Promise<void> {
  try {
    if (n.dedupeKey && n.rolling) return await rollingUpsert(n);

    const rich = {
      user_id: n.userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null,
      actor_id: n.actorId ?? null, data: n.data ?? {}, dedupe_key: n.dedupeKey ?? null,
    };
    const { error } = await supabaseAdmin.from("notifications").insert(rich);
    if (!error) return;
    if (error.code === "23505") return; // dedupe hit: already notified
    if (n.dedupeKey) return; // dedupe columns missing (SQL not applied): skip rather than spam daily
    // Legacy table shape (supabase-social.sql not applied yet).
    await supabaseAdmin.from("notifications").insert({
      user_id: n.userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null,
    });
  } catch (e) {
    console.error("[notify] failed:", e instanceof Error ? e.message : e);
  }
}

async function rollingUpsert(n: NotifyInput): Promise<void> {
  const { data: existing, error } = await supabaseAdmin
    .from("notifications").select("id, read_at, data")
    .eq("user_id", n.userId).eq("dedupe_key", n.dedupeKey!).maybeSingle();
  if (error) { // columns missing -> plain legacy row
    await supabaseAdmin.from("notifications").insert({
      user_id: n.userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null,
    });
    return;
  }
  const count = nextRollingCount(existing as { read_at: string | null; data?: { count?: number } | null } | null);
  const row = {
    title: n.rolling!.title(count), body: n.body ?? null, link: n.link ?? null, actor_id: n.actorId ?? null,
    data: { ...(n.data ?? {}), count }, read_at: null, created_at: new Date().toISOString(),
  };
  if (existing) {
    await supabaseAdmin.from("notifications").update(row).eq("id", existing.id);
  } else {
    // A concurrent insert can race us into the unique index; that just drops one count.
    await supabaseAdmin.from("notifications").insert({ user_id: n.userId, type: n.type, dedupe_key: n.dedupeKey, ...row });
  }
}

/** Short display name for titles. */
export async function usernameOf(userId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin.from("profiles").select("username").eq("id", userId).maybeSingle();
    return data?.username ? "@" + data.username : "Someone";
  } catch { return "Someone"; }
}
