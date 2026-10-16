/**
 * Label Health — pure metrics + a small localStorage store.
 *
 * Pure functions only (no React, no fetch, no supabase import) so
 * labelHealth.selftest.ts can run them with `npx tsx`.
 *
 * videos are device-only by owner decision — every metric skips them.
 */

// Mirror of CATEGORIES in server/aiLabel.ts (same list as Home.tsx VALID_CATEGORIES).
export var LABEL_CATEGORIES = [
  "AUTOMOTIVE", "SELFIE", "NIGHTLIFE", "DINING", "FITNESS", "TRAVEL",
  "ARCHITECTURE", "ART", "FASHION", "STUDIO", "CULTURE", "LIFESTYLE",
];

export var LOW_CONFIDENCE = 0.6;
export var MIN_CHECKS_FOR_SCORE = 5;
export var AUDIT_PER_DAY = 6;

/** Per-photo label provenance. Optional everywhere — old photos have none. */
export interface LabelInfo {
  /** 0–1 model confidence; absent for old labels / old servers. */
  confidence?: number;
  source: "ai" | "user";
  labeledAt: number;
  /** Result of the latest independent audit pass, or "corrected" when the user edited an AI label. */
  audit?: "agree" | "disagree" | "corrected";
}

/** One accuracy check. user-* = primary signal, audit-* = secondary. */
export interface LabelCheck {
  id: string;
  kind: "verified" | "corrected" | "agree" | "disagree";
  at: number;
}

export interface HealthSnapshot { day: string; labeled: number; total: number; score: number | null }

export interface LabelHealthStore {
  info: Record<string, LabelInfo>;
  checks: LabelCheck[];
  snapshots: HealthSnapshot[];
  autoFix: boolean;
  auditDay: string;
  auditCount: number;
}

interface PhotoLike { id: string; url: string; category: string; alt: string }

export type PhotoStatus = "unlabeled" | "suspect" | "ok";
export type SuspectReason = "low_confidence" | "audit_disagree" | "duplicate_generic";

export function isVideoLike(p: { category: string; url: string }): boolean {
  return p.category === "Video" || p.url.startsWith("blob:") || p.url.startsWith("data:video/");
}

// Same banned words as the server label prompt, plus upload placeholders.
var GENERIC = ["photo", "image", "picture", "scene", "view", "moment", "vibe", "aesthetic",
  "food", "car", "building", "person", "outfit", "uncategorized", "untitled", "uploaded"];

/** True when the label carries no real information (empty, banned word, one word, or a filename). */
export function isGenericLabel(label: string): boolean {
  var t = (label || "").trim().toLowerCase();
  if (!t) return true;
  if (/\.(jpe?g|png|heic|heif|webp|gif)$/.test(t) || /^(img|dsc|pxl|screenshot)[_\- ]?\d/.test(t)) return true;
  if (GENERIC.indexOf(t) >= 0) return true;
  return t.split(/\s+/).length < 2;
}

export function isValidCategory(category: string): boolean {
  return LABEL_CATEGORIES.indexOf((category || "").toUpperCase()) >= 0;
}

/**
 * Classify every non-video photo. A photo is "labeled" when its category is in
 * the current taxonomy AND its label isn't generic. Labeled photos are
 * "suspect" when low-confidence, the audit disagreed, or 3+ photos share the
 * exact same label text. User-set labels are never suspect.
 */
export function classifyPhotos(
  photos: PhotoLike[],
  info: Record<string, LabelInfo>
): Array<{ photo: PhotoLike; status: PhotoStatus; reason?: SuspectReason }> {
  var seen: Record<string, boolean> = {};
  var list = photos.filter(function(p) {
    if (isVideoLike(p) || seen[p.id]) return false;
    seen[p.id] = true;
    return true;
  });
  var labelCounts: Record<string, number> = {};
  list.forEach(function(p) {
    var k = (p.alt || "").trim().toLowerCase();
    if (k) labelCounts[k] = (labelCounts[k] || 0) + 1;
  });
  return list.map(function(p) {
    var i = info[p.id];
    var userOwned = !!i && i.source === "user";
    if (!userOwned && (!isValidCategory(p.category) || isGenericLabel(p.alt))) return { photo: p, status: "unlabeled" as PhotoStatus };
    if (userOwned) return { photo: p, status: "ok" as PhotoStatus };
    if (i && i.audit === "disagree") return { photo: p, status: "suspect" as PhotoStatus, reason: "audit_disagree" as SuspectReason };
    if (i && typeof i.confidence === "number" && i.confidence < LOW_CONFIDENCE) return { photo: p, status: "suspect" as PhotoStatus, reason: "low_confidence" as SuspectReason };
    if (labelCounts[(p.alt || "").trim().toLowerCase()] >= 3) return { photo: p, status: "suspect" as PhotoStatus, reason: "duplicate_generic" as SuspectReason };
    return { photo: p, status: "ok" as PhotoStatus };
  });
}

export interface ConfidenceBuckets { high: number; medium: number; low: number; unknown: number }

