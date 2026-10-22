// Run: npx tsx server/llm.check.ts  (mocks fetch; no network)
import assert from "node:assert";
import { llmComplete } from "./llm.js";

const calls: string[] = [];
let plan: Record<string, number> = {}; // provider -> status (default 200)
(globalThis as any).fetch = async (url: any) => {
  const u = String(url);
  const h = new URL(u).hostname;
  const host = h === "api.anthropic.com" ? "anthropic" : h === "generativelanguage.googleapis.com" ? "gemini" : h === "api.openai.com" ? "openai" : "openrouter";
  calls.push(host);
  assert.ok(!u.includes("key="), "key must not be in URL");
  const st = plan[host] ?? 200;
  const body = host === "anthropic" ? { id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: "claude" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }
    : host === "gemini" ? { candidates: [{ content: { parts: [{ text: "gemini" }] } }] }
    : { choices: [{ message: { content: host } }] };
  return new Response(JSON.stringify(st === 200 ? body : { error: "x" }), { status: st, headers: { "content-type": "application/json" } });
};
const base = { messages: [{ role: "user" as const, content: [{ text: "hi" }, { image: { mediaType: "image/jpeg", base64: "AAAA" } }] }], maxTokens: 50, claudeModel: "claude-haiku-4-5", totalMs: 20000 };
const run = async (o: Record<string, unknown> = {}) => {
  calls.length = 0;
  try { return await llmComplete({ ...base, ...o }); } catch (e) { return "ERR:" + ((e as { status?: number }).status ?? (e as Error).message); }
};
const env = (k: Record<string, string>) => {
  for (const n of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"]) delete process.env[n];
  Object.assign(process.env, k);
};

(async () => {
  env({ GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", OPENROUTER_API_KEY: "r" });
  plan = {};
  assert.equal(await run({ claudeKey: "sk" }), "claude"); assert.deepEqual(calls, ["anthropic"]);
  plan = { anthropic: 529 };
  assert.equal(await run({ claudeKey: "sk" }), "gemini"); assert.deepEqual(calls, ["anthropic", "gemini"]);
  plan = { anthropic: 429, gemini: 500 };
  assert.equal(await run({ claudeKey: "sk" }), "openai"); assert.deepEqual(calls, ["anthropic", "gemini", "openai"]);
  plan = { anthropic: 503, gemini: 500, openai: 429 };
  assert.equal(await run({ claudeKey: "sk" }), "openrouter"); assert.deepEqual(calls, ["anthropic", "gemini", "openai", "openrouter"]);
  plan = { anthropic: 503, gemini: 500, openai: 500, openrouter: 500 };
  assert.equal(await run({ claudeKey: "sk" }), "ERR:503", "all fail -> Claude's error surfaces");
  plan = {};
  assert.equal(await run({ claudeKey: null }), "gemini"); assert.deepEqual(calls, ["gemini"], "missing Claude key skips to fallbacks");
  plan = { anthropic: 401 };
  assert.equal(await run({ claudeKey: "sk", byo: true }), "ERR:401"); assert.deepEqual(calls, ["anthropic"], "BYO 401 never falls back");
  plan = { anthropic: 400 };
  assert.equal(await run({ claudeKey: "sk" }), "ERR:400"); assert.deepEqual(calls, ["anthropic"], "400 never falls back");
  plan = { anthropic: 401 };
  assert.equal(await run({ claudeKey: "sk" }), "gemini", "bad platform key falls back");
  env({});
  assert.ok((await run({ claudeKey: null })).startsWith("ERR:"), "no providers -> error");
  console.log("llm.check OK");
})();
