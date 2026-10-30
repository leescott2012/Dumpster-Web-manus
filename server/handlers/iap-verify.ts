/**
 * POST /api/iap-verify — server-side verification for native StoreKit 2 purchases:
 * one-time credit packs and Pro auto-renewing subscriptions.
 *
 * Why this exists: StoreKit 2 only verifies transactions on-device (CreditManager.swift).
 * A tampered client could previously call CreditManager.addCredits() directly without a
 * real Apple transaction. This endpoint verifies the transaction's JWS signature against
 * Apple's own certificate chain (no App Store Connect API key needed for this — that's
 * only required for the App Store Server API, which queries Apple's servers; verifying a
 * signature the client already handed us just needs Apple's public root certificate) and
 * grants credits server-side, atomically and idempotently, the same way Stripe purchases do.
 *
 * userId is always taken from the caller's Supabase JWT — never trust a userId in the body.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { VerificationException } from "@apple/app-store-server-library";
import { getUserFromRequest } from "../creditGate.js";
import { enforceRateLimit } from "../rateLimit.js";
import { addCredits, supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";
import {
  BUNDLE_ID,
  CREDIT_PACKS,
  SUBSCRIPTION_PRODUCTS,
  SUBSCRIPTION_CREDIT_DROP,
  verifyTransaction,
} from "../appleIAP.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = await getUserFromRequest(req);
    if (!userId) return res.status(401).json({ error: "Sign in required.", code: "auth_required" });

    if (!(await enforceRateLimit(req, res, "iap_verify", userId))) return;

    const body = (req.body || {}) as { signedTransaction?: string };
    const signedTransaction = body.signedTransaction;
    if (!signedTransaction || typeof signedTransaction !== "string") {
      return res.status(400).json({ error: "signedTransaction required", code: "invalid_request" });
    }

    const decoded = await verifyTransaction(signedTransaction);

    if (decoded.bundleId !== BUNDLE_ID) {
      return res.status(400).json({ error: "Bundle ID mismatch", code: "invalid_transaction" });
    }

    const productId = decoded.productId;
    if (!decoded.transactionId) {
      return res.status(400).json({ error: "Missing transactionId", code: "invalid_transaction" });
    }

    if (productId && SUBSCRIPTION_PRODUCTS.has(productId)) {
      // Refunded or expired — a stale client re-reporting an old entitlement.
      // Not an error, just nothing to grant. Downgrade-on-cancellation itself
      // is handled by apple-webhook.ts, since that can happen while the app
      // isn't open to report it.
      const now = Date.now();
      if (decoded.revocationDate || (decoded.expiresDate && decoded.expiresDate < now)) {
        return res.status(200).json({ ok: true, subscription: false, reason: "expired_or_revoked" });
      }

      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_tier: "pro",
          apple_original_transaction_id: decoded.originalTransactionId || decoded.transactionId,
          daily_credits_remaining: 0,
        })
        .eq("id", userId);

      // Idempotent per Apple transaction — each renewal mints a new transactionId,
      // so this naturally grants once per billing period without double-crediting
      // a client that re-reports the same still-current transaction on relaunch.
      await addCredits(userId, SUBSCRIPTION_CREDIT_DROP, "subscription_drop", "apple_" + decoded.transactionId);

      return res.status(200).json({ ok: true, subscription: true, productId: productId });
    }

    const credits = productId ? CREDIT_PACKS[productId] : undefined;
    if (!credits) {
      return res.status(400).json({ error: "Unknown product: " + productId, code: "invalid_product" });
    }

    // Idempotency + atomic grant reuses the same path as Stripe purchases (addCredits
    // dedupes on this key via a unique index on credit_transactions.stripe_payment_id).
    // "apple_" prefix keeps the two payment sources' IDs from ever colliding.
    await addCredits(userId, credits, "iap_purchase", "apple_" + decoded.transactionId);

    return res.status(200).json({ ok: true, creditsAdded: credits, productId: productId });
  } catch (err) {
    if (err instanceof VerificationException) {
      // Bad/forged/expired signature — not a server error, just a rejected purchase.
      captureServerError(err, "iap-verify.rejected", { status: err.status });
      return res.status(400).json({ error: "Transaction could not be verified.", code: "invalid_transaction" });
    }
    captureServerError(err, "iap-verify");
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}
