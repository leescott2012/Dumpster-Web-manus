// Run: npx tsx shared/aiLabelCost.selftest.ts
import assert from "node:assert/strict";
import { aiLabelCost } from "./aiLabelCost";

assert.equal(aiLabelCost(0), 1);    // minimum 1
assert.equal(aiLabelCost(-3), 1);
assert.equal(aiLabelCost(NaN), 1);
assert.equal(aiLabelCost(1), 1);
assert.equal(aiLabelCost(6), 6);    // client batch
assert.equal(aiLabelCost(12), 12);
assert.equal(aiLabelCost(13), 12);  // clamp: server only scans 12
assert.equal(aiLabelCost(500), 12);
assert.equal(aiLabelCost(2.7), 2);
// 30-photo scan = batches of 6 → 30 credits (was 60)
assert.equal([6, 6, 6, 6, 6].reduce(function(s, n) { return s + aiLabelCost(n); }, 0), 30);
console.log("aiLabelCost selftest: ok");
