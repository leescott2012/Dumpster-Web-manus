/**
 * Instagram link state lives in the auth user's metadata (no schema change):
 *   ig_handle  — linked (scan/build succeeded). Stops the daily reminder server-side.
 *   ig_pending — YYYY-MM-DD the user tapped "Later" in onboarding. Starts the daily reminder the next day.
 */
import { supabase } from "@/lib/supabase";
import { localDay } from "@/lib/appNav";

export async function linkInstagram(handle: string): Promise<void> {
  try { localStorage.setItem("dumpster_ig_handle", handle); } catch (_) { /* noop */ }
  try { await supabase.auth.updateUser({ data: { ig_handle: handle, ig_pending: null } }); } catch (_) { /* non-fatal */ }
}

export async function markInstagramLater(): Promise<void> {
  try { await supabase.auth.updateUser({ data: { ig_pending: localDay() } }); } catch (_) { /* non-fatal: no reminders, nothing blocked */ }
}
