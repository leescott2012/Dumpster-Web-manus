/**
 * AI Caption — server-side handler
 * Generates 3 Instagram caption options for a dump using Claude Vision.
 * The AI actually sees the photos (not just metadata) and takes a free-form
 * user prompt plus optional title/category/tone overrides.
 */

import { llmComplete, llmConfigured, type LlmPart } from "./llm.js";
import { userAnthropicKey } from "./userKey.js";
import type { IncomingMessage, ServerResponse } from "http";
import { fetchImageAsBase64 } from "./imageBase64.js";
import { parseModelJson } from "./parseModelJson.js";
import { publicAIError } from "./sentry.js";

export interface CaptionPhotoInput {
  id: string;
  url: string;
  alt?: string;
  category?: string;
  /** EXIF metadata captured at upload — see client/src/lib/exif.ts */
  meta?: {
    takenAt?: number;
    lat?: number;
    lng?: number;
    camera?: string;
  };
}

/**
 * Summarize the date range + first location across a photo batch so the
 * AI can write captions that reference time of day, season, place.
 * Returns "" when no metadata is present in the batch.
 */
function summarizeBatchMeta(photos: CaptionPhotoInput[]): string {
  const dates = photos.map((p) => p.meta?.takenAt).filter((t): t is number => typeof t === "number");
  const firstGps = photos.find((p) => typeof p.meta?.lat === "number" && typeof p.meta?.lng === "number")?.meta;
  const cameras = Array.from(new Set(photos.map((p) => p.meta?.camera).filter(Boolean)));
  const out: string[] = [];
  if (dates.length > 0) {
    const min = new Date(Math.min.apply(null, dates));
    const max = new Date(Math.max.apply(null, dates));
    const fmt = (d: Date) =>
      d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
    out.push(min.getTime() === max.getTime() ? "Taken: " + fmt(min) : "Date range: " + fmt(min) + " → " + fmt(max));
  }
  if (firstGps && typeof firstGps.lat === "number" && typeof firstGps.lng === "number") {
    out.push("Location: " + firstGps.lat.toFixed(3) + ", " + firstGps.lng.toFixed(3) + " (rough)");
  }
  if (cameras.length === 1) out.push("Shot on: " + cameras[0]);
  return out.join("\n");
}

export interface CaptionRequest {
  /** Photos in the dump — sent to Claude Vision */
  photos?: CaptionPhotoInput[];
  /** Free-form user prompt: mood, story, joke, anything */
  userPrompt?: string;
  /** Dump title (user-editable override) */
  dumpTitle: string;
  /** Subtitle / theme (auto-derived, optional) */
  subtitle?: string;
  /** Category (user-editable override) */
  category?: string;
  tone?: "default" | "minimal" | "witty" | "poetic";
  /** Caption-style examples accumulated from prior chats */
  tasteBlock?: string;
}

export interface CaptionResult {
  dumpTitle: string;
  captions: string[];
  vibe: string;
}

const TONE_HINTS: Record<NonNullable<CaptionRequest["tone"]>, string> = {
  default: "Write aesthetic, on-brand Instagram captions.",
  minimal: "Write extremely short, minimal captions. One line max.",
  witty:   "Write clever, witty captions with wordplay.",
  poetic:  "Write poetic, evocative captions with imagery.",
};

