// Run: npx tsx server/carouselVision.check.ts
import assert from "node:assert";
import { pickCarousels, pickSlideIndexes, parseVision, formulaLine, composePlaybook, VISION_PROMPT } from "./carouselVision.js";

const u = (n: number) => Array.from({ length: n }, (_, i) => `https://scontent.cdninstagram.com/v/${i}.jpg`);
const posts = [
  { slideUrls: u(18), engagementScore: 50 }, { slideUrls: u(2), engagementScore: 999 },
  { slideUrls: [], engagementScore: 500 }, { slideUrls: u(5), engagementScore: 70 },
  { slideUrls: ["https://evil.example/a.jpg", "https://evil.example/b.jpg", "https://evil.example/c.jpg"], engagementScore: 900 },
  { slideUrls: u(9), engagementScore: 10 },
];
const top = pickCarousels(posts);
assert.deepEqual(top.map((p) => p.engagementScore), [70, 50], "top 2 carousels; singles, <3 slides, non-CDN skipped");

const idx = pickSlideIndexes(18);
assert.equal(idx.length, 6); assert.equal(idx[0], 0); assert.equal(idx.at(-1), 17);
assert.deepEqual(pickSlideIndexes(4), [0, 1, 2, 3]);

assert.equal(parseVision("nope"), null);
assert.equal(parseVision('{"formula":""}'), null);
const r = parseVision('```json\n{"carousels":[],"hooks":"h","formula":"Open with a person in a luxury store; rotate food/scenery/interiors in threes; end on a car."}\n```');
assert.ok(r);
const line = formulaLine(r);
assert.match(line, /^Carousel formula: Open with/);
assert.ok(formulaLine({ ...r!, formula: "word ".repeat(200) }).length <= 300);
assert.equal(formulaLine(null), "");

const times = "Best times: Fridays 18:00-21:00 UTC.";
const out = composePlaybook("x".repeat(700), line, times);
assert.ok(out.length <= 750 && out.includes(line) && out.endsWith(times), "formula + times kept whole, base trimmed");
assert.equal(composePlaybook("base", "", ""), "base");
assert.equal(composePlaybook("base", "", times), "base " + times);
assert.ok(VISION_PROMPT.includes("hook") && VISION_PROMPT.includes("ender"));
console.log("carouselVision ok:", line);
