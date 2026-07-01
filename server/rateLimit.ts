/**
 * Rate limiting via Upstash Redis.
 * Two layers: per-IP (anti-bot) and per-user (per-account fairness).
 *
 * Set these in Vercel env:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * If env vars are missing, rate limiting is bypassed (logged warning).
 * This keeps local dev frictionless while still protecting production.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

var redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  var url = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("[rateLimit] UPSTASH env vars missing — rate limiting DISABLED");
    return null;
  }
  redis = new Redis({ url: url, token: token });
  return redis;
}

/** Per-action rate limit windows. */
var LIMITS: Record<string, { count: number; window: "10 m" | "1 m" | "1 h" }> = {
  ai_suggest:  { count: 5,  window: "10 m" }, // heavy: Claude vision with up to 20 images
  ai_label:    { count: 8,  window: "10 m" }, // heavy: Claude Sonnet vision, up to 12 images/batch
  ai_caption:  { count: 20, window: "10 m" },
  ai_chat:     { count: 30, window: "10 m" },
  ai_recycle:  { count: 10, window: "10 m" },
  ig_scrub:    { count: 3,  window: "10 m" }, // expensive scraping
  tts:         { count: 20, window: "10 m" }, // ElevenLabs cost per call
  admin_user_detail: { count: 30, window: "10 m" }, // PII/IP lookup — throttle enumeration
  stripe_checkout: { count: 10, window: "1 h" }, // anti-spam
};

var limiterCache: Record<string, Ratelimit> = {};
function getLimiter(action: string): Ratelimit | null {
  var r = getRedis();
  if (!r) return null;
  if (limiterCache[action]) return limiterCache[action];
  var cfg = LIMITS[action] || { count: 30, window: "10 m" as const };
  limiterCache[action] = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(cfg.count, cfg.window),
    analytics: false,
    prefix: "rl:" + action,
  });
  return limiterCache[action];
}

/** Extract client IP from common Vercel headers. */
function getClientIp(req: IncomingMessage): string {
  var fwd = (req.headers["x-forwarded-for"] as string) || "";
  if (fwd) return fwd.split(",")[0].trim();
  var real = req.headers["x-real-ip"] as string;
  if (real) return real;
  return req.socket?.remoteAddress || "unknown";
}

/**
 * Enforce rate limit for an action. Identifier preference: userId → IP.
 * Returns true if request may proceed. Writes 429 + sets headers if blocked.
 */
export async function enforceRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  action: string,
  userId: string | null
): Promise<boolean> {
  var limiter = getLimiter(action);
  if (!limiter) return true; // env missing → fail-open in dev

  var identifier = userId ? "u:" + userId : "ip:" + getClientIp(req);
  var result = await limiter.limit(identifier);

  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  res.setHeader("X-RateLimit-Reset", String(result.reset));

  if (!result.success) {
    var retryAfterSec = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Too many requests. Try again in " + retryAfterSec + "s.",
      code: "rate_limit_exceeded",
      retryAfter: retryAfterSec,
    }));
    return false;
  }
  return true;
}
