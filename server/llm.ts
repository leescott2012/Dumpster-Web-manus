/**
 * One text/vision completion with provider fallback:
 * Claude -> Gemini -> OpenAI -> OpenRouter (only providers whose env key is set).
 * Plain fetch for the fallbacks (no new deps). Keys are never logged.
 * Not for tool use / streaming — those stay on the Anthropic SDK directly.
 */
import Anthropic from "@anthropic-ai/sdk";

export type LlmPart = { text: string } | { image: { mediaType: string; base64: string } };
export interface LlmMsg { role: "user" | "assistant"; content: string | LlmPart[] }
export interface LlmOpts {
  system?: string;
  messages: LlmMsg[];
  maxTokens: number;
  claudeModel: string;
  /** Claude key to use (BYO or env). Empty = skip Claude. */
  claudeKey?: string | null;
  /** True when claudeKey is the user's own key: auth errors never fall through. */
  byo?: boolean;
  /** The user's own non-Claude key. Used alone: it never falls through to our keys. */
  userProvider?: { name: string; key: string } | null;
  /** Total wall budget across all providers. */
  totalMs: number;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENROUTER_MODEL = "google/gemini-2.5-flash";

type Fallback = { name: string; run: (o: LlmOpts, ms: number, key?: string) => Promise<string> };

class LlmHttpError extends Error {
  constructor(public status: number, provider: string) { super(provider + " HTTP " + status); }
}

const asParts = (c: string | LlmPart[]): LlmPart[] => (typeof c === "string" ? [{ text: c }] : c);

async function post(url: string, headers: Record<string, string>, body: unknown, ms: number, provider: string): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new LlmHttpError(r.status, provider);
  return r.json();
}

const gemini: Fallback = {
  name: "gemini",
  run: async (o, ms, userKey) => {
    const key = userKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const data = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      { "x-goog-api-key": key! },
      {
        ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
        contents: o.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: asParts(m.content).map((p) => ("text" in p ? { text: p.text } : { inlineData: { mimeType: p.image.mediaType, data: p.image.base64 } })),
        })),
        // thinking off: 2.5 "thinking" tokens would eat maxOutputTokens and truncate JSON
        generationConfig: { maxOutputTokens: o.maxTokens, thinkingConfig: { thinkingBudget: 0 } },
      },
      ms, "gemini",
    );
    return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim();
  },
};

const chatCompat = (name: string, url: string, keyEnv: string, model: string): Fallback => ({
  name,
  run: async (o, ms, userKey) => {
    const messages: any[] = [];
    if (o.system) messages.push({ role: "system", content: o.system });
    for (const m of o.messages) {
      messages.push({
        role: m.role,
        content: asParts(m.content).map((p) =>
          "text" in p ? { type: "text", text: p.text } : { type: "image_url", image_url: { url: `data:${p.image.mediaType};base64,${p.image.base64}` } }),
      });
    }
    const data = await post(url, { Authorization: "Bearer " + (userKey || process.env[keyEnv]) }, { model, max_tokens: o.maxTokens, messages }, ms, name);
    return String(data?.choices?.[0]?.message?.content || "").trim();
  },
});

const FALLBACKS: Array<Fallback & { env: string[] }> = [
  { ...gemini, env: ["GEMINI_API_KEY", "GOOGLE_API_KEY"] },
  { ...chatCompat("openai", "https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", OPENAI_MODEL), env: ["OPENAI_API_KEY"] },
  { ...chatCompat("openrouter", "https://openrouter.ai/api/v1/chat/completions", "OPENROUTER_API_KEY", OPENROUTER_MODEL), env: ["OPENROUTER_API_KEY"] },
];

const activeFallbacks = () => FALLBACKS.filter((f) => f.env.some((k) => !!process.env[k]));

/** True if at least one provider can answer. */
export function llmConfigured(claudeKey?: string | null): boolean {
  return (!!claudeKey && claudeKey !== "your_anthropic_api_key_here") || activeFallbacks().length > 0;
}

const status = (e: unknown): number | undefined => (e as { status?: number } | null)?.status;
const retryable = (e: unknown) => { const s = status(e); return s === undefined || s === 408 || s === 429 || s >= 500; };
// Anthropic reports an empty account as a plain 400, not a 402.
const outOfCredit = (e: unknown) => status(e) === 400 && /credit balance/i.test((e as Error)?.message || "");

export async function llmComplete(o: LlmOpts): Promise<string> {
  if (o.userProvider) {
    const f = FALLBACKS.find((x) => x.name === o.userProvider!.name);
    if (!f) throw new Error("Unknown AI provider");
    const text = await f.run(o, o.totalMs, o.userProvider.key);
    if (!text) throw new Error(f.name + " empty");
    return text;
  }
  const t0 = Date.now();
  const fb = activeFallbacks();
  const haveClaude = !!o.claudeKey && o.claudeKey !== "your_anthropic_api_key_here";
  let firstErr: unknown;

  if (haveClaude) {
    // Leave room for fallbacks only when there are any.
    const ms = fb.length ? Math.round(o.totalMs * 0.6) : o.totalMs;
    try {
      const client = new Anthropic({ apiKey: o.claudeKey!, timeout: ms, maxRetries: 0 });
      const msg = await client.messages.create({
        model: o.claudeModel,
        max_tokens: o.maxTokens,
        ...(o.system ? { system: o.system } : {}),
        messages: o.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : m.content.map((p) =>
            "text" in p ? { type: "text" as const, text: p.text }
              : { type: "image" as const, source: { type: "base64" as const, media_type: p.image.mediaType as "image/jpeg", data: p.image.base64 } }),
        })),
      });
      const b = msg.content[0];
      return b && b.type === "text" ? b.text : "";
    } catch (e) {
      firstErr = e;
      const s = status(e);
      // BYO key: only transient errors fall through, never auth/validation.
      // Env key: a 401/403 (bad/expired platform key) or empty account may fall through too.
      const ok = retryable(e) || (!o.byo && (s === 401 || s === 403 || outOfCredit(e)));
      if (!ok || !fb.length) throw e;
      console.warn("[llm] claude failed (" + (s ?? "network") + "), falling back");
    }
  }

  let lastErr: unknown;
  for (const f of fb) {
    const left = o.totalMs - (Date.now() - t0);
    if (left < 3000) break;
    try {
      const text = await f.run(o, left);
      if (text) { if (haveClaude || fb[0] !== f) console.warn("[llm] answered by " + f.name); return text; }
      lastErr = new Error(f.name + " empty");
    } catch (e) {
      lastErr = e;
      console.warn("[llm] " + f.name + " failed (" + (status(e) ?? "network") + ")");
    }
  }
  throw firstErr ?? lastErr ?? new Error("No AI provider configured");
}
