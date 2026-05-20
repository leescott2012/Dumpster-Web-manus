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
import { deductCredits } from "./supabaseAdmin.js";
import { enforceRateLimit } from "./rateLimit.js";
import { checkBudget, recordCost } from "./dailyBudget.js";

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
var COSTS: Record<string, number> = {
  ai_suggest: 15,
  ai_caption: 5,
  ai_chat: 2,
  ai_recycle: 5,
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
  action: string
): Promise<{ userId: string | null; proceed: boolean }> {
  // 1) Auth required — no more guest-mode AI calls
  var userId = await getUserFromRequest(req);
  if (!userId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Sign in to use AI features.",
      code: "auth_required",
    }));
    return { userId: null, proceed: false };
  }

  // 2) Per-user rate limit
  var rlOk = await enforceRateLimit(req, res, action, userId);
  if (!rlOk) return { userId: userId, proceed: false };

  // 3) Global daily budget
  var budgetOk = await checkBudget(res);
  if (!budgetOk) return { userId: userId, proceed: false };

  // 4) Credit balance
  var cost = COSTS[action] || 2;
  var result = await deductCredits(userId, action, cost);
  if (!result.ok) {
    res.writeHead(402, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not enough credits — need " + cost + ", have " + (result.remaining || 0) + ". Buy more in the credits menu.",
      code: "insufficient_credits",
      remaining: result.remaining,
      cost: cost,
    }));
    return { userId: userId, proceed: false };
  }

  // Record cost against today's budget (fire-and-forget)
  recordCost(action).catch(function(e) { console.warn("[creditGate] recordCost failed:", e); });

  return { userId: userId, proceed: true };
}