export function confidenceBuckets(photos: PhotoLike[], info: Record<string, LabelInfo>): ConfidenceBuckets {
  var b: ConfidenceBuckets = { high: 0, medium: 0, low: 0, unknown: 0 };
  classifyPhotos(photos, info).forEach(function(r) {
    if (r.status === "unlabeled") return;
    var c = info[r.photo.id] && info[r.photo.id].confidence;
    if (typeof c !== "number") b.unknown++;
    else if (c >= 0.85) b.high++;
    else if (c >= LOW_CONFIDENCE) b.medium++;
    else b.low++;
  });
  return b;
}

/**
 * Accuracy score, 0–100, or null with fewer than MIN_CHECKS_FOR_SCORE checks.
 *
 *   hits   = 2 × verified ("Looks right" on an AI label)  + 1 × audit agree
 *   misses = 2 × corrected (user edited an AI label)       + 1 × audit disagree
 *   score  = round(100 × hits / (hits + misses))
 *
 * User signals (primary) weigh double the independent audit (secondary).
 * Only the most recent check per photo+signal counts, over the last 200 checks.
 */
export function accuracyScore(checks: LabelCheck[]): { score: number | null; basis: number } {
  var latest: Record<string, LabelCheck> = {};
  checks.slice(-200).forEach(function(c) {
    var group = c.kind === "agree" || c.kind === "disagree" ? "audit" : "user";
    latest[c.id + ":" + group] = c;
  });
  var hits = 0, misses = 0, basis = 0;
  Object.keys(latest).forEach(function(k) {
    var c = latest[k];
    basis++;
    if (c.kind === "verified") hits += 2;
    else if (c.kind === "corrected") misses += 2;
    else if (c.kind === "agree") hits += 1;
    else misses += 1;
  });
  if (basis < MIN_CHECKS_FOR_SCORE) return { score: null, basis: basis };
  return { score: Math.round((100 * hits) / (hits + misses)), basis: basis };
}

export interface LabelHealth {
  total: number;
  labeled: number;
  coverage: number; // 0–1
  unlabeled: PhotoLike[];
  suspects: Array<{ photo: PhotoLike; reason: SuspectReason }>;
  buckets: ConfidenceBuckets;
  score: number | null;
  basis: number;
  status: "green" | "amber" | "red";
}

export function computeHealth(photos: PhotoLike[], store: Pick<LabelHealthStore, "info" | "checks">): LabelHealth {
  var rows = classifyPhotos(photos, store.info);
  var unlabeled = rows.filter(function(r) { return r.status === "unlabeled"; }).map(function(r) { return r.photo; });
  var suspects = rows.filter(function(r) { return r.status === "suspect"; })
    .map(function(r) { return { photo: r.photo, reason: r.reason as SuspectReason }; });
  var total = rows.length;
  var labeled = total - unlabeled.length;
  var coverage = total === 0 ? 1 : labeled / total;
  var acc = accuracyScore(store.checks);
  var suspectShare = total === 0 ? 0 : suspects.length / total;
  var status: LabelHealth["status"] =
    coverage < 0.7 || (acc.score !== null && acc.score < 70) ? "red"
    : coverage >= 0.95 && suspectShare <= 0.05 && (acc.score === null || acc.score >= 85) ? "green"
    : "amber";
  return {
    total: total, labeled: labeled, coverage: coverage, unlabeled: unlabeled, suspects: suspects,
    buckets: confidenceBuckets(photos, store.info), score: acc.score, basis: acc.basis, status: status,
  };
}

/** Upsert today's snapshot, keep the last 30 days. */
export function addSnapshot(snaps: HealthSnapshot[], snap: HealthSnapshot): HealthSnapshot[] {
  var next = snaps.filter(function(s) { return s.day !== snap.day; }).concat([snap]);
  next.sort(function(a, b) { return a.day < b.day ? -1 : 1; });
  return next.slice(-30);
}

/** Random sample of AI-labeled "ok" photos whose current label hasn't been audited yet. */
export function pickAuditSample(photos: PhotoLike[], info: Record<string, LabelInfo>, n: number, rand: () => number): PhotoLike[] {
  var pool = classifyPhotos(photos, info)
    .filter(function(r) {
      var i = info[r.photo.id];
      return r.status === "ok" && !(i && (i.source === "user" || i.audit));
    })
    .map(function(r) { return r.photo; });
  for (var k = pool.length - 1; k > 0; k--) { // Fisher–Yates
    var j = Math.floor(rand() * (k + 1));
    var t = pool[k]; pool[k] = pool[j]; pool[j] = t;
  }
  return pool.slice(0, n);
}

export function dayKey(t: number): string {
  var d = new Date(t);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// ── Store (device-local) ──────────────────────────────────────────────────
// ponytail: localStorage, not cloud-synced. Syncing needs a photos.label_info
// column + api/workspace changes; add when cross-device health matters.
var KEY = "dumpster.labelHealth.v1";

export function emptyStore(): LabelHealthStore {
  return { info: {}, checks: [], snapshots: [], autoFix: true, auditDay: "", auditCount: 0 };
}

export function loadStore(): LabelHealthStore {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(emptyStore(), JSON.parse(raw));
  } catch { /* corrupt / private mode */ }
  return emptyStore();
}

export function saveStore(s: LabelHealthStore): void {
  try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, s, { checks: s.checks.slice(-300) }))); } catch { /* full */ }
}
