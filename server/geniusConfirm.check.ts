// Run: SUPABASE_URL=http://localhost:1 SUPABASE_SERVICE_ROLE_KEY=x npx tsx server/geniusConfirm.check.ts
// GENIUSS writes/refunds only run with a signed, unexpired token for the admin.
import assert from "node:assert";
import { createHmac } from "crypto";
import { stageAction, readStagedAction } from "./handlers/genius-chat.js";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret";

const t = stageAction({ kind: "write", sql: "update bug_reports set status = 'fixed'" }, "admin");
assert.deepStrictEqual(readStagedAction(t, "admin"), { kind: "write", sql: "update bug_reports set status = 'fixed'" });
assert.strictEqual(readStagedAction(t, "someone-else"), null, "bound to the admin");

const [payload, mac] = t.split(".");
const forged = Buffer.from(JSON.stringify({ a: { kind: "refund", pi: "pi_x" }, uid: "admin", exp: Date.now() + 1e6 })).toString("base64url");
assert.strictEqual(readStagedAction(forged + "." + mac, "admin"), null, "payload can't be swapped");
assert.strictEqual(readStagedAction(payload + ".AAAA", "admin"), null, "bad mac");
assert.strictEqual(readStagedAction("garbage", "admin"), null);

const expired = Buffer.from(JSON.stringify({ a: { kind: "write", sql: "x" }, uid: "admin", exp: Date.now() - 1 })).toString("base64url");
const emac = createHmac("sha256", "test-secret").update("geniuss-confirm:" + expired).digest("base64url");
assert.strictEqual(readStagedAction(expired + "." + emac, "admin"), null, "expired");
console.log("geniusConfirm.check: ok");
