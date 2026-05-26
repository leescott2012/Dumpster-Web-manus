/**
 * Server-side Sentry init for Vercel serverless functions.
 *
 * Each function runs in its own cold-start container, so we lazily init
 * Sentry on first import — never throws if the DSN is missing (local dev
 * just no-ops). Use captureServerError() in handler catch blocks instead
 * of console.error so failures show up in the Sentry dashboard alongside
 * client errors.
 *
 * Why we reuse VITE_SENTRY_DSN rather than a separate SENTRY_DSN:
 *  - One project, one stream — easier to triage. The error scope tags
 *    automatically pick up runtime context (node-server vs browser).
 *  - One less env var to keep in sync across environments.
 */
import * as Sentry from "@sentry/node";

var initialized = false;

function init(): void {
  if (initialized) return;
  initialized = true;

  // Same DSN as the client uses. Set in Vercel env (or .env locally).
  var dsn = process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN || "";
  if (!dsn) {
    // No DSN configured — silent no-op so local dev doesn't break.
    return;
  }

  Sentry.init({
    dsn: dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    // 10% perf trace sample — captions/suggest are tail-latency sensitive
    tracesSampleRate: 0.1,
    // Don't auto-capture user IPs / cookies / headers; we'll set userId
    // explicitly in captureServerError() when we have it
    sendDefaultPii: false,
  });
}

/**
 * Capture a server-side error to Sentry. Safe to call even when Sentry
 * isn't configured (no-ops). Pass extra context where it helps triage:
 *   captureServerError(err, "ai-caption", { userId, action: "ai_caption" })
 */
export function captureServerError(
  err: unknown,
  source: string,
  extra?: Record<string, unknown>
): void {
  init();
  try {
    Sentry.withScope(function(scope) {
      scope.setTag("source", source);
      if (extra) {
        if (typeof extra.userId === "string") {
          scope.setUser({ id: extra.userId });
        }
        for (var k in extra) {
          if (k !== "userId") scope.setExtra(k, extra[k] as unknown);
        }
      }
      Sentry.captureException(err);
    });
  } catch (sentryErr) {
    // Swallow Sentry's own errors — never let observability break the user
    console.warn("[sentry] capture failed:", sentryErr);
  }
}

/**
 * Capture a server-side warning/message (non-error events). Use for
 * notable conditions like budget threshold crossings.
 */
export function captureServerMessage(
  message: string,
  source: string,
  level: "info" | "warning" | "error" = "warning",
  extra?: Record<string, unknown>
): void {
  init();
  try {
    Sentry.withScope(function(scope) {
      scope.setTag("source", source);
      scope.setLevel(level);
      if (extra) {
        for (var k in extra) scope.setExtra(k, extra[k] as unknown);
      }
      Sentry.captureMessage(message);
    });
  } catch (sentryErr) {
    console.warn("[sentry] capture-message failed:", sentryErr);
  }
}
