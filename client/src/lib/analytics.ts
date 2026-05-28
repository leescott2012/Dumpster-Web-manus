/**
 * Lightweight client-side event tracking.
 *
 * Events go directly to Supabase activity_log — fire-and-forget, never blocks
 * the UI. IS_OWNER accounts are excluded so demo usage stays out of the data.
 *
 * Events tracked:
 *   session_start    — fired once per sign-in
 *   photo_uploaded   — fired after photos land in pool  { count: n }
 *   dump_exported    — fired after full-dump download   { photo_count: n }
 *
 * Admin reads via /api/admin-stats (service_role — bypasses RLS).
 */
import { supabase } from "./supabase";
import { IS_OWNER } from "./photoData";
import { getCurrentUserId } from "./currentUser";

export type AnalyticsEvent =
  | "session_start"
  | "photo_uploaded"
  | "dump_exported";

/**
 * Track a user event.
 * - Never await — always fire-and-forget.
 * - Silently no-ops when signed out or IS_OWNER.
 */
export function track(
  event: AnalyticsEvent,
  metadata?: Record<string, unknown>
): void {
  if (IS_OWNER) return;

  var userId = getCurrentUserId();
  if (!userId) return;

  supabase
    .from("activity_log")
    .insert({
      user_id: userId,
      event,
      metadata: metadata ?? null,
    })
    .then(function(result) {
      if (result.error) {
        console.warn("[analytics] track failed:", event, result.error.message);
      }
    });
}
