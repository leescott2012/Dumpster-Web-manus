/**
 * Server-side Supabase client — uses service_role key (bypasses RLS)
 */
import { createClient } from "@supabase/supabase-js";
import { captureServerError } from "./sentry.js";

var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export var supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface DeductResult {
  ok: boolean;
  remaining: number;
  /** How much came out of each bucket — refunds must put it back the same way. */
  fromDaily: number;
  fromPurchased: number;
  /** true = genuinely can't afford (402); false with ok=false = DB failure (503). */
  insufficient?: boolean;
  error?: string;
}

function dailyAmountFor(tier: string | null | undefined): number {
  return tier === "pro" ? 200 : 15;
}

/** RPC not deployed yet (supabase-credits-atomic-v2.sql not applied). */
function isMissingFunction(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "PGRST202" || err.code === "42883" || /could not find the function/i.test(err.message || "");
}

/** Logging a ledger row must never block the charge/refund, but it must not be silent either. */
async function logTransaction(row: Record<string, unknown>): Promise<void> {
  var { error } = await supabaseAdmin.from("credit_transactions").insert(row);
  if (error) {
    console.error("[credits] transaction log insert failed:", error.message);
    captureServerError(new Error("credit_transactions insert: " + error.message), "credits.logTransaction", row);
  }
}

function fail(error: string): DeductResult {
  return { ok: false, remaining: 0, fromDaily: 0, fromPurchased: 0, error: error };
}

/**
 * Fallback when the deduct_credits RPC isn't deployed: read, then a
 * compare-and-swap UPDATE that only matches if the balances are unchanged
 * since the read. A parallel request that got there first makes our UPDATE
 * match 0 rows, so we re-read and retry instead of double-spending.
 */
