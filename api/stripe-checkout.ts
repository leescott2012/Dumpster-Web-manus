/**
 * POST /api/stripe-checkout — creates a Stripe Checkout Session
 * Body: { type: "credits" | "subscription", packId?: string, planId?: string }
 *
 * userId is taken from the Supabase JWT (Authorization: Bearer ...), NEVER from the body.
 * This prevents an attacker from crediting a different account they don't own.
 */
import type { IncomingMessage, ServerResponse } from "http";
import Stripe from "stripe";
import { getUserFromRequest } from "../server/creditGate.js";
import { enforceRateLimit } from "../server/rateLimit.js";

export const config = { runtime: "nodejs", maxDuration: 10, memory: 256 };

var stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Stripe Price IDs — set these in Vercel env vars after creating products in Stripe
var PRICE_MAP: Record<string, string> = {
  credits_30: process.env.STRIPE_PRICE_CREDITS_30 || "",
  credits_100: process.env.STRIPE_PRICE_CREDITS_100 || "",
  credits_500: process.env.STRIPE_PRICE_CREDITS_500 || "",
  credits_1500: process.env.STRIPE_PRICE_CREDITS_1500 || "",
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "",
  lifetime: process.env.STRIPE_PRICE_LIFETIME || "",
};

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise(function(resolve, reject) {
    var chunks: Buffer[] = [];
    req.on("data", function(c: Buffer) { chunks.push(c); });
    req.on("end", function() {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405).end("Method not allowed");
    return;
  }

  try {
    // 1) Auth — pull userId from JWT, never trust the request body
    var userId = await getUserFromRequest(req);
    if (!userId) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Sign in to start checkout.", code: "auth_required" }));
      return;
    }

    // 2) Rate limit checkout creation (anti-spam)
    var rlOk = await enforceRateLimit(req, res, "stripe_checkout", userId);
    if (!rlOk) return;

    var body = await parseBody(req) as {
      type: "credits" | "subscription";
      packId?: string;
      planId?: string;
    };

    var itemId = body.type === "credits" ? body.packId : body.planId;
    if (!itemId || !PRICE_MAP[itemId]) {
      res.writeHead(400).end(JSON.stringify({ error: "Invalid item" }));
      return;
    }

    var priceId = PRICE_MAP[itemId];
    if (!priceId) {
      res.writeHead(400).end(JSON.stringify({ error: "Price not configured. Set STRIPE_PRICE_* env vars." }));
      return;
    }

    var origin = req.headers.origin || req.headers.referer || "https://dumpster-web-manus.vercel.app";
    // Remove trailing slash
    if (origin.endsWith("/")) origin = origin.slice(0, -1);

    var isSubscription = body.type === "subscription" && itemId !== "lifetime";

    var sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: origin + "?payment=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "?payment=cancelled",
      metadata: {
        userId: userId,
        type: body.type,
        itemId: itemId,
      },
      allow_promotion_codes: true,
    };

    // For subscriptions, add subscription metadata too
    if (isSubscription) {
      sessionParams.subscription_data = {
        metadata: { userId: userId },
      };
    }

    var session = await stripe.checkout.sessions.create(sessionParams);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ url: session.url }));
  } catch (err) {
    var msg = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  }
}
