/**
 * AI Caption — server-side handler
 * Generates 3 Instagram caption options for a dump using Claude Vision.
 * The AI actually sees the photos (not just metadata) and takes a free-form
 * user prompt plus optional title/category/tone overrides.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage, ServerResponse } from "http";
import { fetchImageAsBase64 } from "./imageBase64.js";
import { captureServerError } from "./sentry.js";

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

// ── Gemini caption generator (uses REST API — no extra SDK needed) ─────────────

async function generateWithGemini(payload: CaptionRequest, apiKey: string): Promise<CaptionResult> {
  const photos = Array.isArray(payload.photos) ? payload.photos.slice(0, MAX_PHOTOS) : [];
  const tone = payload.tone ?? "default";
  const toneHint = TONE_HINTS[tone];
  const tasteBlock = payload.tasteBlock
    ? `\n\nUser caption style examples (match this voice):\n${payload.tasteBlock}`
    : "";

  const metaLines = [`Dump title: "${payload.dumpTitle}"`];
  if (payload.subtitle) metaLines.push(`Theme: "${payload.subtitle}"`);
  if (payload.category) metaLines.push(`Category: ${payload.category}`);
  const exifSummary = summarizeBatchMeta(photos);
  if (exifSummary) metaLines.push(exifSummary);

  const systemText = `You are an Instagram caption writer for photo dumps (carousels). Write 3 aesthetic captions. ${toneHint} Let the actual visual content guide the captions. Keep them short and scroll-stopping. No clichés. No hashtags unless ironic.${tasteBlock}\n\nRespond ONLY with valid JSON, no markdown: {"captions":["...","...","..."],"vibe":"one or two word descriptor"}`;

  const parts: unknown[] = [
    { text: systemText + "\n\n" + metaLines.join("\n") },
  ];

  if (photos.length > 0) {
    const fetched = await Promise.all(photos.map((p) => fetchImageAsBase64(p.url)));
    parts.push({ text: `Here are the ${photos.length} photo(s):` });
    for (const img of fetched) {
      if (img) parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
    }
  }

  if (payload.userPrompt?.trim()) {
    parts.push({ text: `User instructions: ${payload.userPrompt.trim()}\n\nWrite 3 captions now. Return JSON only.` });
  } else {
    parts.push({ text: "Write 3 captions now. Return JSON only." });
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.9 },
      }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Gemini ${resp.status}: ${errBody}`);
  }

  const data = await resp.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let parsed: { captions?: string[]; vibe?: string };
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error("Gemini returned invalid JSON: " + rawText.slice(0, 200)); }

  return {
    dumpTitle: payload.dumpTitle,
    captions: Array.isArray(parsed.captions) ? parsed.captions.slice(0, 3) : [],
    vibe: typeof parsed.vibe === "string" ? parsed.vibe : "curated",
  };
}

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
): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleKey    = process.env.GOOGLE_API_KEY;

  if ((!anthropicKey || anthropicKey === "your_anthropic_api_key_here") && !googleKey) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No AI API key configured (ANTHROPIC_API_KEY or GOOGLE_API_KEY)." }));
    return;
  }

  let payload: CaptionRequest;
  try {
    const body = await readBody(req);
    payload = JSON.parse(body) as CaptionRequest;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  if (!payload.dumpTitle) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "dumpTitle is required" }));
    return;
  }

  // ── Try Gemini first if GOOGLE_API_KEY is configured ──────────────────────
  if (googleKey) {
    try {
      const result = await generateWithGemini(payload, googleKey);
      if (result.captions.length > 0) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }
    } catch (geminiErr) {
      console.warn("[AI Caption] Gemini failed, falling back to Anthropic:", geminiErr);
    }
  }

  if (!anthropicKey || anthropicKey === "your_anthropic_api_key_here") {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Gemini unavailable and ANTHROPIC_API_KEY not configured." }));
    return;
  }

  // ── Anthropic fallback ────────────────────────────────────────────────────
  const tone = payload.tone ?? "default";
  const toneHint = TONE_HINTS[tone];
  const tasteBlock = payload.tasteBlock
    ? `\n\nUser's caption style examples (match this voice and energy):\n${payload.tasteBlock}`
    : "";

  const system = `You are an Instagram caption writer for photo dumps (carousels). Write 3 aesthetic captions for the dump. ${toneHint} Look at the photos — let the actual visual content guide the captions. Keep them short, scroll-stopping, and authentic. No clichés like "vibes only" unless ironic. Avoid hashtags unless they're a punchline.${tasteBlock}

Respond ONLY with valid JSON, no markdown, no code fences:
{"captions":["...","...","..."],"vibe":"one or two word vibe descriptor"}`;

  const photos = Array.isArray(payload.photos) ? payload.photos.slice(0, MAX_PHOTOS) : [];

  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
    | { type: "text"; text: string };

  const content: ContentBlock[] = [];

  const metaLines: string[] = [`Dump title: "${payload.dumpTitle}"`];
  if (payload.subtitle) metaLines.push(`Theme / subtitle: "${payload.subtitle}"`);
  if (payload.category) metaLines.push(`Category: ${payload.category}`);
  const exifSummary = summarizeBatchMeta(photos);
  if (exifSummary) metaLines.push(exifSummary);
  content.push({ type: "text", text: metaLines.join("\n") });

  if (photos.length > 0) {
    const fetched = await Promise.all(photos.map((p) => fetchImageAsBase64(p.url)));
    content.push({ type: "text", text: `Here are the ${photos.length} photo${photos.length === 1 ? "" : "s"} in the carousel:` });
    for (let i = 0; i < photos.length; i++) {
      const img = fetched[i];
      if (img) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
    }
  }

  if (payload.userPrompt?.trim()) {
    content.push({ type: "text", text: `\nUser instructions (follow these carefully):\n${payload.userPrompt.trim()}` });
  }
  content.push({ type: "text", text: `\nWrite 3 caption options now. Return JSON only.` });

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system,
      messages: [{ role: "user", content }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let parsed: { captions?: string[]; vibe?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Claude returned invalid JSON", raw: rawText }));
      return;
    }

    const result: CaptionResult = {
      dumpTitle: payload.dumpTitle,
      captions: Array.isArray(parsed.captions) ? parsed.captions.slice(0, 3) : [],
      vibe: typeof parsed.vibe === "string" ? parsed.vibe : "curated",
    };

    if (result.captions.length === 0) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No captions returned", raw: rawText }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err: unknown) {
    console.error("[AI Caption] Anthropic error:", err);
    captureServerError(err, "ai-caption", {
      photoCount: photos.length,
      hasUserPrompt: !!payload.userPrompt,
      tone: tone,
    });
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Claude API error: " + msg }));
  }
}