async function deductViaCompareAndSwap(userId: string, cost: number): Promise<DeductResult> {
  for (var attempt = 0; attempt < 5; attempt++) {
    var { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("credits, daily_credits_remaining, daily_credits_reset_at, subscription_tier")
      .eq("id", userId)
      .maybeSingle();
    if (error) return fail("profile read failed: " + error.message);
    if (!profile) return { ok: false, remaining: 0, fromDaily: 0, fromPurchased: 0, insufficient: true, error: "User not found" };

    var credits = profile.credits || 0;
    var daily = profile.daily_credits_remaining || 0;
    var resetAt = profile.daily_credits_reset_at;
    var now = new Date();
    if (!resetAt || now.getTime() - new Date(resetAt).getTime() > 24 * 60 * 60 * 1000) {
      daily = dailyAmountFor(profile.subscription_tier);
      resetAt = now.toISOString();
    }

    var total = credits + daily;
    if (total < cost) {
      return { ok: false, remaining: total, fromDaily: 0, fromPurchased: 0, insufficient: true, error: "Not enough credits. Need " + cost + ", have " + total };
    }

    var fromDaily = Math.min(cost, daily);
    var fromPurchased = cost - fromDaily;
    var q = supabaseAdmin
      .from("profiles")
      .update({
        credits: credits - fromPurchased,
        daily_credits_remaining: daily - fromDaily,
        daily_credits_reset_at: resetAt,
      })
      .eq("id", userId);
    q = profile.credits === null ? q.is("credits", null) : q.eq("credits", profile.credits);
    q = profile.daily_credits_remaining === null
      ? q.is("daily_credits_remaining", null)
      : q.eq("daily_credits_remaining", profile.daily_credits_remaining);
    var { data: rows, error: upErr } = await q.select("id");
    if (upErr) return fail("credit update failed: " + upErr.message);
    if (rows && rows.length === 1) {
      return { ok: true, remaining: total - cost, fromDaily: fromDaily, fromPurchased: fromPurchased };
    }
    // Lost the race to a parallel request — re-read and try again.
  }
  return fail("credit update contention, gave up after retries");
}

/**
 * Atomically check + deduct credits (daily first, then purchased).
 * Prefers the deduct_credits RPC (row-locked, one transaction); falls back to
 * a compare-and-swap update if the RPC isn't deployed yet. Write failures are
 * returned as ok=false (insufficient=false) instead of silently "succeeding".
 */
export async function deductCredits(
  userId: string,
  action: string,
  cost: number
): Promise<DeductResult> {
  var result: DeductResult;
  var { data, error } = await supabaseAdmin.rpc("deduct_credits", { p_user_id: userId, p_cost: cost });
  if (error && isMissingFunction(error)) {
    result = await deductViaCompareAndSwap(userId, cost);
  } else if (error) {
    result = fail("deduct_credits failed: " + error.message);
  } else {
    var row = Array.isArray(data) ? data[0] : data;
    result = row && row.ok
      ? { ok: true, remaining: row.remaining, fromDaily: row.from_daily, fromPurchased: row.from_purchased }
      : { ok: false, remaining: row ? row.remaining : 0, fromDaily: 0, fromPurchased: 0, insufficient: true, error: "Not enough credits" };
  }

  if (!result.ok && !result.insufficient) {
    console.error("[deductCredits] " + result.error);
    captureServerError(new Error(result.error || "deductCredits failed"), "credits.deduct", { action: action, userId: userId });
  }
  if (result.ok) {
    await logTransaction({
      user_id: userId,
      amount: -cost,
      type: action,
      description: "Used " + cost + " credits for " + action + " (daily " + result.fromDaily + ", purchased " + result.fromPurchased + ")",
    });
  }
  return result;
}

/**
 * Put credits back into the SAME buckets they were charged from. Throws on
 * failure (caller logs it). Prefers the refund_credits RPC; falls back to
 * increment_credits (purchased) + compare-and-swap (daily, capped at the
 * tier's daily amount) if the v2 SQL isn't deployed yet.
 */
export async function refundCredits(
  userId: string,
  fromDaily: number,
  fromPurchased: number,
  action: string
): Promise<void> {
  if (fromDaily <= 0 && fromPurchased <= 0) return;

  var { error } = await supabaseAdmin.rpc("refund_credits", {
    p_user_id: userId,
    p_from_daily: fromDaily,
    p_from_purchased: fromPurchased,
  });
  if (error && !isMissingFunction(error)) throw new Error("refund_credits failed: " + error.message);

  if (error) {
    // Fallback path (v2 SQL not applied).
    if (fromPurchased > 0) {
      var { error: incErr } = await supabaseAdmin.rpc("increment_credits", { p_user_id: userId, p_amount: fromPurchased });
      if (incErr) throw new Error("increment_credits failed: " + incErr.message);
    }
    if (fromDaily > 0) {
      var done = false;
      for (var attempt = 0; attempt < 5 && !done; attempt++) {
        var { data: profile, error: readErr } = await supabaseAdmin
          .from("profiles")
          .select("daily_credits_remaining, subscription_tier")
          .eq("id", userId)
          .maybeSingle();
        if (readErr || !profile) throw new Error("refund read failed: " + (readErr ? readErr.message : "user not found"));
        var current = profile.daily_credits_remaining || 0;
        var next = Math.min(current + fromDaily, dailyAmountFor(profile.subscription_tier));
        var q = supabaseAdmin.from("profiles").update({ daily_credits_remaining: next }).eq("id", userId);
        q = profile.daily_credits_remaining === null
          ? q.is("daily_credits_remaining", null)
          : q.eq("daily_credits_remaining", profile.daily_credits_remaining);
        var { data: rows, error: upErr } = await q.select("id");
        if (upErr) throw new Error("daily refund update failed: " + upErr.message);
        done = !!rows && rows.length === 1;
      }
      if (!done) throw new Error("daily refund contention, gave up after retries");
    }
  }

  await logTransaction({
    user_id: userId,
    amount: fromDaily + fromPurchased,
    type: "refund_" + action,
    description: "Refunded " + (fromDaily + fromPurchased) + " credits for " + action + " (daily " + fromDaily + ", purchased " + fromPurchased + ")",
  });
}

/**
 * Add credits to a user's account (after a Stripe purchase).
 *
 * Concurrency-safe: uses an atomic Postgres function (`increment_credits`)
 * instead of SELECT-then-UPDATE. Two concurrent webhooks granting the same
 * user credits will serialise at the database level — no double-credit.
 *
 * Idempotency: if `stripePaymentId` is supplied, we first try to insert the
 * transaction row. The `credit_transactions.stripe_payment_id` column has a
 * unique partial index (see supabase-atomic-credits.sql), so a retried
 * webhook with the same payment_intent gets a 23505 unique-violation and
 * we no-op without granting credits twice.
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: string,
  stripePaymentId?: string
): Promise<void> {
  // 1) Idempotency guard — if this payment_intent already has a tx row, bail.
  //    (Belt-and-suspenders: stripe-webhook.ts also dedupes by event.id.)
  if (stripePaymentId) {
    var { data: existingTx } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("stripe_payment_id", stripePaymentId)
      .limit(1)
      .maybeSingle();
    if (existingTx) {
      console.log("[addCredits] dedupe — payment_intent already credited:", stripePaymentId);
      return;
    }
  }

  // 2) Atomic increment via RPC (no read-modify-write race)
  var { error: rpcError } = await supabaseAdmin.rpc("increment_credits", {
    p_user_id: userId,
    p_amount:  amount,
  });
  if (rpcError) {
    throw new Error("increment_credits failed: " + rpcError.message);
  }

  // 3) Log the transaction
  await logTransaction({
    user_id: userId,
    amount: amount,
    type: type,
    description: "Added " + amount + " credits (" + type + ")",
    stripe_payment_id: stripePaymentId || null,
  });
}
