/**
 * Refund-on-reject for Auto Gen. checkCredits hands the client a signed,
 * single-use token (X-Refund-Token) with each charge; if the user discards the
 * generated dump instead of creating it, the client posts the token to
 * /api/ai-suggest-refund and gets the credits back (same buckets).
 *
 * Stateless HMAC (keyed with the service-role key, so no new env) + a Redis
 * SET NX to make it single-use. No Redis => no refunds (fail closed).
 * ponytail: abuse ceiling = ai_suggest rate limit (5 per 10 min); add a DB
 * ledger if per-day refund caps are ever needed.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Redis } from "@upstash/redis";

const TTL_SEC = 60 * 60; // token valid 1h
let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function sign(body: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "dev").update(body).digest("base64url");
}

export interface RefundClaim { userId: string; daily: number; purchased: number; id: string }

export function makeRefundToken(userId: string, daily: number, purchased: number): { token: string; id: string } {
  const id = randomBytes(9).toString("base64url");
  const body = [userId, daily, purchased, Math.floor(Date.now() / 1000), id].join("|");
  return { token: Buffer.from(body).toString("base64url") + "." + sign(body), id };
}

export function readRefundToken(token: unknown): RefundClaim | null {
  const [b64, sig] = String(token || "").split(".");
  if (!b64 || !sig) return null;
  const body = Buffer.from(b64, "base64url").toString();
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [userId, daily, purchased, iat, id] = body.split("|");
  if (Date.now() / 1000 - Number(iat) > TTL_SEC) return null;
  return { userId, daily: Number(daily), purchased: Number(purchased), id };
}

/** true = this call won the right to use the token (first use). */
export async function claimRefundToken(id: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const ok = await r.set("dumprefund:" + id, "1", { nx: true, ex: TTL_SEC + 60 });
  return ok === "OK";
}
