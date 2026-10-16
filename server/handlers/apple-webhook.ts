/**
 * POST /api/apple-webhook — App Store Server Notifications V2 receiver.
 *
 * Why this exists: iap-verify.ts only hears about a subscription when the
 * app itself reports a purchase. Renewals, billing-retry failures, refunds,
 * and Family Sharing revocations that happen while the app isn't open never
 * reach us that way — Apple pushes this endpoint a signed notification for
 * those instead. Configure the URL in App Store Connect → your app →
 * App Information → App Store Server Notifications (Production and Sandbox).
 *
 * Auth: the notification's own JWS signature (verified against Apple's root
 * cert, same chain as iap-verify.ts) is the only authentication needed —
 * there's no user JWT, since this is a server-to-server call from Apple.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { VerificationException, NotificationTypeV2 } from "@apple/app-store-server-library";
import { addCredits, supabaseAdmin } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";
import {
  BUNDLE_ID,
  SUBSCRIPTION_PRODUCTS,
  SUBSCRIPTION_CREDIT_DROP,
  verifyTransaction,
  verifyNotification,
} from "../appleIAP.js";

// Notification types that mean the subscription is no longer active. Does NOT
// include DID_FAIL_TO_RENEW — that just starts a billing retry / grace period;
// GRACE_PERIOD_EXPIRED is the actual end of the line if retries keep failing.
const DOWNGRADE_TYPES = new Set<string>([
  NotificationTypeV2.EXPIRED,
  NotificationTypeV2.GRACE_PERIOD_EXPIRED,
  NotificationTypeV2.REFUND,
  NotificationTypeV2.REVOKE,
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = (req.body || {}) as { signedPayload?: string };
    const signedPayload = body.signedPayload;
    if (!signedPayload || typeof signedPayload !== "string") {
      return res.status(400).json({ error: "signedPayload required", code: "invalid_request" });
    }

    const notification = await verifyNotification(signedPayload);

    // Idempotency — a retried delivery (Apple retries on non-2xx) must not
    // apply the same renewal/refund twice. Mirrors stripe-webhook.ts's use
    // of stripe_events: INSERT wins or the PK conflict means already-handled.
    if (notification.notificationUUID) {
      const { error: insertErr } = await supabaseAdmin.from("apple_notifications").insert({
        id: notification.notificationUUID,
        type: notification.notificationType,
        data: notification as unknown as Record<string, unknown>,
      });
      if (insertErr) {
        if (insertErr.code === "23505") return res.status(200).json({ ok: true, note: "already processed" });
        throw insertErr;
      }
    }

    const signedTransactionInfo = notification.data?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      // Notification types with no transaction (e.g. TEST) — nothing to act on.
      return res.status(200).json({ ok: true, note: "no transaction info" });
    }

    const decoded = await verifyTransaction(signedTransactionInfo);
    if (decoded.bundleId !== BUNDLE_ID) {
      return res.status(200).json({ ok: true, note: "bundle ID mismatch, ignored" });
    }
    if (!decoded.productId || !SUBSCRIPTION_PRODUCTS.has(decoded.productId) || !decoded.originalTransactionId) {
      // Not one of our Pro subscription products — one-time credit-pack
      // notifications are handled synchronously by iap-verify.ts already.
      return res.status(200).json({ ok: true, note: "not a subscription product" });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("apple_original_transaction_id", decoded.originalTransactionId)
      .maybeSingle();
    if (!profile) {
      // User hasn't linked this originalTransactionId yet (e.g. sandbox test
      // notification fired before the app ever called iap-verify). Nothing to do.
      return res.status(200).json({ ok: true, note: "no matching profile" });
    }

    const notificationType = notification.notificationType;
    if (notificationType === NotificationTypeV2.DID_RENEW) {
      await supabaseAdmin
        .from("profiles")
        .update({ subscription_tier: "pro", daily_credits_remaining: 200 })
        .eq("id", profile.id);
      // Idempotent per Apple transaction — each renewal mints a new transactionId.
      if (decoded.transactionId) {
        await addCredits(profile.id, SUBSCRIPTION_CREDIT_DROP, "subscription_renewal", "apple_" + decoded.transactionId);
      }
    } else if (notificationType && DOWNGRADE_TYPES.has(notificationType)) {
      await supabaseAdmin.from("profiles").update({ subscription_tier: "free" }).eq("id", profile.id);
    }
    // Other types (SUBSCRIBED, DID_CHANGE_RENEWAL_*, OFFER_REDEEMED, DID_FAIL_TO_RENEW
    // mid-retry, etc.) don't change our stored tier — no-op by design.

    return res.status(200).json({ ok: true, notificationType });
  } catch (err) {
    if (err instanceof VerificationException) {
      captureServerError(err, "apple-webhook.rejected", { status: err.status });
      return res.status(400).json({ error: "Notification could not be verified.", code: "invalid_notification" });
    }
    captureServerError(err, "apple-webhook");
    if (!res.headersSent) return res.status(500).json({ error: "Internal error" });
  }
}
