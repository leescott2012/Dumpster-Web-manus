/**
 * Credit gate — wraps AI handlers with auth, rate limiting, daily budget, and credit checks.
 *
 * Order of checks (cheap → expensive):
 *   1. Auth required (401 if missing)         — kills guest-mode abuse
 *   2. Per-IP / per-user rate limit (429)     — kills bot floods
 *   3. Global daily $ budget (503)            — last-resort circuit breaker
 *   4. Credit deduction (402)                 — per-account fairness
 *
 * Each step short-circuits the response, so callers just check `proceed`.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";
import { userAnthropicKey } from "./userKey.js";
import { deductCredits, refundCredits, supabaseAdmin } from "./supabaseAdmin.js";
import { enforceRateLimit } from "./rateLimit.js";
import { checkBudget, recordCost } from "./dailyBudget.js";
import { captureServerError } from "./sentry.js";
import { makeRefundToken, claimRefundToken } from "./dumpRefund.js";

/** No-op refund for gates that never deducted anything. */
async function noopRefund(): Promise<void> {}

var supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

/** Extract user ID from Authorization header (Supabase JWT). Returns null if missing/invalid. */
export async function getUserFromRequest(req: IncomingMessage): Promise<string | null> {
  var auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;

  var token = auth.slice(7);
  try {
    var supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: "Bearer " + token } },
    });
    var { data: { user } } = await supabase.auth.getUser(token);
    return user ? user.id : null;
  } catch {
    return null;
  }
}

/** Credit costs per AI action */
// 1 credit = ~1¢ of real AI cost. Keep in sync with server/dailyBudget.ts
// COST_CENTS and client/src/lib/credits.ts CREDIT_COSTS.
var COSTS: Record<string, number> = {
  ai_suggest: 8,  // Auto Gen dump — subsidised (real cost up to ~25¢); refunded if the user rejects it
  ai_caption: 3,  // Claude Haiku vision (~3¢)
  // ai_label: no flat cost — priced per photo, see shared/aiLabelCost.ts (api/ai-label.ts passes opts.cost)
  ai_chat: 1,     // Valet (~1¢)
  ai_recycle: 1,  // unused: Recycle AI Pick calls /api/ai-chat and is charged ai_chat
  ig_scrub: 5,    // Apify scraping costs us ~5¢/call — charge accordingly
};

/**
 * Run the full gate. Returns userId + whether to proceed.
 * If proceed=false, response has already been written.
 *
 * The estimated $ cost is recorded against today's budget as soon as we deduct credits.
 * (Fire-and-forget; failures are logged but don't block the request.)
 */
