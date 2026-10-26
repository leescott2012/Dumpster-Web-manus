// Run: npx tsx shared/learning.selftest.ts
import assert from "node:assert/strict";
import { summarizeLearning, learnedBlock } from "./learning";

assert.deepEqual(summarizeLearning([]), []);
assert.equal(learnedBlock([]), "");
// below the sample floor → nothing is claimed
assert.deepEqual(summarizeLearning([{ event: "learn_autogen_kept", metadata: { n: 9, cats: { CAR: 9 } } }]), []);

const ev = [
  ...[8, 8, 10, 6].map((n) => ({ event: "learn_autogen_kept", metadata: { n, cats: { CAR: 4, PORTRAIT: 3 } } })),
  ...[1, 2, 3].map(() => ({ event: "learn_recycle", metadata: { out: "FOOD", in: "PORTRAIT" } })),
  ...[20, 30, 40].map(() => ({ event: "learn_caption_copy", metadata: { len: 30, emoji: false, hashtag: false } })),
];
const s = summarizeLearning(ev).join("\n");
assert.match(s, /about 8 photos/);
assert.match(s, /keep most: CAR, PORTRAIT/);
assert.match(s, /swap out FOOD/);
assert.match(s, /choose PORTRAIT/);
assert.match(s, /short/);
assert.match(s, /avoid emojis/);
assert.match(s, /avoid hashtags/);
assert.match(learnedBlock(["x"]), /STRICT RULES above always win/);
// heavy rejection is noticed
assert.match(summarizeLearning(Array(5).fill({ event: "learn_autogen_rejected" })).join(), /reject most/);
console.log("learning selftest ok");
