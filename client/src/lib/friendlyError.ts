/**
 * Translate raw server / Anthropic error strings into user-facing messages.
 *
 * Beta testers saw raw Claude API errors like:
 *   "Claude API error: 400 {"type":"error","error":{"type":"invalid_request_error",
 *    "message":"messages.0.co image exceeds 5 MB maximum: 5538112 bytes >
 *    5242880 bytes"},"request_id":"req_011CbGFBB7AnVS9FgoREnHg7"}"
 *
 * Those mean nothing to a normal user. This helper looks for the most common
 * failure shapes and returns a short, actionable message. Anything we don't
 * recognize falls through to a generic "Something went wrong — try again."
 * The original message is logged to the console so we can still debug.
 *
 * Pattern: keep the helper a pure string→string fn, no JSX, no toast calls.
 * Callers decide where to render the result.
 */

interface FriendlyMessage {
  /** Short title-style message to show as the primary error text. */
  message: string;
  /** Optional follow-up hint shown below the main message. */
  hint?: string;
  /** Whether the user should retry the same action (default true). */
  retryable: boolean;
}

export function friendlyError(raw: unknown, action?: string): FriendlyMessage {
  // Normalize to a searchable string
  var s = "";
  if (typeof raw === "string") s = raw;
  else if (raw instanceof Error) s = raw.message;
  else if (raw && typeof raw === "object") {
    try { s = JSON.stringify(raw); } catch { s = String(raw); }
  } else s = String(raw || "");

  // Log the raw text so debugging is possible without exposing it to users
  if (s) console.warn("[friendlyError] raw:", s);

  var lower = s.toLowerCase();

  // ── Server-issued structured errors (creditGate, rateLimit, dailyBudget) ──
  if (lower.includes("auth_required") || lower.includes("sign in to use ai")) {
    return { message: "Sign in to use AI features.", retryable: false };
  }
  if (lower.includes("rate_limit_exceeded") || /too many requests/.test(lower)) {
    var seconds = (s.match(/(\d+)s/) || [])[1];
    return {
      message: "You're going a little fast.",
      hint: seconds ? "Try again in " + seconds + " seconds." : "Try again in a minute.",
      retryable: true,
    };
  }
  if (lower.includes("daily_budget_exceeded") || lower.includes("temporarily unavailable while we top up")) {
    return {
      message: "AI features are paused for today.",
      hint: "We hit our daily compute cap to keep costs sane. Try again tomorrow.",
      retryable: false,
    };
  }
  if (lower.includes("insufficient_credits") || lower.includes("not enough credits")) {
    return {
      message: "Out of credits.",
      hint: "Open the Credits menu to top up.",
      retryable: false,
    };
  }

  // ── Vercel infrastructure ────────────────────────────────────────────────
  if (lower.includes("entity too large") || lower.includes("413")) {
    return {
      message: "Your photos add up to too much data.",
      hint: "Try fewer photos, or shoot at a lower resolution.",
      retryable: true,
    };
  }
  if (lower.includes("function_invocation_timeout") || lower.includes("504") || lower.includes("timed out")) {
    return {
      message: "That took too long.",
      hint: "Try fewer photos, or wait a moment and retry.",
      retryable: true,
    };
  }

  // ── Anthropic Claude API errors ──────────────────────────────────────────
  if (/image exceeds \d+\s*mb/i.test(s)) {
    return {
      message: "One of your photos is too large for AI.",
      hint: "Try uploading photos at a normal phone resolution.",
      retryable: true,
    };
  }
  if (lower.includes("overloaded_error") || lower.includes("overloaded") || lower.includes("529")) {
    return {
      message: "Claude is overloaded right now.",
      hint: "Try again in a minute.",
      retryable: true,
    };
  }
  if (lower.includes("authentication_error") || lower.includes("invalid api key")) {
    return {
      message: "AI service is misconfigured.",
      hint: "Email leescott2019@gmail.com — this is a server issue, not your fault.",
      retryable: false,
    };
  }
  if (lower.includes("rate_limit") || lower.includes("429")) {
    return {
      message: "Too many AI requests right now.",
      hint: "Wait a moment and try again.",
      retryable: true,
    };
  }
  if (lower.includes("invalid_request_error") || lower.includes("400")) {
    return {
      message: "AI couldn't process this request.",
      hint: action === "ai_suggest"
        ? "Try a different set of photos."
        : "Try again, or simplify the request.",
      retryable: true,
    };
  }

  // ── Network / fetch failures ─────────────────────────────────────────────
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("networkerror")) {
    return {
      message: "Can't reach the server.",
      hint: "Check your connection and try again.",
      retryable: true,
    };
  }

  // ── Default fallback ─────────────────────────────────────────────────────
  // Show a generic message; the raw text is in the console for debugging.
  return {
    message: "Something went wrong.",
    hint: s.length > 0 && s.length < 80 ? s : "Try again — if it keeps failing, email leescott2019@gmail.com.",
    retryable: true,
  };
}
