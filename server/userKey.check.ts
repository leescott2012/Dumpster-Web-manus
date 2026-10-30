// Run: npx tsx server/userKey.check.ts
import assert from "node:assert";
import { userAnthropicKey, userOtherKey } from "./userKey";

const req = (provider: string, key: string) => ({ headers: { "x-api-provider": provider, "x-api-key": key } }) as any;
const G = "AIza" + "a".repeat(35), O = "sk-" + "b".repeat(40), R = "sk-or-v1-" + "c".repeat(40), A = "sk-ant-" + "d".repeat(40);

assert.deepEqual(userOtherKey(req("gemini", G)), { name: "gemini", key: G });
assert.deepEqual(userOtherKey(req("openai", O)), { name: "openai", key: O });
assert.deepEqual(userOtherKey(req("openrouter", R)), { name: "openrouter", key: R });
assert.equal(userOtherKey(req("openai", R)), null, "OpenRouter key never goes to OpenAI");
assert.equal(userOtherKey(req("openai", A)), null, "Claude key never goes to OpenAI");
assert.equal(userOtherKey(req("gemini", O)), null, "OpenAI key never goes to Google");
assert.equal(userOtherKey(req("anthropic", A)), null, "Claude keys keep their own path");
assert.equal(userAnthropicKey(req("anthropic", A)), A);
assert.equal(userOtherKey({ headers: {} } as any), null);
console.log("userKey.check OK");
