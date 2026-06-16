/**
 * Caption Pool — local persistence for caption library.
 * Ported from iOS DumpCaption model.
 *
 * Sync note: when a user is signed in, every mutation also schedules a
 * debounced push to Supabase via aiProfileSync. localStorage stays the
 * source of truth for reads — cloud is just a mirror so AI memory survives
 * device switches.
 */
import { nanoid } from "nanoid";
import { getCurrentUserId, notifyAIProfileChanged } from "./currentUser";

// Avoid an unused-import warning while keeping the helper available for any
// future direct lookups. notifyAIProfileChanged() reads currentUserId itself.
void getCurrentUserId;

export type CaptionStyle = "storytelling" | "emoji" | "clean" | "numbered" | "ai" | "custom";

export interface PoolCaption {
  id: string;
  text: string;
  style: CaptionStyle;
  favorited: boolean;
  banned: boolean;
  dumpId?: string;       // optional link to a dump
  createdAt: number;     // epoch ms
  /**
   * Soft-delete tombstone. We keep the row in the synced pool so other
   * devices learn the user deleted it; otherwise a re-merge from cloud
   * would resurrect deleted captions. UI hides anything with deleted=true.
   */
  deleted?: boolean;
  /**
   * Archived = "used". Once a caption has been copied/applied to a post the
   * user doesn't want it cluttering the active list, so it moves to the "Used"
   * tab. Unlike `deleted` it's fully reversible and keeps a link to the dump
   * it was used on.
   */
  archived?: boolean;
  /** Epoch ms the caption was marked used. */
  usedAt?: number;
  /** Dump this caption was used on, if it was archived alongside one. */
  usedInDumpId?: string;
}

const STORAGE_KEY = "dumpster_captions";

/**
 * Public reader — used by UI. Excludes tombstoned (deleted) captions.
 */
export function loadCaptions(): PoolCaption[] {
  return loadCaptionsRaw().filter(function(c) { return !c.deleted; });
}

/**
 * Internal reader — used by cloud sync. Includes tombstones so they
 * propagate across devices and prevent resurrection on merge.
 */
export function loadCaptionsRaw(): PoolCaption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedCaptions();
    const parsed = JSON.parse(raw) as PoolCaption[];
    return Array.isArray(parsed) ? parsed : seedCaptions();
  } catch {
    return seedCaptions();
  }
}

export function saveCaptions(captions: PoolCaption[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(captions));
    notifyAIProfileChanged();
  } catch {
    // quota exceeded, ignore
  }
}

/**
 * Deterministic ID for a seed caption — hash of style + text.
 *
 * Switched from nanoid because every device that signs in for the first time
 * was generating fresh random "seed-XYZ123" IDs for the same 12 seeds, then
 * cloud-syncing them as if they were unique. Result: caption pool grew by 12
 * on every new device. Deterministic IDs mean the merge-by-id step in
 * aiProfileSync naturally collapses identical seeds across devices.
 */
function seedId(style: string, text: string): string {
  var s = style + "|" + text;
  // djb2 hash, base36-encoded → short stable string
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return "seed-" + Math.abs(h).toString(36);
}

// Seed with iOS template banks the first time the user lands.
function seedCaptions(): PoolCaption[] {
  const now = Date.now();
  const seeds: { style: CaptionStyle; text: string }[] = [
    { style: "storytelling", text: "the kind of night you tell stories about" },
    { style: "storytelling", text: "we didn't plan this, it just happened" },
    { style: "storytelling", text: "somewhere between the chaos and the calm" },
    { style: "storytelling", text: "a collection of moments I refuse to forget" },
    { style: "emoji",        text: "📸✨🔥" },
    { style: "emoji",        text: "🌙💫🖤" },
    { style: "emoji",        text: "🏎💨✨" },
    { style: "clean",        text: "recent." },
    { style: "clean",        text: "documented." },
    { style: "clean",        text: "filed under: good times" },
    { style: "numbered",     text: "1. showed up  2. showed out" },
    { style: "numbered",     text: "1/10 of why this week hit different" },
  ];
  const list = seeds.map((s, i) => ({
    id: seedId(s.style, s.text),
    text: s.text,
    style: s.style,
    favorited: false,
    banned: false,
    createdAt: now - (seeds.length - i) * 1000,
  }));
  saveCaptions(list);
  return list;
}

