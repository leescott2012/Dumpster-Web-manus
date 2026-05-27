/**
 * AI memory cloud sync.
 *
 * Keeps the user's accumulated AI knowledge (taste profile, rules, caption
 * library) in sync with Supabase so it survives:
 *   - Cleared browser cache / private windows
 *   - Switching between iPhone, iPad, laptop
 *   - Reinstalls and OS upgrades
 *
 * localStorage stays the source of truth for reads (instant, offline-safe).
 * Cloud is a mirror that catches up via debounced writes.
 *
 * Photos and dumps remain device-local by design — see Home.tsx for why.
 */
import { supabase } from "./supabase";
import { IS_OWNER } from "./photoData";
import { onAIProfileChanged } from "./currentUser";
import {
  loadCaptions,
  loadCaptionsRaw,
  saveCaptions,
  loadTasteProfile,
  saveTasteProfile,
  loadAIRules,
  saveAIRules,
  type PoolCaption,
} from "./captionPool";
// loadCaptions is kept in scope for any future use; raw is what sync needs.
void loadCaptions;

export interface CloudAIProfile {
  taste_profile: string;
  ai_rules: string;
  caption_pool: PoolCaption[];
  updated_at: string;
}

/**
 * Fetch the user's AI profile from Supabase. Returns null if no row exists
 * yet (new user) or owner mode is on.
 */
export async function loadCloudAIProfile(userId: string): Promise<CloudAIProfile | null> {
  var { data, error } = await supabase
    .from("user_ai_profile")
    .select("taste_profile, ai_rules, caption_pool, updated_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    // PGRST116 = no row found (expected for new users)
    if (error && error.code !== "PGRST116") {
      console.error("[aiProfileSync] load failed:", error);
    }
    return null;
  }

  return {
    taste_profile: data.taste_profile || "",
    ai_rules: data.ai_rules || "",
    caption_pool: (data.caption_pool as PoolCaption[]) || [],
    updated_at: data.updated_at,
  };
}

/**
 * Upsert the user's AI profile to Supabase.
 * Returns true on success — caller can use this to update a "last saved" hash.
 */
