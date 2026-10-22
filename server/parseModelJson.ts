/**
 * Parse JSON from model text. Models sometimes wrap JSON in ``` fences, add
 * prose, or "self-correct" with a second block (seen in prod: ai-caption 502).
 * Tries the whole text first, then the first balanced {...} that parses.
 */
export function parseModelJson(raw: string): any {
  const t = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(t); } catch { /* fall through to scan */ }
  for (let s = t.indexOf("{"); s !== -1; s = t.indexOf("{", s + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = s; i < t.length; i++) {
      const c = t[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try { return JSON.parse(t.slice(s, i + 1)); } catch { break; }
      }
    }
  }
  throw new Error("no valid JSON in model output");
}