const MAX_PHOTOS = 12; // cap for cost/speed — captions don't need all 20

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function handleAICaption(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return false;
  }

  const byoKey = userAnthropicKey(req);
  const apiKey = byoKey || process.env.ANTHROPIC_API_KEY;
  if (!llmConfigured(apiKey)) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured." }));
    return false;
  }

  let payload: CaptionRequest;
  try {
    const body = await readBody(req);
    payload = JSON.parse(body) as CaptionRequest;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return false;
  }

  if (!payload.dumpTitle) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "dumpTitle is required" }));
    return false;
  }

  const tone = payload.tone ?? "default";
  const toneHint = TONE_HINTS[tone];
  // Capped (6000 chars) so a huge profile can't inflate cost
  const tasteBlock = typeof payload.tasteBlock === "string" && payload.tasteBlock
    ? `\n\nUser's caption style examples (match this voice and energy):\n${payload.tasteBlock.slice(0, 6000)}`
    : "";

  const system = `You are an Instagram caption writer for photo dumps (carousels). Write 3 aesthetic captions for the dump. ${toneHint} Look at the photos — let the actual visual content guide the captions. Keep them short, scroll-stopping, and authentic. No clichés like "vibes only" unless ironic. Avoid hashtags unless they're a punchline.${tasteBlock}

Respond ONLY with valid JSON, no markdown, no code fences:
{"captions":["...","...","..."],"vibe":"one or two word vibe descriptor"}`;

  // Build multi-modal content: photos + text context + user prompt
  const photos = Array.isArray(payload.photos) ? payload.photos.slice(0, MAX_PHOTOS) : [];

  const content: LlmPart[] = [];

  // Lead text: dump metadata
  const metaLines: string[] = [`Dump title: "${payload.dumpTitle}"`];
  if (payload.subtitle) metaLines.push(`Theme / subtitle: "${payload.subtitle}"`);
  if (payload.category) metaLines.push(`Category: ${payload.category}`);
  const exifSummary = summarizeBatchMeta(photos);
  if (exifSummary) metaLines.push(exifSummary);
  content.push({ text: metaLines.join("\n") });

  // Photos
  if (photos.length > 0) {
    const fetched = await Promise.all(photos.map((p) => fetchImageAsBase64(p.url)));
    if (fetched.every((img) => !img)) {
      // Photos were sent but none loaded — fail (and refund) rather than
      // charging for captions written blind.
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Could not load any images", code: "no_images" }));
      return false;
    }
    content.push({
      text: `Here are the ${photos.length} photo${photos.length === 1 ? "" : "s"} in the carousel:`,
    });
    for (let i = 0; i < photos.length; i++) {
      const img = fetched[i];
      if (img) {
        content.push({ image: { mediaType: img.mediaType, base64: img.base64 } });
      }
    }
  }

  // User's specific instruction — final, highest-weight signal
  if (payload.userPrompt && payload.userPrompt.trim()) {
    content.push({
      text: `\nUser instructions (follow these carefully):\n${payload.userPrompt.trim()}`,
    });
  }

  content.push({
    text: `\nWrite 3 caption options now. Return JSON only.`,
  });

  try {
    // 18s total across Claude + fallbacks, no retries: image fetch (≤8s) + this
    // must finish inside the 30s maxDuration, or Vercel kills the function
    // before the refund runs.
    const rawText = await llmComplete({
      claudeKey: apiKey, byo: !!byoKey, claudeModel: "claude-haiku-4-5",
      maxTokens: 700, system, messages: [{ role: "user", content }], totalMs: 18000,
    });
    let parsed: { captions?: unknown; vibe?: unknown };
    try {
      parsed = parseModelJson(rawText);
    } catch {
      // Log raw model text server-side only — never echo it to the client.
      console.error("[AI Caption] invalid JSON from model:", rawText.slice(0, 500));
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "AI couldn't write captions. Try again.", code: "ai_invalid_output" }));
      return false;
    }

    const captions = (Array.isArray(parsed.captions) ? parsed.captions : [])
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .slice(0, 3)
      .map((c) => c.trim().slice(0, 500));
    const result: CaptionResult = {
      dumpTitle: payload.dumpTitle,
      captions: captions,
      vibe: typeof parsed.vibe === "string" ? parsed.vibe.slice(0, 40) : "curated",
    };

    if (result.captions.length === 0) {
      console.error("[AI Caption] no captions in model output:", rawText.slice(0, 500));
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "AI couldn't write captions. Try again.", code: "ai_empty_result" }));
      return false;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return true;
  } catch (err: unknown) {
    const safe = publicAIError(err, "ai-caption", {
      photoCount: photos.length,
      hasUserPrompt: !!payload.userPrompt,
      tone: tone,
    });
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: safe, code: "ai_error" }));
    return false;
  }
}
