// Run: npx tsx client/src/lib/uploadQueue.selftest.ts
import assert from "node:assert";
import { createLimiter } from "./uploadQueue";

(async function() {
  var LIMIT = 2, N = 40, active = 0, peak = 0;
  var order: number[] = [];
  var run = createLimiter(LIMIT);
  var t0 = Date.now();
  // Fake "decode" work with varying durations; item 5 fails.
  var tasks = Array.from({ length: N }, function(_, i) {
    return run(async function() {
      active++; peak = Math.max(peak, active);
      await new Promise(function(r) { setTimeout(r, 5 + ((i * 7) % 13)); });
      active--;
      if (i === 5) throw new Error("bad file");
      return i;
    }).then(function(v) { order.push(v); }, function() { order.push(-1); });
  });
  await Promise.all(tasks);
  assert.ok(peak <= LIMIT, "peak " + peak + " > " + LIMIT);
  assert.strictEqual(peak, LIMIT);
  assert.strictEqual(order.length, N, "every task settled despite a failure");
  assert.ok(order.includes(-1));
  assert.notDeepStrictEqual(order.filter(function(v) { return v >= 0; }), order.filter(function(v) { return v >= 0; }).slice().sort(function(a, b) { return a - b; }), "results stream in completion order, not input order");
  console.log("ok: peak=" + peak + " n=" + N + " ms=" + (Date.now() - t0));
})();
