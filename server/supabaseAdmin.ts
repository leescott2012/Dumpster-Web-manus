/**
 * Server-side Supabase client — uses service_role key (bypasses RLS)
 */
import { createClient } from "@supabase/supabase-js";

var url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export var supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Check + deduct credits for an AI action. Returns true if successful. */
export async function deductCredits(
  userId: string,
  action: string,
  cost: number
): Promise<{ ok: boolean; remaining: number; error?: string }> {
  // Fetch current balance
  var { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("credits, daily_credits_remaining, daily_credits_reset_at, subscription_tier")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { ok: false, remaining: 0, error: "User not found" };
  }

  // Check if daily credits need reset
  var resetAt = new Date(profile.daily_credits_reset_at);
  var now = new Date();
  if (now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000) {
    var dailyAmount = profile.subscription_tier === "pro" ? 200 : 15;
    profile.daily_credits_remaining = dailyAmount;
    profile.daily_credits_reset_at = now.toISOString();
    await supabaseAdmin
      .from("profiles")
      .update({ daily_credits_remaining: dailyAmount, daily_credits_reset_at: now.toISOString() })
      .eq("id", userId);
  }

  var total = profile.credits + profile.daily_credits_remaining;
  if (total < cost) {
    return { ok: false, remaining: total, error: "Not enough credits. Need " + cost + ", have " + total };
  }

  // Deduct: daily first, then purchased
  var fromDaily = Math.min(cost, profile.daily_credits_remaining);
  var fromPurchased = cost - fromDaily;

  await supabaseAdmin
    .from("profiles")
    .update({
      credits: profile.credits - fromPurchased,
      daily_credits_remaining: profile.daily_credits_remaining - fromDaily,
    })
    .eq("id", userId);

  // Log transaction
  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: -cost,
    type: action,
    description: "Used " + cost + " credits for " + action,
  });

  return { ok: true, remaining: total - cost };
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
  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: amount,
    type: type,
    description: "Added " + amount + " credits (" + type + ")",
    stripe_payment_id: stripePaymentId || null,
  });
}
