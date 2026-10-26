// Run: npx tsx shared/notifications.selftest.ts
import assert from "node:assert/strict";
import * as n from "./notifications";

const now = Date.parse("2026-10-21T15:00:00Z");
assert.equal(n.isValidDay("2026-10-21", now), true);
assert.equal(n.isValidDay("2026-10-22", now), true);   // timezone ahead
assert.equal(n.isValidDay("2026-10-25", now), false);  // forged far future
assert.equal(n.isValidDay("2020-01-01", now), false);
assert.equal(n.isValidDay("x'; bad", now), false);
assert.equal(n.reminderIgKey("2026-10-21"), "reminder_ig:2026-10-21");

// reminders: not on the day they tapped Later, daily after, never once linked
assert.equal(n.shouldRemindIg({ pendingDay: "2026-10-21", linked: false, today: "2026-10-21" }), false);
assert.equal(n.shouldRemindIg({ pendingDay: "2026-10-21", linked: false, today: "2026-10-22" }), true);
assert.equal(n.shouldRemindIg({ pendingDay: "2026-10-21", linked: true, today: "2026-10-30" }), false);
assert.equal(n.shouldRemindIg({ pendingDay: undefined, linked: false, today: "2026-10-30" }), false);
assert.equal(n.shouldRemindIg({ pendingDay: true, linked: false, today: "2026-10-30" }), false);

// permissions
assert.equal(n.canMessage({ accepted: true, blockedEitherWay: false, self: false }), true);
assert.equal(n.canMessage({ accepted: false, blockedEitherWay: false, self: false }), false);
assert.equal(n.canMessage({ accepted: true, blockedEitherWay: true, self: false }), false);
assert.equal(n.canMessage({ accepted: true, blockedEitherWay: false, self: true }), false);

// collapsing: 3 unread -> "3 new messages"; after read it restarts
assert.equal(n.nextRollingCount(null), 1);
assert.equal(n.nextRollingCount({ read_at: null, data: { count: 1 } }), 2);
assert.equal(n.nextRollingCount({ read_at: null, data: { count: 2 } }), 3);
assert.equal(n.nextRollingCount({ read_at: null, data: null }), 2);
assert.equal(n.nextRollingCount({ read_at: "2026-10-21T00:00:00Z", data: { count: 9 } }), 1);
assert.equal(n.dmTitle("sam", 3), "3 new messages from sam");
assert.equal(n.dmTitle("sam", 1), "New message from sam");

// credits
assert.equal(n.creditsAreLow({ credits: 0, daily: 2, dailyResetAt: new Date(now - 3600e3).toISOString(), nowMs: now }), true);
assert.equal(n.creditsAreLow({ credits: 30, daily: 0, dailyResetAt: new Date(now - 3600e3).toISOString(), nowMs: now }), false);
assert.equal(n.creditsAreLow({ credits: 0, daily: 0, dailyResetAt: new Date(now - 48 * 3600e3).toISOString(), nowMs: now }), false); // stale -> refills

// links
const id = "123e4567-e89b-12d3-a456-426614174000";
assert.deepEqual(n.parseLink("/messages/" + id), { to: "dm", userId: id });
assert.deepEqual(n.parseLink("/connections"), { to: "connections" });
assert.deepEqual(n.parseLink("/taste"), { to: "taste" });
assert.equal(n.parseLink("/messages/../../etc"), null);
assert.equal(n.parseLink(null), null);

// day grouping
const items = [
  { created_at: "2026-10-21T10:00:00" }, { created_at: "2026-10-21T08:00:00" },
  { created_at: "2026-10-20T20:00:00" }, { created_at: "2026-10-01T09:00:00" },
];
const g = n.groupByDay(items, new Date("2026-10-21T12:00:00"));
assert.deepEqual(g.map((x) => [x.label, x.items.length]).slice(0, 2), [["Today", 2], ["Yesterday", 1]]);
assert.equal(g.length, 3);
// daily tip: first unused + unsent feature; null when nothing is left to teach
assert.equal(n.pickTip(new Set(), new Set())?.id, n.TIPS[0].id);
assert.equal(n.pickTip(new Set([n.TIPS[0].event]), new Set())?.id, n.TIPS[1].id);
assert.equal(n.pickTip(new Set(), new Set([n.TIPS[0].id]))?.id, n.TIPS[1].id);
assert.equal(n.pickTip(new Set(n.TIPS.map((t) => t.event)), new Set()), null);
console.log("notifications selftest ok");
