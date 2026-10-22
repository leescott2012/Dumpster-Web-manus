/**
 * AI Suggest — server-side handler
 * Accepts pool photos, sends them to Claude Haiku vision, returns cluster groups.
 * Used as a Vite dev middleware AND as an Express route in production.
 */

import { llmComplete, llmConfigured, type LlmPart } from "./llm.js";
import { userAnthropicKey } from "./userKey.js";
import type { IncomingMessage, ServerResponse } from "http";
import { fetchImageAsBase64 } from "./imageBase64.js";
import { publicAIError } from "./sentry.js";
import { recordCost } from "./dailyBudget.js";
import { parseModelJson } from "./parseModelJson.js";
import { MAX_SAME_RUN, longestRun, breakUpRuns, wantsVariety, extractRuleLines } from "./sequenceRules.js";

export interface PhotoInput {
  id: string;
  url: string;
  alt: string;
  category: string;
  /** EXIF metadata captured at upload (see client/src/lib/exif.ts). */
  meta?: {
    takenAt?: number;
    lat?: number;
    lng?: number;
    camera?: string;
  };
}

/**
 * Compact a meta object into a prompt-friendly line:
 *   "taken 2024-09-12 14:32 · iPhone 14 Pro · 37.78,-122.41"
 * Returns "" if nothing useful is present.
 */
function metaLine(m?: PhotoInput["meta"]): string {
  if (!m) return "";
  const parts: string[] = [];
  if (m.takenAt) {
    const d = new Date(m.takenAt);
    parts.push(
      "taken " +
      d.getUTCFullYear() + "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(d.getUTCDate()).padStart(2, "0") + " " +
      String(d.getUTCHours()).padStart(2, "0") + ":" +
      String(d.getUTCMinutes()).padStart(2, "0")
    );
  }
  if (m.camera) parts.push(m.camera);
  if (typeof m.lat === "number" && typeof m.lng === "number") {
    parts.push(m.lat.toFixed(3) + "," + m.lng.toFixed(3));
  }
  return parts.length ? "  [" + parts.join(" · ") + "]" : "";
}

// Optional seed passed by client so re-runs pick different groupings
// (we just include it in the prompt so the model varies its selection)

export interface Cluster {
  name: string;
  subtitle: string;
  photoIds: string[];
}

export interface AISuggestResponse {
  clusters: Cluster[];
}

