// Run: npx tsx client/src/lib/tasteMerge.check.ts (pure, no network)
import assert from "node:assert/strict";
import { mergeTaste, stripIgBlock } from "./tasteMerge";

const mine = "I like dark editorial, gold accents, cars.";
const scan1 = "Minimalist luxury travel. Short captions. No hashtags.";
const a = mergeTaste(mine, scan1, "catchcanary");
assert.ok(a.startsWith(mine), "user text first, untouched");
assert.ok(a.includes("--- From Instagram @catchcanary ---") && a.endsWith("--- end ---"));

// rebuild replaces the block, never piles up, never touches user text
const b = mergeTaste(a, "Menswear curation. Credits in captions.", "catchcanary");
assert.equal((b.match(/From Instagram/g) || []).length, 1);
assert.ok(b.startsWith(mine) && b.includes("Menswear curation") && !b.includes("Minimalist luxury"));
assert.equal(stripIgBlock(b), mine);

// long scan is trimmed at a sentence, user text intact, total <= 2000
const user = "u".repeat(1500) + ".";
const long = "Sentence one is here. ".repeat(100);
const c = mergeTaste(user, long, "x");
assert.ok(c.length <= 2000 && c.startsWith(user));

// no room -> unchanged user text
const full = "u".repeat(1950);
assert.equal(mergeTaste(full, scan1, "x"), full);
console.log("igProfileScrub ok");