// CRUD helpers
export function addCaption(text: string, style: CaptionStyle, dumpId?: string): PoolCaption {
  const cap: PoolCaption = {
    id: "cap-" + nanoid(6),
    text: text.trim(),
    style,
    favorited: false,
    banned: false,
    dumpId,
    createdAt: Date.now(),
  };
  const list = loadCaptions();
  list.unshift(cap);
  saveCaptions(list);
  return cap;
}

export function toggleFavorite(id: string): PoolCaption[] {
  const list = loadCaptions().map(c => c.id === id ? { ...c, favorited: !c.favorited, banned: false } : c);
  saveCaptions(list);
  return list;
}

export function toggleBanned(id: string): PoolCaption[] {
  const list = loadCaptions().map(c => c.id === id ? { ...c, banned: !c.banned, favorited: false } : c);
  saveCaptions(list);
  return list;
}

/**
 * Soft-delete a caption. Tombstones the row (deleted=true) so cloud sync
 * propagates the deletion to other devices and merge-from-cloud doesn't
 * resurrect it. UI's loadCaptions() filters tombstones out.
 */
export function removeCaption(id: string): PoolCaption[] {
  const raw = loadCaptionsRaw();
  const list = raw.map(c => c.id === id ? { ...c, deleted: true, favorited: false, banned: false } : c);
  saveCaptions(list);
  return list.filter(c => !c.deleted);
}

/**
 * Mark a caption as used → archive it so it drops off the active list.
 * Reversible via the same toggle (un-archive). Returns the active list.
 */
export function markCaptionUsed(id: string, used: boolean, dumpId?: string): PoolCaption[] {
  const list = loadCaptions().map(c => {
    if (c.id !== id) return c;
    return used
      ? { ...c, archived: true, usedAt: Date.now(), usedInDumpId: dumpId ?? c.usedInDumpId }
      : { ...c, archived: false };
  });
  saveCaptions(list);
  return list;
}

/**
 * Archive every pool caption whose text matches one used on a dump — called
 * when a dump is archived so its captions don't keep showing as "available".
 * Matching is case/whitespace-insensitive. Returns the active list.
 */
export function archiveCaptionsByText(texts: string[], dumpId?: string): PoolCaption[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const wanted = new Set(texts.map(norm));
  const now = Date.now();
  const list = loadCaptions().map(c =>
    !c.archived && wanted.has(norm(c.text))
      ? { ...c, archived: true, usedAt: now, usedInDumpId: dumpId ?? c.usedInDumpId }
      : c
  );
  saveCaptions(list);
  return list;
}

export function importCaptions(texts: string[], style: CaptionStyle): PoolCaption[] {
  const list = loadCaptions();
  const now = Date.now();
  texts.forEach((t, i) => {
    list.unshift({
      id: "imp-" + nanoid(6),
      text: t.trim(),
      style,
      favorited: false,
      banned: false,
      createdAt: now - i,
    });
  });
  saveCaptions(list);
  return list;
}

// ── Taste / Rules helpers (used as system-prompt context) ───────────────────

export function loadTasteProfile(): string {
  return localStorage.getItem("dumpster_taste_profile") || "";
}
export function saveTasteProfile(text: string) {
  localStorage.setItem("dumpster_taste_profile", text);
  notifyAIProfileChanged();
}
export function loadAIRules(): string {
  return localStorage.getItem("dumpster_ai_rules") || "";
}
export function saveAIRules(text: string) {
  localStorage.setItem("dumpster_ai_rules", text);
  notifyAIProfileChanged();
}

export function buildTasteBlock(): string {
  const profile = loadTasteProfile().trim();
  const rules = loadAIRules().trim();
  const favorites = loadCaptions().filter(c => c.favorited).slice(0, 8);
  const banned    = loadCaptions().filter(c => c.banned).slice(0, 8);

  const parts: string[] = [];
  if (profile) parts.push(`User's aesthetic / taste profile:\n${profile}`);
  if (rules)   parts.push(`STRICT RULES (must follow):\n${rules}`);
  if (favorites.length) parts.push(`User's favorite caption examples (match this voice):\n${favorites.map(c => "- " + c.text).join("\n")}`);
  if (banned.length)    parts.push(`NEVER USE these patterns or anything similar:\n${banned.map(c => "- " + c.text).join("\n")}`);
  return parts.join("\n\n");
}
