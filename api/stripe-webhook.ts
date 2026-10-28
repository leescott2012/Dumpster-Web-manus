/**
 * POST /api/stripe-webhook — handles Stripe webhook events
 * Processes: checkout.session.completed, customer.subscription.updated/deleted
 */
import type { IncomingMessage, ServerResponse } from "http";
import Stripe from "stripe";
import { addCredits, supabaseAdmin } from "../server/supabaseAdmin.js";
import { captureServerError } from "../server/sentry.js";

export const config = { runtime: "nodejs", maxDuration: 15, memory: 256 };

var stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

// Credit amounts for each pack
var CREDIT_AMOUNTS: Record<string, number> = {
  credits_30: 30,
  credits_100: 100,
  credits_500: 500,
  credits_1500: 1500,
};

// Stripe events are a few KB; refuse anything absurd before buffering it all.
var MAX_BODY_BYTES = 512 * 1024;

function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise(function(resolve, reject) {
    var chunks: Buffer[] = [];
    var size = 0;
    req.on("data", function(c: Buffer) {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", function() { resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

/** Stable per-purchase grant key: payment_intent for one-time payments (GENIUSS
 * refunds look these up), the session id for subscription-mode checkouts. */
function purchaseKey(session: Stripe.Checkout.Session): string {
  return (session.payment_intent as string | null) || "stripe_cs_" + session.id;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method not allowed");
    return;
  }

  var rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch {
    res.writeHead(413).end("Payload too large");
    return;
  }
  var sig = req.headers["stripe-signature"] as string;

  var event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    var msg = err instanceof Error ? err.message : "Signature verification failed";
    res.writeHead(400).end("Webhook Error: " + msg);
    return;
  }

  var claimed = false;
  try {
    // Atomic idempotency check — INSERT wins or the PK conflict tells us the
    // event is already in-flight / processed. The previous select-then-insert
    // had a race window: two concurrent webhook deliveries (Stripe retries on
    // 5xx, network blips) could both pass the select, both insert, and both
    // proceed to addCredits → duplicate charge granted. Found in 2026-05-27 audit.
    var { error: insertErr } = await supabaseAdmin
      .from("stripe_events")
      .insert({
        id: event.id,
        type: event.type,
        data: event.data.object as unknown as Record<string, unknown>,
      });

    if (insertErr) {
      // 23505 = unique_violation in Postgres — another delivery already won.
      if (insertErr.code === "23505") {
        res.writeHead(200).end("Already processed");
        return;
      }
      // Anything else — let outer catch report via Sentry.
      throw insertErr;
    }
    claimed = true;

    // Handle checkout completed
    if (event.type === "checkout.session.completed") {
      var session = event.data.object as Stripe.Checkout.Session;
      var meta = session.metadata || {};
      var userId = meta.userId;
      var itemId = meta.itemId;
      var type = meta.type;

      if (!userId) {
        res.writeHead(200).end("No userId in metadata");
        return;
      }

      if (type === "credits" && itemId && CREDIT_AMOUNTS[itemId]) {
        // Add credits
        await addCredits(userId, CREDIT_AMOUNTS[itemId], "purchase", purchaseKey(session));
      } else if (type === "subscription") {
        if (itemId === "lifetime") {
          // Lifetime purchase — set pro + lifetime flag + bonus credits
          await supabaseAdmin
            .from("profiles")
            .update({
              subscription_tier: "pro",
              lifetime_purchase: true,
              stripe_customer_id: session.customer as string,
              daily_credits_remaining: 200,
            })
            .eq("id", userId);
          await addCredits(userId, 500, "lifetime_bonus", purchaseKey(session));
        } else {
          // Recurring subscription — set pro
          await supabaseAdmin
            .from("profiles")
            .update({
              subscription_tier: "pro",
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              daily_credits_remaining: 200,
            })
            .eq("id", userId);
          // 200 credits monthly drop
          // Subscription-mode sessions have no payment_intent, so key on the session.
          await addCredits(userId, 200, "subscription_drop", purchaseKey(session));
        }
      }
    }

    // Handle subscription cancellation
    if (event.type === "customer.subscription.deleted") {
      var sub = event.data.object as Stripe.Subscription;
      var subMeta = sub.metadata || {};
      if (subMeta.userId) {
        await supabaseAdmin
          .from("profiles")
          .update({ subscription_tier: "free", stripe_subscription_id: null })
          .eq("id", subMeta.userId);
      }
    }

    // Handle subscription update (e.g., renewal)
    if (event.type === "invoice.paid") {
      var invoice = event.data.object as Stripe.Invoice;
      // Stripe v17+: ID lives at invoice.parent.subscription_details.subscription
      // Pre-v17 fallback: invoice.subscription (direct field, now deprecated but still sent
      // by webhooks registered before the v17 API version)
      var invoiceSubId = (invoice.parent?.subscription_details?.subscription as string | undefined)
        ?? (invoice as unknown as { subscription?: string }).subscription;
      // The first invoice (billing_reason "subscription_create") is the same
      // payment checkout.session.completed already granted 200 for above.
      if (invoiceSubId && invoice.billing_reason !== "subscription_create") {
        // Find user by subscription ID
        var { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_subscription_id", invoiceSubId)
          .single();
        if (profile) {
          // Monthly credit drop on renewal
          await addCredits(profile.id, 200, "subscription_renewal", "stripe_inv_" + invoice.id);
        }
      }
    }

    res.writeHead(200).end("ok");
  } catch (err) {
    // Release the claim so Stripe's retry re-runs the fulfilment instead of
    // hitting "Already processed" and dropping the purchase. Safe to re-run:
    // grants are keyed per purchase (addCredits) and profile updates are sets.
    if (claimed) {
      await supabaseAdmin.from("stripe_events").delete().eq("id", event.id).then(undefined, function() {});
    }
    var errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook error:", errMsg);
    // High-signal alert: a payment webhook failing means we may be missing
    // credit grants. Tag distinctively so it stands out in the Sentry feed.
    captureServerError(err, "stripe-webhook");
    res.writeHead(500).end("Error: " + errMsg);
  }
}
