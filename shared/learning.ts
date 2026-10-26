/**
 * What the AI has learned about a user, from their own behavior.
 * Pure + deterministic (no extra AI call): turns recent `activity_log` learning events into a few
 * plain-English preference lines that server/learned.ts appends to the Auto Gen + caption prompts.
 * Events carry counts / categories / lengths only — never caption text.
 * Selftest: npx tsx shared/learning.selftest.ts
 */

export interface LearnEvent { event: string; metadata?: Record<string, unknown> | null }

/** Events the summary reads (and what the "reset" would delete). */
export const LEARN_EVENTS = [
  "learn_autogen_kept", "learn_autogen_rejected", "learn_recycle",
  "learn_caption_copy", "learn_caption_fav", "learn_caption_ban",
] as const;

const MIN = 3; // samples before we trust a pattern

const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const median = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
function topKeys(counts: Record<string, number>, n: number, minCount: number): string[] {
  return Object.entries(counts).filter(([, c]) => c >= minCount).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}
function bump(map: Record<string, number>, key: unknown, by = 1) {
  if (typeof key === "string" && key) map[key] = (map[key] || 0) + by;
}

export function summarizeLearning(events: LearnEvent[]): string[] {
  const kept: number[] = [], keptCats: Record<string, number> = {};
  let rejected = 0;
  const swappedOut: Record<string, number> = {}, swappedIn: Record<string, number> = {};
  const caps: Array<{ len: number; emoji: boolean; hashtag: boolean; w: number }> = [];
  let banned = 0;

  for (const e of events) {
    const m = e.metadata || {};
    switch (e.event) {
      case "learn_autogen_kept": {
        const n = num(m.n); if (n) kept.push(n);
        const cats = (m.cats || {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(cats)) bump(keptCats, k, num(v) ?? 0);
        break;
      }
      case "learn_autogen_rejected": rejected++; break;
      case "learn_recycle": bump(swappedOut, m.out); bump(swappedIn, m.in); break;
      case "learn_caption_copy": case "learn_caption_fav": {
        const len = num(m.len);
        if (len !== null) caps.push({ len, emoji: m.emoji === true, hashtag: m.hashtag === true, w: e.event === "learn_caption_fav" ? 2 : 1 });
        break;
      }
      case "learn_caption_ban": banned++; break;
    }
  }

  const out: string[] = [];
  if (kept.length >= MIN) out.push(`Keeps dumps of about ${median(kept)} photos — aim for that size.`);
  const likes = kept.length >= MIN ? topKeys(keptCats, 3, MIN) : []; // needs 3+ kept dumps, not one big one
  if (likes.length) out.push(`Photo types they keep most: ${likes.join(", ")}.`);
  const drops = topKeys(swappedOut, 2, MIN).filter((c) => !likes.includes(c));
  if (drops.length) out.push(`They often swap out ${drops.join(" and ")} photos — use them sparingly.`);
  const adds = topKeys(swappedIn, 2, MIN);
  if (adds.length) out.push(`When swapping, they choose ${adds.join(" and ")} photos.`);
  if (rejected >= 4 && rejected >= kept.length * 2) out.push("They reject most Auto Gen dumps — be more varied and less formulaic.");

  const cw = caps.reduce((s, c) => s + c.w, 0);
  if (caps.length >= MIN) {
    const avg = caps.reduce((s, c) => s + c.len * c.w, 0) / cw;
    out.push(`Captions they use run ${avg < 60 ? "short (under ~60 characters)" : avg < 140 ? "medium (~60–140 characters)" : "long (140+ characters)"}.`);
    const emo = caps.reduce((s, c) => s + (c.emoji ? c.w : 0), 0) / cw;
    out.push(emo >= 0.7 ? "They like emojis in captions." : emo <= 0.1 ? "They avoid emojis in captions." : "");
    const tag = caps.reduce((s, c) => s + (c.hashtag ? c.w : 0), 0) / cw;
    out.push(tag >= 0.7 ? "They usually include hashtags." : tag <= 0.1 ? "They avoid hashtags." : "");
  }
  if (banned >= 5) out.push("They ban a lot of generated captions — be more original, avoid clichés.");
  return out.filter(Boolean);
}

/** Prompt text, or "" when nothing is learned yet. Always framed as soft: strict rules win. */
export function learnedBlock(lines: string[]): string {
  return lines.length
    ? "LEARNED FROM THIS USER'S OWN BEHAVIOR (soft preferences — the STRICT RULES above always win):\n" + lines.map((l) => "- " + l).join("\n")
    : "";
}
