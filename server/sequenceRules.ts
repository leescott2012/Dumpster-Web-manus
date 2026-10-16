/**
 * Cheap post-checks for AI Suggest output against the user's variety rules.
 * Category labels are the only "similarity" signal we already have per photo.
 */

/** No more than this many same-category photos in a row (owner's AI Rules). */
export var MAX_SAME_RUN = 2;

/** Length of the longest run of equal adjacent values. */
export function longestRun(cats: string[]): number {
  var best = 0, cur = 0;
  for (var i = 0; i < cats.length; i++) {
    cur = i > 0 && cats[i] === cats[i - 1] ? cur + 1 : 1;
    if (cur > best) best = cur;
  }
  return best;
}

/**
 * Rules text asks for variety? ponytail: keyword heuristic — only gates the
 * post-check so users whose rules don't ask for a mix get untouched output.
 */
export function wantsVariety(rules: string): boolean {
  return /variet|mix\b|mix of|in a row|similar|repeat|divers|back[- ]to[- ]back|same (shot|pose|angle)/i.test(rules);
}

/**
 * Deterministic reorder that breaks up runs longer than maxRun while keeping
 * the selection, the cover (first item), and the original order as much as
 * possible. Greedy: take the earliest remaining item that doesn't extend a run
 * past maxRun; if none can, take the earliest (run is unbreakable).
 */
export function breakUpRuns<T>(items: T[], catOf: (t: T) => string, maxRun: number): T[] {
  var rest = items.slice();
  var out: T[] = [];
  while (rest.length) {
    var pick = 0;
    for (var i = 0; i < rest.length; i++) {
      var c = catOf(rest[i]);
      var run = 0;
      for (var j = out.length - 1; j >= 0 && catOf(out[j]) === c; j--) run++;
      if (run < maxRun) { pick = i; break; }
    }
    out.push(rest.splice(pick, 1)[0]);
  }
  return out;
}

/**
 * Pull the user's STRICT RULES lines out of the client-built taste block
 * (see client/src/lib/captionPool.ts buildTasteBlock) so the key ones can be
 * restated right before the output schema.
 */
export function extractRuleLines(tasteBlock: string, max: number): string[] {
  var m = /STRICT RULES \(must follow\):\n([\s\S]*?)(?:\n\n|$)/.exec(tasteBlock);
  if (!m) return [];
  return m[1].split("\n")
    .map(function(l) { return l.replace(/^\s*[-*•\d.)]+\s*/, "").trim(); })
    .filter(Boolean)
    .slice(0, max);
}
