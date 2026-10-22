/**
 * Free one-time taste-profile scrub: Instagram handle -> /api/ig-scrub (profile
 * mode: Apify reads public posts, Claude distills style + what-performs) ->
 * text for the Taste Profile. No credits are charged (server: ig_profile gate).
 * The Taste Profile syncs to the cloud (aiProfileSync) and Valet reads it via
 * buildTasteBlock(), so saving it is all that's needed.
 */
import { aiFetch } from "@/lib/creditSync";
import { getAuthHeaders, supabase } from "@/lib/supabase";
import { TASTE_PROFILE_MAX, loadTasteProfile, saveTasteProfile, loadDumpStyles, saveDumpStyles } from "@/lib/captionPool";

/** Returns the distilled text, or throws Error with a plain-English reason. */
export async function scrubInstagramProfile(handle: string): Promise<string> {
  var res: Response;
  try {
    res = await aiFetch("/api/ig-scrub", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, await getAuthHeaders()),
      body: JSON.stringify({ profileURL: handle.trim() }),
    });
  } catch {
    throw new Error("Can't reach Dumpster right now. Check your connection and try again.");
  }
  var data: { error?: string; code?: string; description?: string; engagementPlaybook?: string } = {};
  try { data = await res.json(); } catch { /* non-JSON body (gateway timeout page) */ }
  if (!res.ok) {
    if (data.code === "ig_profile_limit") throw new Error("You've used today's free profile scrubs. Try again tomorrow, or type your style instead.");
    throw new Error(
      data.error ||
      (res.status === 401 ? "Sign in first, then try again." :
       res.status === 504 || res.status === 502 ? "Instagram took too long to answer. Try again in a minute." :
       "Couldn't read that profile (error " + res.status + "). Try again in a minute."),
    );
  }
  var text = [data.description, data.engagementPlaybook].filter(Boolean).join("\n\n").trim();
  if (!text) throw new Error("Nothing usable came back. Try another account or type your style instead.");
  return text;
}

import { mergeTaste } from "@/lib/tasteMerge";
export { mergeTaste, stripIgBlock } from "@/lib/tasteMerge";

/** Save an account's style as a Dump Style named "@handle" (replaces a same-named one). */
export function saveAccountAsDumpStyle(handle: string, text: string): void {
  const name = "@" + handle;
  const st = { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), name, profile: text, rules: "", updatedAt: new Date().toISOString() };
  saveDumpStyles(loadDumpStyles().filter((d) => d.name !== name).concat(st));
}

/** "@name" / "name" / instagram.com/name/... -> "name", or null if it isn't a profile handle. */
export function parseIgHandle(input: string): string | null {
  var m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(input.trim()) || /^@?([A-Za-z0-9._]{1,30})$/.exec(input.trim());
  var h = m && m[1];
  return h && !/^(p|reel|reels|tv|stories|explore|accounts|direct|about|s)$/i.test(h) ? h : null;
}

export type LinkIgResult =
  | { ok: true; handle: string; taste: string; linked: boolean }
  | { ok: false; error: string };

/**
 * SINGLE ENTRY POINT for onboarding: call right after the user enters their handle.
 * Validates -> free scrub -> saves/merges the Taste Profile (cloud-synced, read by Valet)
 * -> links the handle on profiles.instagram_handle. Never throws; show `error` as-is.
 * `linked` is false if the profiles.instagram_handle column hasn't been added yet
 * (SQL in the PR); the handle is still kept locally and the taste profile still saves.
 */
export async function linkInstagramAndBuildTaste(userId: string, input: string): Promise<LinkIgResult> {
  var handle = parseIgHandle(input);
  if (!handle) return { ok: false, error: "That doesn't look like an Instagram handle. Enter it like @yourname." };
  var text: string;
  try { text = await scrubInstagramProfile(handle); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn't read that profile." }; }
  var merged = mergeTaste(loadTasteProfile(), text, handle);
  saveTasteProfile(merged);
  try { localStorage.setItem("dumpster_ig_handle", handle); } catch { /* storage blocked */ }
  var linked = false;
  try {
    var r = await supabase.from("profiles").update({ instagram_handle: handle }).eq("id", userId);
    linked = !r.error;
  } catch { /* column missing / offline: non-fatal */ }
  return { ok: true, handle: handle, taste: merged, linked: linked };
}
