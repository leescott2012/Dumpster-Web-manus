// Sentry instrumentation MUST be imported first, before any React code,
// so module-load and hydration errors are captured.
import "./instrument";

import { createRoot } from "react-dom/client";
import { reactErrorHandler } from "@sentry/react";
import App from "./App";
import "./index.css";
import { captureReferral } from "./lib/referral";
import { claimOnBoot } from "./lib/deviceOwner";

captureReferral();

// React 19+: forward all error categories to Sentry via createRoot hooks.
// This catches errors that React 19 normally swallows (uncaught + recoverable).
// Swap another account's local data out BEFORE the app mounts (see deviceOwner.ts).
claimOnBoot().then(function () {
  createRoot(document.getElementById("root")!, {
    onUncaughtError: reactErrorHandler(),
    onCaughtError: reactErrorHandler(),
    onRecoverableError: reactErrorHandler(),
  }).render(<App />);
});
