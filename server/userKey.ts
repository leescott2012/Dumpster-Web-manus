/**
 * Bring-your-own-key: the browser sends the user's verified Claude key in
 * x-api-key (+ x-api-provider: anthropic) on AI calls. Header name is on
 * Sentry's default scrub list. Never log or persist the value.
 */
import type { IncomingMessage } from "http";

export function userAnthropicKey(req: IncomingMessage): string | null {
  const key = String(req.headers["x-api-key"] || "").trim();
  const provider = String(req.headers["x-api-provider"] || "");
  return provider === "anthropic" && /^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(key) ? key : null;
}
