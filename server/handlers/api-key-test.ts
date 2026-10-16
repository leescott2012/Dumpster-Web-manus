/**
 * POST /api/api-key-test { provider, key } — verifies a user's own AI key with
 * the provider's free "list models" call (no credits spent, no tokens used).
 * The key is never stored or logged here; the browser keeps it on-device.
 * Returns { status: "verified" | "rejected" | "quota" | "unreachable" }.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { enforceRateLimit } from "../rateLimit.js";

const PROVIDERS: Record<string, (key: string) => { url: string; headers?: Record<string, string> }> = {
  gemini: (k) => ({ url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", headers: { "x-goog-api-key": k } }),
  openai: (k) => ({ url: "https://api.openai.com/v1/models", headers: { Authorization: "Bearer " + k } }),
  anthropic: (k) => ({ url: "https://api.anthropic.com/v1/models?limit=1", headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } }),
  openrouter: (k) => ({ url: "https://openrouter.ai/api/v1/auth/key", headers: { Authorization: "Bearer " + k } }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required" });
  if (!(await enforceRateLimit(req, res, "api_key_test", userId))) return;

  const { provider, key } = (req.body || {}) as { provider?: string; key?: string };
  const build = provider ? PROVIDERS[provider] : undefined;
  if (!build || typeof key !== "string" || key.length < 8 || key.length > 300) {
    return res.status(400).json({ error: "Invalid provider or key" });
  }

  try {
    const { url, headers } = build(key.trim());
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (r.ok) return res.json({ status: "verified" });
    if (r.status === 429 || r.status === 402) return res.json({ status: "quota" });
    if (r.status === 400 || r.status === 401 || r.status === 403) return res.json({ status: "rejected" });
    return res.json({ status: "unreachable" });
  } catch {
    return res.json({ status: "unreachable" });
  }
}
