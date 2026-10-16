/**
 * Credit math check — charge, parallel charge, bucket-exact refund.
 * Exercises server/supabaseAdmin.ts deductCredits/refundCredits, so it tests
 * whichever path is live: the v2 RPCs (supabase-credits-atomic-v2.sql) or the
 * compare-and-swap fallback if the SQL isn't applied yet.
 *
 * Run against a FREE-tier TEST account only (it overwrites that user's balance, then
 * restores it; it also adds rows to credit_transactions):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TEST_USER_ID=<uuid> \
 *     npx tsx scripts/test-credits.ts
 */
import assert from "node:assert/strict";
import { supabaseAdmin, deductCredits, refundCredits } from "../server/supabaseAdmin.js";

var userId = process.env.TEST_USER_ID || "";
if (!userId) throw new Error("Set TEST_USER_ID to a test account's uuid");

async function balance() {
  var { data, error } = await supabaseAdmin.from("profiles")
    .select("credits, daily_credits_remaining, daily_credits_reset_at").eq("id", userId).single();
  if (error) throw error;
  return data;
}
async function setBalance(credits: number, daily: number, resetAt?: string) {
  var { error } = await supabaseAdmin.from("profiles").update({
    credits: credits, daily_credits_remaining: daily,
    daily_credits_reset_at: resetAt || new Date().toISOString(), // fresh window = no auto-reset mid-test
  }).eq("id", userId);
  if (error) throw error;
}

async function main() {
  var original = await balance();
  try {
    // 1) Charge spends daily first, then purchased.
    await setBalance(10, 5);
    var r = await deductCredits(userId, "test_charge", 8);
    assert.equal(r.ok, true);
    assert.deepEqual([r.fromDaily, r.fromPurchased], [5, 3]);
    var b = await balance();
    assert.deepEqual([b.credits, b.daily_credits_remaining], [7, 0]);

    // 2) Refund goes back to the same buckets.
    await refundCredits(userId, r.fromDaily, r.fromPurchased, "test_charge");
    b = await balance();
    assert.deepEqual([b.credits, b.daily_credits_remaining], [10, 5]);

    // 3) Parallel charges: 15 total, 5 calls × 4 → exactly 3 succeed, balance 3.
    await setBalance(10, 5);
    var results = await Promise.all([1, 2, 3, 4, 5].map(function() { return deductCredits(userId, "test_parallel", 4); }));
    var okCount = results.filter(function(x) { return x.ok; }).length;
    b = await balance();
    assert.equal(okCount, 3, "expected exactly 3 successful parallel charges, got " + okCount);
    assert.equal(b.credits + b.daily_credits_remaining, 15 - okCount * 4);
    assert.ok(results.filter(function(x) { return !x.ok; }).every(function(x) { return x.insufficient; }),
      "losers must be 'insufficient', not DB errors");

    // 4) Insufficient balance is refused and nothing changes.
    await setBalance(1, 1);
    r = await deductCredits(userId, "test_broke", 3);
    assert.equal(r.ok, false);
    assert.equal(r.insufficient, true);
    b = await balance();
    assert.deepEqual([b.credits, b.daily_credits_remaining], [1, 1]);

    // 5) Daily refund is capped at the tier's daily amount (free = 15).
    await setBalance(0, 14);
    await refundCredits(userId, 5, 0, "test_cap");
    b = await balance();
    assert.equal(b.daily_credits_remaining, 15);

    console.log("credit math OK");
  } finally {
    await setBalance(original.credits, original.daily_credits_remaining, original.daily_credits_reset_at);
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
