/**
 * POST /api/iap-verify — server-side verification for native StoreKit 2 credit-pack purchases.
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
import { SignedDataVerifier, Environment, VerificationException } from "@apple/app-store-server-library";
import { getUserFromRequest } from "../creditGate.js";
import { enforceRateLimit } from "../rateLimit.js";
import { addCredits } from "../supabaseAdmin.js";
import { captureServerError } from "../sentry.js";

// Public root cert from https://www.apple.com/certificateauthority/ — not a secret,
// safe to inline. Apple signs StoreKit 2 transactions with a chain up to this root.
const APPLE_ROOT_CA_G3_BASE64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQL" +
  "DB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMw" +
  "MTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRp" +
  "ZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IA" +
  "BJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqX" +
  "l5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8w" +
  "DgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWT" +
  "xnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

const APPLE_ROOT_CERTS = [Buffer.from(APPLE_ROOT_CA_G3_BASE64, "base64")];
const BUNDLE_ID = "com.leescott.dumpster.ios";

// Matches CreditManager.CreditPack.all on the native side.
const CREDIT_PACKS: Record<string, number> = {
  "com.dumpster.credits.50": 50,
  "com.dumpster.credits.200": 200,
  "com.dumpster.credits.500": 500,
};

let verifiers: { production: SignedDataVerifier; sandbox: SignedDataVerifier } | null = null;
function getVerifiers() {
  if (!verifiers) {
    verifiers = {
      production: new SignedDataVerifier(APPLE_ROOT_CERTS, true, Environment.PRODUCTION, BUNDLE_ID),
      sandbox: new SignedDataVerifier(APPLE_ROOT_CERTS, true, Environment.SANDBOX, BUNDLE_ID),
    };
  }
  return verifiers;
}

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

    // TestFlight/sandbox purchases are signed with Environment.SANDBOX even though they
    // hit the same production API — try Production first, fall back to Sandbox.
    const { production, sandbox } = getVerifiers();
    let decoded;
    try {
      decoded = await production.verifyAndDecodeTransaction(signedTransaction);
    } catch (prodErr) {
      if (prodErr instanceof VerificationException) {
        decoded = await sandbox.verifyAndDecodeTransaction(signedTransaction);
      } else {
        throw prodErr;
      }
    }

    if (decoded.bundleId !== BUNDLE_ID) {
      return res.status(400).json({ error: "Bundle ID mismatch", code: "invalid_transaction" });
    }

    const productId = decoded.productId;
    const credits = productId ? CREDIT_PACKS[productId] : undefined;
    if (!credits) {
      return res.status(400).json({ error: "Unknown product: " + productId, code: "invalid_product" });
    }

    if (!decoded.transactionId) {
      return res.status(400).json({ error: "Missing transactionId", code: "invalid_transaction" });
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
