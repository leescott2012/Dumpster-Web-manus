// Pure taste-profile merge logic (no browser imports) so it can be tested in node.
const TASTE_MAX = 2000; // keep equal to TASTE_PROFILE_MAX in captionPool.ts

const IG_BLOCK = /(?:^|\n)--- From Instagram @[^\n]* ---\n[\s\S]*?\n--- end ---(?:\n|$)/;

/** The user's own text with any earlier Instagram block removed. */
export function stripIgBlock(text: string): string {
  return text.replace(IG_BLOCK, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function cutClean(text: string, max: number): string {
  if (text.length <= max) return text.trim();
  const head = text.slice(0, Math.max(0, max - 1));
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentence > max * 0.5) return head.slice(0, sentence + 1);
  return head.replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "") + ".";
}

/**
 * Put scrub output into a taste profile.
 *  - With a handle: the scan lives in ONE labeled block ("--- From Instagram @handle ---"). A rebuild replaces
 *    that block only; the user's own text is never touched and repeat builds never pile up. If the user's text
 *    leaves too little room, the profile is returned unchanged (caller shows "profile is full").
 *  - Without a handle (legacy): append, trimming the tail.
 */
export function mergeTaste(existing: string, scrubbed: string, handle?: string): string {
  if (!handle) {
    const base = existing.trim();
    return (base ? base + "\n\n" + scrubbed : scrubbed).slice(0, TASTE_MAX);
  }
  const base = stripIgBlock(existing);
  const head = "--- From Instagram @" + handle + " ---\n";
  const tail = "\n--- end ---";
  const room = TASTE_MAX - base.length - (base ? 2 : 0) - head.length - tail.length;
  if (room < 120) return base;
  return (base ? base + "\n\n" : "") + head + cutClean(scrubbed, room) + tail;
}