export async function checkCredits(
  req: IncomingMessage,
  res: ServerResponse,
  action: string,
  opts?: { cost?: number; note?: string; free?: boolean } // free: no credits, keeps per-user daily cap + $ budget. dynamic per-request cost (ai_label: 1/photo) + ledger note
): Promise<{ userId: string | null; proceed: boolean; refund: () => Promise<void> }> {
  // 1) Auth required — no more guest-mode AI calls
  var userId = await getUserFromRequest(req);
  if (!userId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Sign in to use AI features.",
      code: "auth_required",
    }));
    return { userId: null, proceed: false, refund: noopRefund };
  }

  // 2) Per-user rate limit
  var rlOk = await enforceRateLimit(req, res, action, userId);
  if (!rlOk) return { userId: userId, proceed: false, refund: noopRefund };

  // Own verified Claude key: the user pays their provider, so no credits and
  // no draw on our daily $ budget (auth + rate limit above still apply).
  if (userAnthropicKey(req)) return { userId: userId, proceed: true, refund: noopRefund };

  // Free actions (one-time taste-profile scrub) also get a per-user DAILY cap.
  if (opts && opts.free) {
    var dailyOk = await enforceRateLimit(req, res, action + "_daily", userId, { code: action + "_limit" });
    if (!dailyOk) return { userId: userId, proceed: false, refund: noopRefund };
  }

  // 3) Global daily budget
  var budgetOk = await checkBudget(res);
  if (!budgetOk) return { userId: userId, proceed: false, refund: noopRefund };

  // 4) Credit balance
  //
  // TESTING ESCAPE HATCH: set DISABLE_CREDIT_LIMIT=1 in env to skip credit
  // deduction entirely. Auth + rate limit + daily $ budget still enforce —
  // those protect us from runaway costs. Remove or flip back to 0 to re-enable
  // per-user credit gating.
  //
  // Hardened (backend security audit, 2026-07-01): this flag is now ignored in
  // production regardless of its value, so a stray/misconfigured env var can't
  // silently make every AI call free for every user. Still honored in
  // preview/development for local testing.
  var isProd = (process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
  var creditsDisabled = !isProd && process.env.DISABLE_CREDIT_LIMIT === "1";
  var refund = noopRefund;
  if (!creditsDisabled && !(opts && opts.free)) {
    var cost = opts && opts.cost !== undefined ? opts.cost : (COSTS[action] || 2);
    var result = await deductCredits(userId, action, cost, opts && opts.note);
    if (!result.ok && !result.insufficient) {
      // DB write failed — don't run the AI for free, and don't blame the user's balance.
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Credits are temporarily unavailable. Try again in a moment.",
        code: "credits_unavailable",
      }));
      return { userId: userId, proceed: false, refund: noopRefund };
    }
    // Post-deduct balance rides on whatever response the handler writes, so
    // the client badge updates without an extra profile read. setHeader merges
    // into the handler's later writeHead. On failure the refund runs AFTER the
    // response, so the client ignores this header on non-2xx and re-reads.
    res.setHeader("X-Credits-Remaining", String(result.remaining || 0));
    if (!result.ok) {
      res.writeHead(402, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Not enough credits — need " + cost + ", have " + (result.remaining || 0) + ". Buy more in the credits menu.",
        code: "insufficient_credits",
        remaining: result.remaining,
        cost: cost,
      }));
      return { userId: userId, proceed: false, refund: noopRefund };
    }
    // Deduction succeeded — give the caller a way to undo it if the AI call
    // that follows fails or errors out (found 2026-07-18: credits were
    // deducted before the Claude call with no rollback on failure, so a
    // timeout/rate-limit/error on Anthropic's side silently charged the user
    // for nothing).
    // Refund goes back to the SAME buckets (daily vs purchased) that were
    // charged, and only once even if called twice.
    var deductedUserId = userId;
    var charged = { daily: result.fromDaily, purchased: result.fromPurchased };
    var refunded = false;
    // Auto Gen: single-use token so the client can claim a refund if the user
    // rejects the result. Burned on auto-refund so a failed call can't be
    // refunded twice (client only keeps the token from 2xx responses anyway).
    var refundTokenId = "";
    if (action === "ai_suggest") {
      var rt = makeRefundToken(userId, charged.daily, charged.purchased);
      refundTokenId = rt.id;
      res.setHeader("X-Refund-Token", rt.token);
    }
    refund = async function() {
      if (refunded) return;
      refunded = true;
      if (refundTokenId) await claimRefundToken(refundTokenId).catch(function() {});
      try {
        await refundCredits(deductedUserId, charged.daily, charged.purchased, action);
      } catch (e) {
        console.warn("[creditGate] refund failed:", e);
        captureServerError(e, "creditGate.refund", { action: action, userId: deductedUserId });
      }
    };
  }

  // Record cost against today's budget (fire-and-forget) — keep this even
  // when credits are disabled, so the $20/day circuit breaker still trips.
  recordCost(action).catch(function(e) {
    console.warn("[creditGate] recordCost failed:", e);
    captureServerError(e, "creditGate.recordCost", { action: action, userId: userId });
  });

  return { userId: userId, proceed: true, refund: refund };
}

