/**
 * Credit gate — wraps AI handlers to check + deduct credits before processing.
 * If no auth token → allows request (guest mode, uses no credits).
 * If auth token → checks credits, deducts after success.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";
import { deductCredits } from "./supabaseAdmin.js";

var supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
var supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

/** Extract user ID from Authorization header (Supabase JWT) */
export async function getUserFromRequest(req: IncomingMessage): Promise<string | null> {
  var auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;

  var token = auth.slice(7);
  var supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
  });
  var { data: { user } } = await supabase.auth.getUser(token);
  return user ? user.id : null;
}

/** Credit costs per AI action */
var COSTS: Record<string, number> = {
  ai_suggest: 15,
  ai_caption: 5,      // average of casual (3) and pro (8)
  ai_chat: 2,
  ai_recycle: 5,
};

/**
 * Check credits before an AI call.
 * Returns userId if authenticated, null if guest.
 * Sends 402 if not enough credits.
 */
export async function checkCredits(
  req: IncomingMessage,
  res: ServerResponse,
  action: string
): Promise<{ userId: string | null; proceed: boolean }> {
  var userId = await getUserFromRequest(req);

  // Guest mode — no auth, no credit check (limited by rate limiting later)
  if (!userId) {
    return { userId: null, proceed: true };
  }

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

  return { userId: userId, proceed: true };
}
