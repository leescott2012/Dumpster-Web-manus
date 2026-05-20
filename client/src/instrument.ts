/**
 * Sentry initialization — MUST be the very first import in main.tsx.
 *
 * Per Sentry's React SDK skill, instrumentation has to load before any React
 * code so that early errors (during module evaluation, hydration, etc.) are
 * captured. The DSN is read from Vite env at build time.
 *
 * Sentry stays disabled in:
 *   - dev (import.meta.env.PROD is false)
 *   - any environment where VITE_SENTRY_DSN is unset
 */
import * as Sentry from "@sentry/react";

var dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn && import.meta.env.PROD) {
  Sentry.init({
    dsn: dsn,
    environment: import.meta.env.MODE,
    // Release: prefer build-time injection; Vercel populates VITE_VERCEL_GIT_COMMIT_SHA
    // when the VERCEL_GIT_COMMIT_SHA env var is exposed to the client at build time.
    release: import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Performance traces: low % in prod to control cost
    tracesSampleRate: 0.1,
    // Session Replay: only when an error happens (saves quota)
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    // Don't capture PII by default — flip on if you ever need IP/headers
    sendDefaultPii: false,
  });
}