/**
 * Run a credit-gated AI handler and refund unless it reports success.
 * Handlers return true only after writing a useful 200. Everything else —
 * a thrown error, any 4xx/5xx, an empty/invalid model result, all images
 * failing to load — returns false (or throws) and is refunded in `finally`.
 * Vercel killing the function at maxDuration skips `finally`, so handlers set
 * an Anthropic timeout below maxDuration to fail (and refund) before that.
 */
export async function runCharged(
  res: ServerResponse,
  gate: { refund: () => Promise<void> },
  source: string,
  fn: () => Promise<boolean>
): Promise<void> {
  var succeeded = false;
  try {
    succeeded = (await fn()) === true;
  } catch (e) {
    console.error("[" + source + "] handler threw:", e);
    captureServerError(e, source + ".handler");
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Something went wrong. Try again.", code: "ai_error" }));
    }
  } finally {
    if (!succeeded) await gate.refund();
  }
}

/**
 * Free auto-label abuse limits. The `auto` flag comes from the client, so the
 * server can't prove a request is really system-initiated — instead the free
 * path is bounded so abusing it is worth little:
 *   - at most AUTO_LABEL_MAX_PER_REQUEST images per request (client batches 6);
 *     larger requests get 429 `auto_label_limit` (client stops auto-healing);
 *   - at most 60 images per user per rolling 24h (rateLimit.ts
 *     `ai_label_auto_daily`, consumed one unit per image), same 429 code;
 *   - plus the existing 3 requests / 10 min burst limit (`ai_label_auto`).
 * Worst case ≈ 60 × ~2¢ ≈ $1.20/user/day, still inside the global $ breaker.
 * Note: if Upstash env vars are missing, rate limits fail open (dev only).
 */
export var AUTO_LABEL_MAX_PER_REQUEST = 6;

/**
 * Same gates as checkCredits (auth, rate limit, daily budget) but skips the
 * per-user credit deduction — for system-initiated actions that shouldn't
 * cost the user anything (e.g. auto re-labeling a photo stuck with a stale
 * pre-taxonomy category like "Object"). Real spend still counts against the
 * daily $ budget so the circuit breaker stays honest.
 */
export async function checkAutoCredits(
  req: IncomingMessage,
  res: ServerResponse,
  action: string,
  imageCount: number
): Promise<{ userId: string | null; proceed: boolean; refund: () => Promise<void> }> {
  var userId = await getUserFromRequest(req);
  if (!userId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Sign in required.", code: "auth_required" }));
    return { userId: null, proceed: false, refund: noopRefund };
  }

  if (imageCount > AUTO_LABEL_MAX_PER_REQUEST) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Too many photos for a free auto-scan (max " + AUTO_LABEL_MAX_PER_REQUEST + ").",
      code: "auto_label_limit",
    }));
    return { userId: userId, proceed: false, refund: noopRefund };
  }

  var rlOk = await enforceRateLimit(req, res, action, userId);
  if (!rlOk) return { userId: userId, proceed: false, refund: noopRefund };

  var dailyOk = await enforceRateLimit(req, res, action + "_daily", userId, {
    rate: Math.max(1, imageCount),
    code: "auto_label_limit",
  });
  if (!dailyOk) return { userId: userId, proceed: false, refund: noopRefund };

  var budgetOk = await checkBudget(res);
  if (!budgetOk) return { userId: userId, proceed: false, refund: noopRefund };

  recordCost(action, imageCount).catch(function(e) {
    console.warn("[creditGate] recordCost failed:", e);
    captureServerError(e, "creditGate.recordCost", { action: action, userId: userId });
  });
  // Free calls never hit credit_transactions — log them so the admin dashboard
  // counts this user as active and can show per-user free auto-label usage.
  supabaseAdmin.from("activity_log").insert({
    user_id: userId, event: "ai_label_auto", metadata: { images: imageCount },
  }).then(function(r) {
    if (r.error) console.warn("[creditGate] activity_log insert failed:", r.error.message);
  });

  // No credits were deducted (system-initiated action) — nothing to refund.
  return { userId: userId, proceed: true, refund: noopRefund };
}
