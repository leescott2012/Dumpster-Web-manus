/**
 * Bug logger — client side.
 *
 * Two surfaces:
 *
 *   1. `logBug(args)` — call from anywhere when something breaks. Posts to
 *      /api/bug-report and fires a pub-sub so a visible toast (rendered by
 *      <ErrorToaster/>) can pop up and offer a one-tap "Log this" button.
 *
 *   2. `installGlobalBugHandlers()` — call once at boot. Catches uncaught
 *      window errors and unhandled promise rejections so you don't have to
 *      manually wrap every async call.
 *
 * Reports go to Supabase via /api/bug-report (auth-optional). Even crashes
 * before sign-in get captured (user_id stays null in the row).
 */
import { supabase } from "./supabase";

export interface BugInput {
  source:      string;          // e.g. "auto-gen", "orb-stt", "stripe-checkout", "unhandled"
  message:     string;          // short human-readable summary
  error?:      unknown;         // raw error/exception for stack extraction
  errorCode?:  string | number; // optional code (HTTP status, error.name, etc.)
  context?:    Record<string, unknown>;
  /**
   * If true, do NOT show a toast — silent log. Used by auto-handlers so
   * everyday minor errors don't spam the UI. Default false (show toast).
   */
  silent?:     boolean;
}

export interface BugToastPayload {
  id:        string;             // local id for de-dupe + dismiss
  source:    string;
  message:   string;
  errorCode?: string;
  /** Async sender that does the actual POST. Returns true on success. */
  send: () => Promise<boolean>;
}

type ToastListener = (payload: BugToastPayload) => void;
const _toastListeners = new Set<ToastListener>();

export function onBugToast(fn: ToastListener): () => void {
  _toastListeners.add(fn);
  return () => _toastListeners.delete(fn);
}

function emitToast(payload: BugToastPayload) {
  _toastListeners.forEach(fn => { try { fn(payload); } catch { /* noop */ } });
}

// Stack extraction with safe fallbacks.
function getStack(err: unknown): string | undefined {
  if (!err) return undefined;
  if (err instanceof Error && err.stack) return err.stack;
  try { return JSON.stringify(err).slice(0, 4000); } catch { return String(err).slice(0, 4000); }
}
function getMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

// Build the wire body — same shape /api/bug-report expects.
function buildBody(args: BugInput) {
  return {
    source:     args.source,
    message:    args.message,
    error_code: args.errorCode != null ? String(args.errorCode) : undefined,
    stack:      getStack(args.error),
    url:        typeof window !== "undefined" ? window.location.href : undefined,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    viewport:   typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    context:    args.context,
  };
}

// De-dupe identical errors fired within 5s — prevents one bad render loop
// from filling the bug table with 100 identical rows.
const _recentSignatures = new Map<string, number>();
function isDupe(args: BugInput): boolean {
  const sig = args.source + "|" + args.message + "|" + (args.errorCode ?? "");
  const now = Date.now();
  const last = _recentSignatures.get(sig) ?? 0;
  _recentSignatures.set(sig, now);
  // Cleanup occasionally
  if (_recentSignatures.size > 50) {
    for (const [k, v] of _recentSignatures) if (now - v > 60_000) _recentSignatures.delete(k);
  }
  return now - last < 5_000;
}

async function postBug(body: ReturnType<typeof buildBody>): Promise<boolean> {
  try {
    // Best-effort attach JWT — endpoint accepts unauth too
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session) headers["Authorization"] = "Bearer " + session.access_token;
    const res = await fetch("/api/bug-report", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.warn("[bugLogger] post failed:", e);
    return false;
  }
}

/**
 * Log a bug. Fires a toast (unless silent) so the user can confirm + send.
 * The toast's send button calls the same backend.
 *
 * Returns immediately with no value — fire-and-forget by design.
 */
export function logBug(args: BugInput): void {
  if (isDupe(args)) return;

  const body = buildBody(args);

  if (args.silent) {
    void postBug(body);
    return;
  }

  // Show a toast that captures the details and offers a "Send" button.
  const id = Math.random().toString(36).slice(2, 10);
  emitToast({
    id,
    source: args.source,
    message: args.message,
    errorCode: args.errorCode != null ? String(args.errorCode) : undefined,
    send: () => postBug(body),
  });
}

// ── Global handlers ──────────────────────────────────────────────────────────

// Errors thrown by injected third-party scripts aren't ours to fix and just
// pollute the bug inventory. The Vercel Live feedback toolbar (preview
// deployments) throws a recurring InvalidNodeTypeError from its text-selection
// feature; browser extensions inject scripts under *-extension:// URLs. Drop
// anything that originates from these instead of logging it.
const NOISE_MARKERS = [
  "vercel.live",
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
];
function isNoiseError(...parts: Array<string | undefined | null>): boolean {
  const hay = parts.filter(Boolean).join(" ");
  return NOISE_MARKERS.some(m => hay.includes(m));
}

let _installed = false;
export function installGlobalBugHandlers(): void {
  if (_installed || typeof window === "undefined") return;
  _installed = true;

  window.addEventListener("error", (event) => {
    const stack = event.error instanceof Error ? event.error.stack : undefined;
    if (isNoiseError(stack, event.filename, event.message)) return;
    // event.error may be null in some browsers (CORS-failed scripts, etc.)
    logBug({
      source:   "unhandled",
      message:  getMessage(event.error ?? event.message, "Unhandled error"),
      error:    event.error,
      errorCode: event.error instanceof Error ? event.error.name : undefined,
      context:  {
        filename: event.filename,
        lineno:   event.lineno,
        colno:    event.colno,
      },
      silent:   true, // auto-captures shouldn't pop a toast — too noisy
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const stack = event.reason instanceof Error ? event.reason.stack : undefined;
    if (isNoiseError(stack, getMessage(event.reason, ""))) return;
    logBug({
      source:   "unhandled-promise",
      message:  getMessage(event.reason, "Unhandled promise rejection"),
      error:    event.reason,
      errorCode: event.reason instanceof Error ? event.reason.name : undefined,
      silent:   true,
    });
  });
}
