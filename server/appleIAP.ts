/**
 * Shared Apple StoreKit 2 verification setup — used by both iap-verify.ts
 * (client-reported purchases) and apple-webhook.ts (server-pushed renewal/
 * refund/cancellation notifications). Kept in one place so a cert rotation
 * or product-ID change only needs to happen once.
 */
import { SignedDataVerifier, Environment, VerificationException } from "@apple/app-store-server-library";
import { PRO_MONTHLY_CREDITS } from "../shared/pricing.js";

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

export const APPLE_ROOT_CERTS = [Buffer.from(APPLE_ROOT_CA_G3_BASE64, "base64")];
export const BUNDLE_ID = "com.leescott.dumpster.ios";

// Matches CreditManager.CreditPack.all on the native side.
export const CREDIT_PACKS: Record<string, number> = {
  "com.dumpster.credits.50": 50,
  "com.dumpster.credits.200": 200,
  "com.dumpster.credits.500": 500,
};

// Matches SubscriptionManager.Plan.all on the native side. Same 200-credit
// drop stripe-webhook.ts grants on subscription creation/renewal.
export const SUBSCRIPTION_PRODUCTS = new Set([
  "com.dumpster.pro.weekly",
  "com.dumpster.pro.monthly",
  "com.dumpster.pro.yearly",
]);
export const SUBSCRIPTION_CREDIT_DROP = PRO_MONTHLY_CREDITS;

let verifiers: { production: SignedDataVerifier; sandbox: SignedDataVerifier } | null = null;
export function getVerifiers() {
  if (!verifiers) {
    verifiers = {
      production: new SignedDataVerifier(APPLE_ROOT_CERTS, true, Environment.PRODUCTION, BUNDLE_ID),
      sandbox: new SignedDataVerifier(APPLE_ROOT_CERTS, true, Environment.SANDBOX, BUNDLE_ID),
    };
  }
  return verifiers;
}

/**
 * Verifies and decodes a signed StoreKit 2 transaction JWS. TestFlight/sandbox
 * purchases are signed with Environment.SANDBOX even though they hit the same
 * production API endpoint — try Production first, fall back to Sandbox.
 */
export async function verifyTransaction(signedTransaction: string) {
  const { production, sandbox } = getVerifiers();
  try {
    return await production.verifyAndDecodeTransaction(signedTransaction);
  } catch (prodErr) {
    if (prodErr instanceof VerificationException) {
      return await sandbox.verifyAndDecodeTransaction(signedTransaction);
    }
    throw prodErr;
  }
}

/** Same prod-then-sandbox fallback, for the outer Server Notifications V2 envelope. */
export async function verifyNotification(signedPayload: string) {
  const { production, sandbox } = getVerifiers();
  try {
    return await production.verifyAndDecodeNotification(signedPayload);
  } catch (prodErr) {
    if (prodErr instanceof VerificationException) {
      return await sandbox.verifyAndDecodeNotification(signedPayload);
    }
    throw prodErr;
  }
}
