/**
 * /api/service-balances — Live API wallet for the admin dashboard.
 *
 * Fetches balance / quota data from each external service in parallel.
 * Protected: requires a valid admin session (same ADMIN_USER_ID gate as
 * admin-stats). Returns a partial result when individual services fail
 * so a single timeout doesn't blank the whole card.
 *
 * Services:
 *   Anthropic   — model list ping (connectivity check; no public credit endpoint)
 *   Apify       — actor-run quota from /v2/users/me
 *   ElevenLabs  — character quota from /v1/user/subscription
 *   Stripe      — available + pending payout balance
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { getUserFromRequest } from "../server/creditGate.js";

const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? "";

function isAdmin(userId: string) {
  return ADMIN_USER_ID && userId === ADMIN_USER_ID;
}

// ── Individual service fetchers ────────────────────────────────────────────────

async function fetchAnthropicStatus(): Promise<{
  connected: boolean; model_count?: number; error?: string;
}> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { connected: false, error: "ANTHROPIC_API_KEY not set" };
  try {
    const r = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { connected: false, error: "HTTP " + r.status };
    const body = await r.json();
    return { connected: true, model_count: (body.data?.length as number) ?? undefined };
  } catch (e: any) {
    return { connected: false, error: e?.message ?? "timeout" };
  }
}

async function fetchApifyBalance(): Promise<{
  connected: boolean;
  plan?: string;
  compute_units_limit?: number;
  compute_units_used?: number;
  error?: string;
}> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { connected: false, error: "APIFY_TOKEN not set" };
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me?token=${token}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { connected: false, error: "HTTP " + r.status };
    const body = await r.json();
    const d = body?.data;
    // Apify nests plan info differently across account types; handle both.
    const plan = d?.plan?.id ?? d?.subscription?.plan?.id ?? "unknown";
    const limits = d?.plan?.maxMonthlyUsage ?? {};
    const cu_limit = limits.ACTOR_COMPUTE_UNITS ?? null;
    // Current month usage lives under monthlyUsage (if available)
    const cu_used = d?.monthlyUsage?.ACTOR_COMPUTE_UNITS ?? null;
    return {
      connected: true,
      plan,
      compute_units_limit: cu_limit,
      compute_units_used: cu_used,
    };
  } catch (e: any) {
    return { connected: false, error: e?.message ?? "timeout" };
  }
}

async function fetchElevenLabsBalance(): Promise<{
  connected: boolean;
  tier?: string;
  chars_used?: number;
  chars_limit?: number;
  reset_unix?: number;
  status?: string;
  error?: string;
}> {
  const key = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY_2;
  if (!key) return { connected: false, error: "ELEVENLABS_API_KEY not set" };
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { connected: false, error: "HTTP " + r.status };
    const body = await r.json();
    return {
      connected: true,
      tier: body.tier,
      chars_used: body.character_count,
      chars_limit: body.character_limit,
      reset_unix: body.next_character_count_reset_unix,
      status: body.status,
    };
  } catch (e: any) {
    return { connected: false, error: e?.message ?? "timeout" };
  }
}

async function fetchStripeBalance(): Promise<{
  connected: boolean;
  available_cents?: number;
  pending_cents?: number;
  currency?: string;
  error?: string;
}> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { connected: false, error: "STRIPE_SECRET_KEY not set" };
  try {
    const stripe = new Stripe(key);
    const bal = await stripe.balance.retrieve();
    // Sum across all currencies (most accounts are single-currency)
    const available = bal.available.reduce((s, b) => s + b.amount, 0);
    const pending   = bal.pending.reduce((s, b) => s + b.amount, 0);
    const currency  = bal.available[0]?.currency ?? "usd";
    return { connected: true, available_cents: available, pending_cents: pending, currency };
  } catch (e: any) {
    return { connected: false, error: e?.message ?? "stripe error" };
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getUserFromRequest(req).catch(() => null);
  if (!userId || !isAdmin(userId)) return res.status(403).json({ error: "Forbidden" });

  const [anthropic, apify, elevenlabs, stripe] = await Promise.allSettled([
    fetchAnthropicStatus(),
    fetchApifyBalance(),
    fetchElevenLabsBalance(),
    fetchStripeBalance(),
  ]);

  res.status(200).json({
    anthropic:  anthropic.status  === "fulfilled" ? anthropic.value  : { connected: false, error: "fetch failed" },
    apify:      apify.status      === "fulfilled" ? apify.value      : { connected: false, error: "fetch failed" },
    elevenlabs: elevenlabs.status === "fulfilled" ? elevenlabs.value : { connected: false, error: "fetch failed" },
    stripe:     stripe.status     === "fulfilled" ? stripe.value     : { connected: false, error: "fetch failed" },
  });
}
