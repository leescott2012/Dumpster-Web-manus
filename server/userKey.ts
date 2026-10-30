/**
 * Bring-your-own-key: the browser sends the user's verified Claude key in
 * x-api-key (+ x-api-provider: anthropic | gemini | openai | openrouter) on AI calls. Header name is on
 * Sentry's default scrub list. Never log or persist the value.
 */
import type { IncomingMessage } from "http";

export type UserProvider = { name: "gemini" | "openai" | "openrouter"; key: string };

// Each key is only ever sent to its own provider's fixed URL; the prefix check
// stops a key for one provider reaching another provider's host.
const OTHER_KEY: Record<UserProvider["name"], RegExp> = {
  gemini: /^AIza[A-Za-z0-9_-]{30,100}$/,
  openrouter: /^sk-or-[A-Za-z0-9_-]{20,300}$/,
  openai: /^sk-(?!ant-|or-)[A-Za-z0-9_-]{20,300}$/,
};

/** The user's own verified Gemini / OpenAI / OpenRouter key, if they sent one. */
export function userOtherKey(req: IncomingMessage): UserProvider | null {
  const key = String(req.headers["x-api-key"] || "").trim();
  const name = String(req.headers["x-api-provider"] || "") as UserProvider["name"];
  return OTHER_KEY[name] && OTHER_KEY[name].test(key) ? { name, key } : null;
}

export function userAnthropicKey(req: IncomingMessage): string | null {
  const key = String(req.headers["x-api-key"] || "").trim();
  const provider = String(req.headers["x-api-provider"] || "");
  return provider === "anthropic" && /^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(key) ? key : null;
}
