/**
 * Lightweight client-side event tracking.
 *
 * Events go directly to Supabase activity_log — fire-and-forget, never blocks
 * the UI. The owner's own account IS tracked (it used to be excluded, which is
 * why the admin dashboard read 0 active users while the owner was using the
 * app — fixed 2026-10-16). The dashboard tags the owner's row instead.
 *
 * Events tracked:
 *   session_start    — fired once per sign-in
 *   photo_uploaded   — fired after photos land in pool  { count: n }
 *   dump_exported    — fired after full-dump download   { photo_count: n }
 *
 * Admin reads via /api/admin-stats (service_role — bypasses RLS).
 */
import { useEffect } from "react";
import { supabase } from "./supabase";
import { getCurrentUserId } from "./currentUser";

export type AnalyticsEvent =
  | "session_start"
  | "photo_uploaded"
  | "photos_scanned"
  | "photos_auto_relabeled"
  | "dump_exported"
  // "Tried it" signals for the daily tip (shared/notifications.ts TIPS).
  | "feature_autogen" | "feature_valet" | "feature_captions" | "feature_igscrub"
  | "feature_recycle" | "feature_friends" | "feature_video"
  // Learning signals (counts/categories/lengths only — never caption text). Summarised by shared/learning.ts.
  | "learn_autogen_kept" | "learn_autogen_rejected" | "learn_recycle"
  | "learn_caption_copy" | "learn_caption_fav" | "learn_caption_ban";

/**
 * Track a user event.
 * - Never await — always fire-and-forget.
 * - Silently no-ops when signed out.
 */
export function track(
  event: AnalyticsEvent,
  metadata?: Record<string, unknown>
): void {
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

/** Track a feature the first time its sheet opens (each open; the tip logic only needs "ever"). */
export function useTrackWhenOpen(open: boolean, event: AnalyticsEvent): void {
  useEffect(function() { if (open) track(event); }, [open, event]);
}

/** Shape of a caption without its words: length, emoji, hashtags. */
export function captionTraits(text: string): { len: number; emoji: boolean; hashtag: boolean } {
  return { len: text.length, emoji: /[\u2600-\u27BF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]/.test(text), hashtag: /#\w/.test(text) };
}
/** Category → count map for a list of photos. */
export function categoryCounts(photos: Array<{ category: string }>): Record<string, number> {
  var out: Record<string, number> = {};
  photos.forEach(function(p) { out[p.category] = (out[p.category] || 0) + 1; });
  return out;
}
