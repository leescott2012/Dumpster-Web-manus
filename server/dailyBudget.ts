/**
 * Global daily $ budget circuit breaker.
 * Tracks today's estimated AI cost in Upstash Redis. If today's spend
 * exceeds DAILY_BUDGET_USD, all AI endpoints return 503.
 *
 * Set in Vercel env:
 *   DAILY_BUDGET_USD            (default: 20)
 *   DAILY_BUDGET_ALERT_PCT      (default: 80)
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Costs are stored in CENTS (integer) to avoid float drift.
 * Key expires after 36h so the counter resets each day automatically.
 */
import type { ServerResponse } from "http";
import { Redis } from "@upstash/redis";
import { captureServerMessage } from "./sentry.js";

var redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  var url = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url: url, token: token });
  return redis;
}

/** Estimated $ cost per action, in CENTS. Conservative upper bounds. */
var COST_CENTS: Record<string, number> = {
  ai_suggest: 25, // Claude vision, up to 20 images
  ai_label: 12,   // Claude Sonnet vision, up to 12 images per batch -- keep in sync with
                  // creditGate.ts COSTS.ai_label (was missing here, silently undercounted at
                  // the `|| 2` default, ~6x under its real cost in the daily-budget total)
  ai_caption: 3,
  ai_chat: 1,
  ai_recycle: 3,
  ig_scrub: 5,
};

function todayKey(): string {
  var d = new Date();
  // YYYY-MM-DD in UTC
  return "budget:" + d.toISOString().slice(0, 10);
}

function budgetCents(): number {
  var usd = Number(process.env.DAILY_BUDGET_USD) || 20;
  return Math.round(usd * 100);
}

function alertPct(): number {
  return Number(process.env.DAILY_BUDGET_ALERT_PCT) || 80;
}

/**
 * Check if today's budget is exceeded. If so, write 503 and return false.
 * If under budget, return true.
 */
export async function checkBudget(res: ServerResponse): Promise<boolean> {
  var r = getRedis();
  if (!r) return true; // fail-open in dev when Upstash isn't configured

  var spent = (await r.get<number>(todayKey())) || 0;
  var limit = budgetCents();

  if (spent >= limit) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "AI features are temporarily unavailable while we top up capacity. Try again tomorrow.",
      code: "daily_budget_exceeded",
    }));
    return false;
  }
  return true;
}

/**
 * Record the estimated cost of an action against today's budget.
 * Call this AFTER a successful AI call (or in finally).
 * Crosses an alert threshold? Log loudly so monitoring can pick it up.
 */
export async function recordCost(action: string): Promise<void> {
  var r = getRedis();
  if (!r) return;
  var cost = COST_CENTS[action] || 2;
  var key = todayKey();
  var newTotal = await r.incrby(key, cost);
  // Keep the key alive for 36h so today's tally never blows away mid-day
  await r.expire(key, 60 * 60 * 36);

  var limit = budgetCents();
  var pct = (newTotal / limit) * 100;
  if (pct >= alertPct() && pct - (cost / limit) * 100 < alertPct()) {
    // First crossing of alert threshold today — alert via console + Sentry
    var msg = "Crossed " + alertPct() + "% of daily AI budget: $" +
      (newTotal / 100).toFixed(2) + " / $" + (limit / 100).toFixed(2);
    console.warn("[dailyBudget] ⚠️  " + msg);
    captureServerMessage(msg, "dailyBudget.alertThreshold", "warning", {
      action: action,
      spentCents: newTotal,
      limitCents: limit,
      pct: Number(pct.toFixed(1)),
    });
  }
}

/** Read today's spend without mutating. For health endpoints. */
export async function getTodaySpend(): Promise<{ cents: number; limitCents: number }> {
  var r = getRedis();
  if (!r) return { cents: 0, limitCents: budgetCents() };
  var cents = (await r.get<number>(todayKey())) || 0;
  return { cents: cents, limitCents: budgetCents() };
}
