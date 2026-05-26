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
): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured." }));
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

  const tone = payload.tone ?? "default";
  const toneHint = TONE_HINTS[tone];
  const tasteBlock = payload.tasteBlock
    ? `\n\nUser's caption style examples (match this voice and energy):\n${payload.tasteBlock}`
    : "";

  const system = `You are an Instagram caption writer for photo dumps (carousels). Write 3 aesthetic captions for the dump. ${toneHint} Look at the photos — let the actual visual content guide the captions. Keep them short, scroll-stopping, and authentic. No clichés like "vibes only" unless ironic. Avoid hashtags unless they're a punchline.${tasteBlock}

Respond ONLY with valid JSON, no markdown, no code fences:
{"captions":["...","...","..."],"vibe":"one or two word vibe descriptor"}`;

  // Build multi-modal content: photos + text context + user prompt
  const photos = Array.isArray(payload.photos) ? payload.photos.slice(0, MAX_PHOTOS) : [];

  type ContentBlock =
    | {
        type: "image";
        source: {
          type: "base64";
          media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          data: string;
        };
      }
    | { type: "text"; text: string };

  const content: ContentBlock[] = [];

  // Lead text: dump metadata
  const metaLines: string[] = [`Dump title: "${payload.dumpTitle}"`];
  if (payload.subtitle) metaLines.push(`Theme / subtitle: "${payload.subtitle}"`);
  if (payload.category) metaLines.push(`Category: ${payload.category}`);
  content.push({ type: "text", text: metaLines.join("\n") });

  // Photos
  if (photos.length > 0) {
    const fetched = await Promise.all(photos.map((p) => fetchImageAsBase64(p.url)));
    content.push({
      type: "text",
      text: `Here are the ${photos.length} photo${photos.length === 1 ? "" : "s"} in the carousel:`,
    });
    for (let i = 0; i < photos.length; i++) {
      const img = fetched[i];
      if (img) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.base64 },
        });
      }
    }
  }

  // User's specific instruction — final, highest-weight signal
  if (payload.userPrompt && payload.userPrompt.trim()) {
    content.push({
      type: "text",
      text: `\nUser instructions (follow these carefully):\n${payload.userPrompt.trim()}`,
    });
  }

  content.push({
    type: "text",
    text: `\nWrite 3 caption options now. Return JSON only.`,
  });

  try {
    const anthropic = new Anthropic({ apiKey });
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
