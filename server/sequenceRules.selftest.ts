// Run: npx tsx server/sequenceRules.selftest.ts
import assert from "node:assert/strict";
import { longestRun, breakUpRuns, wantsVariety, extractRuleLines, MAX_SAME_RUN } from "./sequenceRules";

var id = function(s: string) { return s; };

assert.equal(longestRun([]), 0);
assert.equal(longestRun(["A"]), 1);
assert.equal(longestRun(["A", "A", "B", "A", "A", "A"]), 3);

// The live-test case: 6 cars in a row with other categories available.
var seq = ["CAR", "CAR", "CAR", "CAR", "CAR", "CAR", "FOOD", "CITY", "PORTRAIT"];
var fixed = breakUpRuns(seq, id, MAX_SAME_RUN);
assert.equal(longestRun(fixed), 2);
assert.equal(fixed[0], "CAR"); // cover kept
assert.deepEqual(fixed.slice().sort(), seq.slice().sort()); // same selection
assert.deepEqual(fixed, ["CAR", "CAR", "FOOD", "CAR", "CAR", "CITY", "CAR", "CAR", "PORTRAIT"]);

// Already compliant → unchanged.
var ok = ["A", "B", "A", "A", "C"];
assert.deepEqual(breakUpRuns(ok, id, 2), ok);

// Unbreakable (all one category) → unchanged, no crash.
assert.deepEqual(breakUpRuns(["A", "A", "A"], id, 2), ["A", "A", "A"]);

assert.equal(wantsVariety("Mix of shots, no more than 2 similar in a row"), true);
assert.equal(wantsVariety("Pose variety please"), true);
assert.equal(wantsVariety("Always start with a selfie"), false);

var block = "User's aesthetic / taste profile:\nmoody\n\nSTRICT RULES (must follow):\n- Mix of shots\n- No more than 2 similar in a row\n- Pose variety\n- Never blurry\n\nACTIVE DUMP STYLE — \"x\"";
assert.deepEqual(extractRuleLines(block, 3), ["Mix of shots", "No more than 2 similar in a row", "Pose variety"]);
assert.deepEqual(extractRuleLines("no rules here", 3), []);
console.log("sequenceRules selftest: ok");
