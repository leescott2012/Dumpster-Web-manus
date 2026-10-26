/**
 * Pure notification/messaging rules shared by the server handlers and the bell UI.
 * Selftest: npx tsx shared/notifications.selftest.ts
 *
 * ADD A NEW NOTIFICATION TYPE: (1) add it to NOTIFICATION_TYPES, (2) call notify() from the
 * server code where the event happens (dedupeKey for once-only/daily, rolling:true to
 * collapse repeats), (3) add an icon in NotificationBell TYPE_ICON, (4) if tapping should open
 * something, add a case to parseLink + the listener in Home.tsx. No migration needed.
 */

export const NOTIFICATION_TYPES = [
  "connection_request", "connection_accepted", "dump_comment", "comment_reply", "dm",
  "referral_reward", "credits_low", "reminder", "tip", "system", "bug_reply", "admin_broadcast",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DM_MAX_LEN = 2000;

/** YYYY-MM-DD (the client sends its LOCAL day so "daily" matches the user's day). */
export function isValidDay(day: unknown, nowMs: number): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = Date.parse(day + "T12:00:00Z");
  return !isNaN(t) && Math.abs(t - nowMs) <= 36 * 3600 * 1000; // any timezone is within ~1 day
}

export const reminderIgKey = (day: string) => "reminder_ig:" + day;
export const creditsLowKey = (day: string) => "credits_low:" + day;
export const dmKey = (senderId: string) => "dm:" + senderId;
export const commentKey = (dumpId: string) => "comment:" + dumpId;

/** One IG reminder per day, only after the day they tapped Later, and only until linked. */
export function shouldRemindIg(o: { pendingDay?: unknown; linked: boolean; today: string }): boolean {
  if (o.linked) return false;
  if (typeof o.pendingDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.pendingDay)) return false;
  return o.today > o.pendingDay; // ISO dates compare lexically
}

/** Free-credit users run dry fast; warn under this many (purchased + today's daily). */
export const CREDITS_LOW_AT = 5;
export function creditsAreLow(o: { credits: number | null; daily: number | null; dailyResetAt: string | null; nowMs: number }): boolean {
  const dailyFresh = o.dailyResetAt ? o.nowMs - Date.parse(o.dailyResetAt) < 24 * 3600 * 1000 : false;
  // A stale daily bucket refills on next use, so don't count it as empty.
  return (o.credits ?? 0) + (dailyFresh ? (o.daily ?? 0) : 15) < CREDITS_LOW_AT;
}

/** Who may message whom: accepted friends only, and neither side blocked the other. */
export function canMessage(o: { accepted: boolean; blockedEitherWay: boolean; self: boolean }): boolean {
  return o.accepted && !o.blockedEitherWay && !o.self;
}

/** Text for a rolling (collapsed) notification. */
export function dmTitle(name: string, count: number): string {
  return count <= 1 ? "New message from " + name : count + " new messages from " + name;
}
export function commentTitle(who: string, dumpTitle: string, count: number): string {
  return count <= 1 ? who + " commented on " + dumpTitle : count + " new comments on " + dumpTitle;
}

/** Next count for a rolling row: keep counting while unread, restart at 1 once it was read. */
export function nextRollingCount(existing: { read_at: string | null; data?: { count?: number } | null } | null): number {
  if (!existing || existing.read_at) return 1;
  return Math.max(1, Number(existing.data?.count) || 1) + 1;
}

/** Group newest-first items under Today / Yesterday / date headings (local time of `now`). */
export function groupByDay<T extends { created_at: string }>(items: T[], now: Date): { label: string; items: T[] }[] {
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = dayStart(now);
  const out: { label: string; items: T[] }[] = [];
  for (const it of items) {
    const d = new Date(it.created_at);
    const diff = Math.round((today - dayStart(d)) / 86400000);
    const label = diff <= 0 ? "Today" : diff === 1 ? "Yesterday"
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
    const last = out[out.length - 1];
    if (last && last.label === label) last.items.push(it); else out.push({ label, items: [it] });
  }
  return out;
}

export type NavTarget =
  | { to: "connections" } | { to: "dm"; userId: string } | { to: "taste" } | { to: "credits" } | null;

/** Notification links -> in-app targets. Understands the legacy "/connections" and "/messages/<id>" links. */
export function parseLink(link: string | null | undefined): NavTarget {
  if (!link) return null;
  const dm = link.match(/^\/messages\/([0-9a-f-]{36})$/i);
  if (dm) return { to: "dm", userId: dm[1] };
  if (link === "/connections") return { to: "connections" };
  if (link === "/taste") return { to: "taste" };
  if (link === "/credits") return { to: "credits" };
  return null;
}

/**
 * Daily TIP: one feature the user has never tried, each tip at most once ever.
 * `event` is the activity_log event that proves they've used it (client track()).
 * Add a tip = add a row here (+ track() somewhere if it's a new event).
 */
export const TIPS = [
  { id: "autogen", event: "feature_autogen", title: "TIP: Auto Gen builds a dump for you", body: "One tap turns your pool into a ready-to-post carousel." },
  { id: "valet", event: "feature_valet", title: "TIP: Ask Valet to rearrange a dump", body: "Tap ⋯ on a dump, pick Valet, and tell it what you want." },
  { id: "captions", event: "feature_captions", title: "TIP: Get captions written for you", body: "Open any dump's ⋯ menu and generate captions in your style." },
  { id: "igscrub", event: "feature_igscrub", title: "TIP: Borrow a style with Instagram Scrub", body: "Scrub any public account and save its style as a Dump Style." },
  { id: "recycle", event: "feature_recycle", title: "TIP: Recycle swaps a photo", body: "Select a photo, tap ⋯, then Recycle for a fresh one from your pool." },
  { id: "export", event: "dump_exported", title: "TIP: Export a dump as slides", body: "Download your dump ready to post, in order." },
  { id: "video", event: "feature_video", title: "TIP: Add videos to your Video Pool", body: "Videos stay on your device only — never uploaded." },
  { id: "friends", event: "feature_friends", title: "TIP: Add friends and peek at their dumps", body: "Open Friends from the menu to connect, comment and message." },
] as const;

export const tipKey = (id: string) => "tip:" + id;

/** First tip whose feature is unused and that was never sent; null when nothing is left to teach. */
export function pickTip(usedEvents: ReadonlySet<string>, sentTipIds: ReadonlySet<string>) {
  return TIPS.find((t) => !usedEvents.has(t.event) && !sentTipIds.has(t.id)) ?? null;
}
