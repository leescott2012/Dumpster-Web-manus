// Run: npx tsx server/bestTimes.check.ts
import assert from "node:assert";
import { bestTimesLine } from "./bestTimes.js";

const mk = (iso: string, s: number) => ({ postedAt: iso, engagementScore: s });
// 6 weak posts Mon 09:xx, 4 strong posts Fri 18:xx
const posts = [
  ...Array.from({ length: 6 }, (_, i) => mk(`2026-03-0${2 + i * 0}T09:1${i}:00.000Z`, 10)), // 2026-03-02 is a Monday
  ...Array.from({ length: 4 }, (_, i) => mk(`2026-03-0${6}T18:2${i}:00.000Z`, 500)),          // 2026-03-06 is a Friday
];
const line = bestTimesLine(posts);
assert.match(line, /Fridays/);
assert.match(line, /18:00-21:00 UTC/);
assert.equal(bestTimesLine(posts.slice(0, 7)), "", "under 8 posts -> skipped");
assert.equal(bestTimesLine([...posts.slice(0, 7), mk("", 1)]), "", "unparseable dates don't count");
console.log("bestTimes ok:", line);
