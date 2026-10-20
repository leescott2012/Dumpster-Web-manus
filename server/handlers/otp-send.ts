/**
 * POST /api/otp-send (routed via api/social.ts?fn=otp-send, Hobby 12-function cap) — the only way clients request a sign-in / verification code.
 *
 * Enforces a per-account limit on the server (3 codes per hour, 30s apart, counted per
 * hashed phone/email), so clearing a browser or switching devices doesn't reset it. Then
 * forwards to Supabase Auth, which sends the code (Twilio Verify for phones).
 *
 * body: { channel: "phone" | "email", identifier: string, mode?: "signin" | "add" }
 *   signin: sign in / create account.
 *   add:    attach a phone to the signed-in account (needs Authorization: Bearer <jwt>).
 * 429 -> { error, retryAfterSeconds }. Verifying a code still goes straight to Supabase.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (already set for this project's other API routes) and
 * the otp_sends table + otp_try_send() from supabase-otp-limit.sql.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const MAX_SENDS = 3;
const WINDOW_SECS = 3600;
const COOLDOWN_SECS = 30;
// Public project URL (same one the client bundles); env wins if set.
const FALLBACK_URL = "https://zstsigakqcggerhjbawj.supabase.co";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only." });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(503).json({ error: "Server not configured." });
  const apikey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || serviceKey;

  const body = (typeof req.body === "string" ? safeJson(req.body) : req.body) || {};
  const channel = body.channel === "email" ? "email" : body.channel === "phone" ? "phone" : null;
  const mode = body.mode === "add" ? "add" : "signin";
  const raw = typeof body.identifier === "string" ? body.identifier.trim() : "";
  if (!channel) return res.status(400).json({ error: "channel must be phone or email." });

  const identifier = channel === "email" ? raw.toLowerCase() : raw.replace(/[\s().-]/g, "");
  if (channel === "phone" && !/^\+[1-9]\d{7,14}$/.test(identifier)) return res.status(400).json({ error: "Enter a valid phone number with country code." });
  if (channel === "email" && !looksLikeEmail(identifier)) return res.status(400).json({ error: "Enter a valid email address." });
  if (mode === "add" && channel !== "phone") return res.status(400).json({ error: "add mode is phone only." });

  const jwt = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (mode === "add" && !jwt) return res.status(401).json({ error: "Sign in first." });

  // 1) Limit check + record, atomically in the database.
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const hash = createHash("sha256").update(`${channel}:${identifier}`).digest("hex");
  const { data: wait, error: rpcError } = await admin.rpc("otp_try_send", {
    p_hash: hash, p_max: MAX_SENDS, p_window_secs: WINDOW_SECS, p_cooldown_secs: COOLDOWN_SECS,
  });
  if (rpcError) return res.status(503).json({ error: "Could not check the code limit. Try again shortly." });
  if (typeof wait === "number" && wait > 0) {
    res.setHeader("Retry-After", String(wait));
    const mins = Math.ceil(wait / 60);
    return res.status(429).json({
      error: wait <= COOLDOWN_SECS ? `Please wait ${wait}s before requesting another code.` : `Too many codes requested. Try again in about ${mins} min.`,
      retryAfterSeconds: wait,
    });
  }

  // 2) Ask Supabase Auth to send the code.
  const upstream = mode === "add"
    ? await fetch(`${url}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: identifier }),
      })
    : await fetch(`${url}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey, "Content-Type": "application/json" },
        body: JSON.stringify(channel === "phone" ? { phone: identifier, create_user: true } : { email: identifier, create_user: true }),
      });

  if (!upstream.ok) {
    let message = "Could not send the code.";
    try { const j = await upstream.json(); message = j.msg || j.error_description || j.message || message; } catch { /* keep default */ }
    return res.status(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502).json({ error: message });
  }
  return res.status(200).json({ ok: true });
}

// Linear-time check (a backtracking regex here could be slowed by crafted input).
function looksLikeEmail(s: string) {
  if (s.length > 254 || /\s/.test(s)) return false;
  const at = s.indexOf("@");
  return at > 0 && at === s.lastIndexOf("@") && s.indexOf(".", at + 2) > 0 && !s.endsWith(".");
}

function safeJson(s: string) { try { return JSON.parse(s); } catch { return null; } }
