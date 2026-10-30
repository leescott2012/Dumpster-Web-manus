// Run: npx tsx client/src/lib/staleRelease.check.ts
import assert from "node:assert";
import { shouldReload } from "./staleRelease";

const data: Record<string, string> = {};
const store = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };

assert.equal(shouldReload(store, 1_000_000), true, "first failure reloads");
assert.equal(shouldReload(store, 1_030_000), false, "second failure in the window does not loop");
assert.equal(shouldReload(store, 1_070_000), true, "a later release reloads again");
const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => {} };
assert.equal(shouldReload(broken, 1), false, "blocked storage never reloads");
console.log("staleRelease.check OK");
