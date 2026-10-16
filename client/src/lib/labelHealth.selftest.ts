// Run: npx tsx client/src/lib/labelHealth.selftest.ts
import assert from "node:assert/strict";
import {
  isGenericLabel, classifyPhotos, accuracyScore, computeHealth, addSnapshot, pickAuditSample,
  type LabelCheck, type LabelInfo,
} from "./labelHealth";

function ph(id: string, category: string, alt: string, url?: string) {
  return { id: id, url: url || "https://x/" + id + ".jpg", category: category, alt: alt };
}

// Generic labels
assert.equal(isGenericLabel(""), true);
assert.equal(isGenericLabel("photo"), true);
assert.equal(isGenericLabel("IMG_1234.HEIC"), true);
assert.equal(isGenericLabel("Car"), true);
assert.equal(isGenericLabel("Matte black G-Wagon"), false);

var photos = [
  ph("a", "AUTOMOTIVE", "Matte black G-Wagon"),
  ph("b", "Uploaded", "IMG_0001.jpg"),             // unlabeled
  ph("c", "Object", "Red chair in loft"),          // stale category → unlabeled
  ph("d", "DINING", "Shrimp pad thai"),            // low confidence → suspect
  ph("e", "TRAVEL", "Beach sunset palms"),         // audit disagree → suspect
  ph("f", "Video", "clip.mov", "blob:abc"),        // video → skipped entirely
  ph("g", "LIFESTYLE", "Neon bar sign"),
  ph("h", "LIFESTYLE", "Neon bar sign"),
  ph("i", "LIFESTYLE", "Neon bar sign"),           // 3x same label → suspect
  ph("j", "FASHION", "photo"),                     // generic but user-owned → ok
];
var info: Record<string, LabelInfo> = {
  d: { confidence: 0.4, source: "ai", labeledAt: 1 },
  e: { confidence: 0.9, source: "ai", labeledAt: 1, audit: "disagree" },
  j: { source: "user", labeledAt: 1 },
};
var rows = classifyPhotos(photos, info);
assert.equal(rows.length, 9, "video excluded");
function st(id: string) { return rows.filter(function(r) { return r.photo.id === id; })[0]; }
assert.equal(st("a").status, "ok");
assert.equal(st("b").status, "unlabeled");
assert.equal(st("c").status, "unlabeled");
assert.equal(st("d").reason, "low_confidence");
assert.equal(st("e").reason, "audit_disagree");
assert.equal(st("g").reason, "duplicate_generic");
assert.equal(st("j").status, "ok");

// Accuracy: not enough data below 5 checks
function chk(id: string, kind: LabelCheck["kind"]): LabelCheck { return { id: id, kind: kind, at: 0 }; }
assert.deepEqual(accuracyScore([chk("a", "verified"), chk("b", "agree")]), { score: null, basis: 2 });
// 3 verified (6) + 1 agree (1) hits; 1 corrected (2) miss → 7/9 = 78
var checks = [chk("a", "verified"), chk("b", "verified"), chk("c", "verified"), chk("d", "agree"), chk("e", "corrected")];
assert.deepEqual(accuracyScore(checks), { score: 78, basis: 5 });
// Latest check per photo+signal wins (a: verified → corrected)
// hits 2+2+1 = 5, misses 2+2 = 4 → 56
assert.equal(accuracyScore(checks.concat([chk("a", "corrected")])).score, 56);

// Health summary
var h = computeHealth(photos, { info: info, checks: [] });
assert.equal(h.total, 9);
assert.equal(h.labeled, 7);
assert.equal(h.unlabeled.length, 2);
assert.equal(h.suspects.length, 5); // d, e, g, h, i
assert.equal(h.score, null);
assert.equal(h.status, "amber"); // 78% coverage
assert.equal(computeHealth([], { info: {}, checks: [] }).status, "green");
assert.equal(computeHealth([ph("x", "", "")], { info: {}, checks: [] }).status, "red");

// Snapshots: upsert by day, cap 30
var snaps = addSnapshot([], { day: "2026-01-01", labeled: 1, total: 2, score: null });
snaps = addSnapshot(snaps, { day: "2026-01-01", labeled: 2, total: 2, score: 90 });
assert.equal(snaps.length, 1);
assert.equal(snaps[0].labeled, 2);
for (var d = 1; d <= 40; d++) snaps = addSnapshot(snaps, { day: "2026-02-" + String(d).padStart(2, "0"), labeled: 1, total: 1, score: null });
assert.equal(snaps.length, 30);

// Audit sample: only ok, AI-owned, not-yet-audited photos
var sample = pickAuditSample(photos, info, 6, function() { return 0.5; });
assert.deepEqual(sample.map(function(p) { return p.id; }).sort(), ["a"]);

console.log("labelHealth selftest: all passed");
