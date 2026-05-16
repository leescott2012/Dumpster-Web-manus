/**
 * AI Caption — server-side handler
 * Generates 3 Instagram caption options + vibe descriptor for a dump.
 * Ported from iOS LLMService.generateCaption (CaptionService.swift).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage, ServerResponse } from "http";

export interface CaptionRequest {
  dumpTitle: string;
  subtitle: string;
  category?: string;
  tone?: "default" | "minimal" | "witty" | "poetic";
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
  const tasteBlock = payload.tasteBlock ? `\n\nUser's caption style examples:\n${payload.tasteBlock}\nMatch this voice and energy.` : "";

  const system = `You are an Instagram caption writer for photo dumps (carousels). Write 3 aesthetic captions for the dump. ${toneHint} Keep them short, scroll-stopping, and authentic. No clichés like "vibes only" unless ironic. Avoid hashtags unless they're a punchline.${tasteBlock}\n\nRespond ONLY with valid JSON, no markdown, no code fences:\n{"captions":["...","...","..."],"vibe":"one or two word vibe descriptor"}`;

  const userMsg = `Dump title: "${payload.dumpTitle}"\nSubtitle / theme: "${payload.subtitle}"${payload.category ? `\nDominant category: ${payload.category}` : ""}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: userMsg }],
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Claude API error: " + msg }));
  }
}