// Collect raw body from an IncomingMessage
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function handleAISuggest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return false;
  }

  const startedAt = Date.now();
  const byoKey = userAnthropicKey(req);
  const apiKey = byoKey || process.env.ANTHROPIC_API_KEY;
  if (!llmConfigured(apiKey)) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY is not configured. Add it to your .env file.",
      })
    );
    return false;
  }

  let photos: PhotoInput[] = [];
  let variation = 0;
  let targetCount: number | null = null;
  let tasteBlock = "";
  let userHint = "";
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body) as { photos?: PhotoInput[]; variation?: number; targetCount?: number | null; tasteBlock?: string; userHint?: string };
    photos = parsed.photos || [];
    variation = parsed.variation || 0;
    // Cap the taste block (profile 2000 + rules 1500 + style + captions) so cost stays bounded
    tasteBlock = typeof parsed.tasteBlock === "string" ? parsed.tasteBlock.slice(0, 6000) : "";
    // Cap freeform input so a malicious / runaway prompt can't blow up the request
    userHint = (parsed.userHint || "").slice(0, 500);
    if (typeof parsed.targetCount === "number" && parsed.targetCount >= 2 && parsed.targetCount <= 20) {
      targetCount = parsed.targetCount;
    }
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return false;
  }

  // Cap at 20 photos for cost/speed. The client sends a rotating 20-photo
  // window (client/src/lib/photoWindow.ts) and tells the user "AI sees N of M".
  const capped = photos.slice(0, 20);
  if (capped.length < 2) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Need at least 2 photos to generate suggestions" })
    );
    return false;
  }

  // Fetch images in parallel
  const fetched = await Promise.all(
    capped.map((p) => fetchImageAsBase64(p.url))
  );
  if (fetched.every((img) => !img)) {
    // Nothing for the vision model to look at — fail (and refund) instead of
    // paying for a text-only guess.
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Could not load any images", code: "no_images" }));
    return false;
  }

  // Build the message content: one image block per photo + caption
  const content: LlmPart[] = [];

  const variationHint = variation > 0
    ? ` This is attempt #${variation + 1} — pick a DIFFERENT theme or photo selection than you would have chosen before.`
    : "";

  // Rules go BEFORE photos (frames the analysis) in a clearly delimited
  // REQUIRED block, and the key ones are restated right before the schema —
  // a no-style live run ignored "variety" rules sitting only at the top.
  const tastePrefix = tasteBlock
    ? `=== REQUIRED: USER RULES (apply to photo selection, ORDER, carousel name and subtitle; they override your own taste) ===\n${tasteBlock}\n=== END REQUIRED ===\n\n`
    : "";
  const checkVariety = wantsVariety(tasteBlock);
  const keyRules = extractRuleLines(tasteBlock, 3);
  if (checkVariety) keyRules.push(`No more than ${MAX_SAME_RUN} photos of the same category/subject in a row — mix shot types, angles and poses.`);
  const restate = tasteBlock
    ? `\n\nREQUIRED — re-read before answering:\n${keyRules.length ? keyRules.map((r) => "- " + r).join("\n") + "\n" : ""}- Every rule in the REQUIRED block above.\nBefore you answer, silently check your chosen photos and their order against each REQUIRED rule. If any rule is broken, change the selection or order until none are. Then output the JSON.`
    : "";

  content.push({
    text: `You are an expert Instagram content strategist. I'm going to show you ${capped.length} photos. Pick the BEST single Instagram carousel sequence from these photos.${variationHint}\n\n${tastePrefix}Here are the photos (numbered for reference):`,
  });

  for (let i = 0; i < capped.length; i++) {
    const img = fetched[i];
    if (img) {
      content.push({ image: { mediaType: img.mediaType, base64: img.base64 } });
    }
    content.push({
      text: `Photo ${i + 1} [${capped[i].category}]: ${capped[i].alt}${metaLine(capped[i].meta)}`,
    });
  }

  const countInstruction = targetCount
    ? `Select EXACTLY ${targetCount} photos that form the strongest possible Instagram carousel together.`
    : `Select 2–20 photos that form the strongest single Instagram carousel. Choose a number that feels natural for the theme — quality over quantity, don't pad.`;

  // Append user's freeform "anything else?" note as the highest-weight signal.
  // It's already capped at 500 chars on the way in.
  const userHintBlock = userHint.trim()
    ? `\n\nUser instructions (follow these carefully): ${userHint.trim()}`
    : "";

  content.push({
    text: `From these ${capped.length} photos: ${countInstruction} Give the carousel a punchy name (3–5 words) and a subtitle describing the vibe (under 10 words).${userHintBlock}${restate}

Respond ONLY with valid JSON — no markdown, no explanation, no code fences:
{"clusters":[{"name":"Name Here","subtitle":"Vibe here","photoIndices":[2,5,7,11]}]}`,
  });

  // Parse + validate model text: 1-based integer indices in range, no
  // duplicates, at most targetCount; drop clusters with fewer than 2 photos.
  // Returns null if the text isn't JSON.
  const parseClusters = (rawText: string): Cluster[] | null => {
    let parsed: { clusters?: unknown };
    try {
      parsed = parseModelJson(rawText);
    } catch {
      return null;
    }
    const rawClusters: any[] = Array.isArray(parsed.clusters) ? parsed.clusters : [];
    const out: Cluster[] = [];
    for (const c of rawClusters) {
      if (!c || typeof c !== "object") continue;
      const ids: string[] = [];
      for (const idx of Array.isArray(c.photoIndices) ? c.photoIndices : []) {
        if (!Number.isInteger(idx) || idx < 1 || idx > capped.length) continue;
        const id = capped[idx - 1].id;
        if (ids.indexOf(id) === -1) ids.push(id);
      }
      const photoIds = targetCount ? ids.slice(0, targetCount) : ids;
      if (photoIds.length < 2) continue;
      out.push({
        name: typeof c.name === "string" && c.name.trim() ? c.name.trim().slice(0, 80) : "Untitled dump",
        subtitle: typeof c.subtitle === "string" ? c.subtitle.trim().slice(0, 120) : "",
        photoIds: photoIds,
      });
    }
    return out;
  };

  const catById: Record<string, string> = {};
  for (const p of capped) catById[p.id] = (p.category || "").toLowerCase();
  const catOf = (id: string) => catById[id] || "";
  const runTooLong = (c: Cluster) => longestRun(c.photoIds.map(catOf)) > MAX_SAME_RUN;
  // Only enforce when the pool could actually be mixed.
  const poolHasVariety = new Set(capped.map((p) => catOf(p.id))).size > 1;

  try {
    // 40s total across Claude + fallbacks, no retries: image fetch (≤8s) + this
    // must finish inside the 60s maxDuration, or Vercel kills the function
    // before the refund runs.
    const rawText = await llmComplete({
      claudeKey: apiKey, byo: !!byoKey, claudeModel: "claude-haiku-4-5",
      maxTokens: 1024, messages: [{ role: "user", content }], totalMs: 40000,
    });

    const parsedClusters = parseClusters(rawText);
    if (parsedClusters === null) {
      // Log the raw text server-side only — never echo model output to the client.
      console.error("[AI Suggest] invalid JSON from model:", rawText.slice(0, 500));
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "AI couldn't build a sequence. Try again.", code: "ai_invalid_output" }));
      return false;
    }
    let clusters: Cluster[] = parsedClusters;

    if (clusters.length === 0) {
      console.error("[AI Suggest] no usable cluster in model output:", rawText.slice(0, 500));
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "AI couldn't build a sequence. Try again.", code: "ai_empty_result" }));
      return false;
    }

    // Variety post-check (only when the user's rules ask for it). One free
    // re-ask (user isn't charged again; the $ still counts against the daily
    // budget), then a deterministic reorder if the run is still too long.
    // The first valid result is always kept as the fallback.
    if (checkVariety && poolHasVariety && runTooLong(clusters[0])) {
      // Leave ≥8s headroom under maxDuration (60s) so a slow re-ask can't get
      // the function killed after the user was already charged.
      const budgetMs = 52000 - (Date.now() - startedAt);
      if (budgetMs > 10000) {
        try {
          recordCost("ai_suggest").catch(() => {});
          const order = clusters[0].photoIds
            .map((id) => (capped.findIndex((p) => p.id === id) + 1) + " [" + catOf(id) + "]")
            .join(", ");
          const retryText = await llmComplete({
            claudeKey: apiKey, byo: !!byoKey, claudeModel: "claude-haiku-4-5",
            maxTokens: 1024, totalMs: budgetMs,
            messages: [
              { role: "user", content },
              { role: "assistant", content: rawText },
              {
                role: "user",
                content: `Your sequence (${order}) has more than ${MAX_SAME_RUN} photos of the same category in a row, which breaks the REQUIRED rules. Pick again: mix shot types and poses, and never put more than ${MAX_SAME_RUN} same-category photos back to back. Same JSON format only.`,
              },
            ],
          });
          const retryClusters = parseClusters(retryText);
          if (retryClusters && retryClusters.length > 0) clusters = retryClusters;
        } catch (e) {
          console.warn("[AI Suggest] variety re-ask failed, keeping first result:", e);
        }
      }
      if (runTooLong(clusters[0])) {
        clusters[0] = { ...clusters[0], photoIds: breakUpRuns(clusters[0].photoIds, catOf, MAX_SAME_RUN) };
      }
    }

    const response: AISuggestResponse = { clusters };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
    return true;
  } catch (err: unknown) {
    const safe = publicAIError(err, "ai-suggest", { photoCount: capped.length });
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: safe, code: "ai_error" }));
    return false;
  }
}