export async function saveCloudAIProfile(userId: string): Promise<boolean> {
  var { error } = await supabase
    .from("user_ai_profile")
    .upsert({
      user_id: userId,
      taste_profile: loadTasteProfile(),
      ai_rules: loadAIRules(),
      // Use raw (includes tombstones) so deletions propagate across devices
      caption_pool: loadCaptionsRaw(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[aiProfileSync] save failed:", error);
    return false;
  }
  return true;
}

/**
 * Merge cloud profile into localStorage.
 *
 * Strategy:
 *   - Scalars (taste_profile, ai_rules): cloud wins if non-empty, else keep local.
 *     This prevents losing local edits the user made while signed out.
 *   - Caption pool: union by id. If the same caption exists in both, prefer the
 *     cloud version (it might have updated favorited/banned flags from another
 *     device). New captions in either place are kept.
 */
function mergeIntoLocal(cloud: CloudAIProfile) {
  // Scalars
  var localTaste = loadTasteProfile();
  if (cloud.taste_profile && !localTaste) {
    saveTasteProfile(cloud.taste_profile);
  } else if (cloud.taste_profile && localTaste && cloud.taste_profile !== localTaste) {
    // Both have content — append unique lines from cloud the local doesn't have.
    var localLines = new Set(localTaste.split("\n").map(function(l) { return l.trim(); }));
    var newLines = cloud.taste_profile.split("\n").filter(function(l) { return l.trim() && !localLines.has(l.trim()); });
    if (newLines.length > 0) {
      saveTasteProfile(localTaste + "\n" + newLines.join("\n"));
    }
  }

  var localRules = loadAIRules();
  if (cloud.ai_rules && !localRules) {
    saveAIRules(cloud.ai_rules);
  }
  // If both have rules, prefer local (user typed those explicitly, don't override).

  // Caption pool: union by id, with tombstone-aware merge.
  //
  // Rules:
  //   - If EITHER side has deleted=true → final is deleted=true (tombstone wins).
  //     This prevents resurrecting captions the user removed on another device.
  //   - If both have the same id with no tombstone → cloud's flag state wins
  //     (favorited/banned). Cloud is the canonical cross-device record.
  //   - Items only on one side → kept as-is.
  //
  // Raw load (includes tombstones) so we don't accidentally re-create rows
  // the user already deleted locally but haven't synced yet.
  var localCaps = loadCaptionsRaw();
  var cloudById = new Map<string, PoolCaption>();
  for (var i = 0; i < cloud.caption_pool.length; i++) {
    cloudById.set(cloud.caption_pool[i].id, cloud.caption_pool[i]);
  }
  var localById = new Map<string, PoolCaption>();
  for (var j = 0; j < localCaps.length; j++) {
    localById.set(localCaps[j].id, localCaps[j]);
  }

  var merged: PoolCaption[] = [];
  cloudById.forEach(function(c) {
    var l = localById.get(c.id);
    // Tombstone wins from either side
    if (c.deleted || (l && l.deleted)) {
      merged.push(Object.assign({}, c, { deleted: true, favorited: false, banned: false }));
    } else {
      merged.push(c);
    }
  });
  // Local-only captions (kept as-is, including any local tombstones not yet in cloud)
  localById.forEach(function(c) {
    if (!cloudById.has(c.id)) merged.push(c);
  });

  // Stable sort: newest first (epoch ms)
  merged.sort(function(a, b) { return b.createdAt - a.createdAt; });
  saveCaptions(merged);
}

/**
 * One-shot initial sync on sign-in.
 *   - If cloud exists → merge it into localStorage, return true (caller can
 *     trigger UI refresh).
 *   - If cloud is empty → push current localStorage up to cloud (first-time
 *     bootstrap for existing users who built up local AI memory before sync).
 *
 * Returns true if local state was modified (so the UI can re-read).
 */
export async function syncAIProfileOnSignIn(userId: string): Promise<boolean> {
  // Belt-and-suspenders: also wire here in case the module-load init was
  // tree-shaken in some bundling path. ensureAIProfileWired is idempotent.
  ensureAIProfileWired();

  var cloud = await loadCloudAIProfile(userId);

  if (cloud) {
    mergeIntoLocal(cloud);
    // Push the merged state back so cloud reflects the union.
    saveCloudAIProfile(userId).catch(function(e) {
      console.warn("[aiProfileSync] post-merge save failed:", e);
    });
    return true;
  }

  // No cloud row yet — bootstrap from local.
  await saveCloudAIProfile(userId);
  return false;
}

/**
 * Debounced save helper — call after any AI memory mutation.
 *
 * Why module-level state: every component that edits taste/rules/captions
 * imports this helper independently. A shared debounce timer prevents
 * cascading saves when, e.g., the user rapidly stars 5 captions in a row.
 */
var saveTimer: ReturnType<typeof setTimeout> | null = null;
var pendingUserId: string | null = null;

export function scheduleAIProfileSave(userId: string | null) {
  if (!userId) return;
  pendingUserId = userId;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(function() {
    if (pendingUserId) {
      saveCloudAIProfile(pendingUserId).catch(function(e) {
        console.warn("[aiProfileSync] debounced save failed:", e);
      });
    }
    saveTimer = null;
  }, 2000);
}

// Wire up the pub/sub so captionPool mutations trigger debounced cloud saves
// without captionPool needing to import this module directly.
//
// IMPORTANT: this MUST run on every module load. We previously had a bare
// `onAIProfileChanged(scheduleAIProfileSave)` here but Vite tree-shook it
// (saw no observable side-effects on the call), leaving the handler unset
// and silently dropping every cloud sync. Wrapping in an exported,
// idempotent initializer that gets called from syncAIProfileOnSignIn
// guarantees registration any time the auth flow actually runs.
var wired = false;
export function ensureAIProfileWired() {
  if (wired) return;
  onAIProfileChanged(scheduleAIProfileSave);
  wired = true;
}

// Also try at module-load — covers cases where the user is already signed in
// before AuthContext fires its initial session callback. Wrapping in a real
// statement (assignment) makes the side-effect non-removable by tree-shakers.
var _wireOnLoad = (function() { ensureAIProfileWired(); return true; })();
void _wireOnLoad;
