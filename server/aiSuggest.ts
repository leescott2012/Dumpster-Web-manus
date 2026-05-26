/**
 * AI Suggest — server-side handler
 * Accepts pool photos, sends them to Claude Haiku vision, returns cluster groups.
 * Used as a Vite dev middleware AND as an Express route in production.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage, ServerResponse } from "http";
import { fetchImageAsBase64 } from "./imageBase64.js";
import { captureServerError } from "./sentry.js";

export interface PhotoInput {
  id: string;
  url: string;
  alt: string;
  category: string;
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
): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY is not configured. Add it to your .env file.",
      })
    );
    return;
  }

  let photos: PhotoInput[] = [];
  let variation = 0;
  let targetCount: number | null = null;
  let tasteBlock = "";
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body) as { photos?: PhotoInput[]; variation?: number; targetCount?: number | null; tasteBlock?: string };
    photos = parsed.photos || [];
    variation = parsed.variation || 0;
    tasteBlock = parsed.tasteBlock || "";
    if (typeof parsed.targetCount === "number" && parsed.targetCount >= 2 && parsed.targetCount <= 20) {
      targetCount = parsed.targetCount;
    }
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  // Cap at 20 photos for cost/speed
  const capped = photos.slice(0, 20);
  if (capped.length < 2) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Need at least 2 photos to generate suggestions" })
    );
    return;
  }

  // Fetch images in parallel
  const fetched = await Promise.all(
    capped.map((p) => fetchImageAsBase64(p.url))
  );

  // Build the message content: one image block per photo + caption
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

  const variationHint = variation > 0
    ? ` This is attempt #${variation + 1} — pick a DIFFERENT theme or photo selection than you would have chosen before.`
    : "";

  // Put taste/rules BEFORE photos so they frame the entire analysis
  const tastePrefix = tasteBlock
    ? `MANDATORY USER REQUIREMENTS — these apply to your photo selection, carousel name, and subtitle. Violations are not acceptable:\n${tasteBlock}\n\n`
    : "";

  content.push({
    type: "text",
    text: `You are an expert Instagram content strategist. I'm going to show you ${capped.length} photos. Pick the BEST single Instagram carousel sequence from these photos.${variationHint}\n\n${tastePrefix}Here are the photos (numbered for reference):`,
  });

  for (let i = 0; i < capped.length; i++) {
    const img = fetched[i];
    if (img) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      });
    }
    content.push({
      type: "text",
      text: `Photo ${i + 1} [${capped[i].category}]: ${capped[i].alt}`,
    });
  }

  const countInstruction = targetCount
    ? `Select EXACTLY ${targetCount} photos that form the strongest possible Instagram carousel together.`
    : `Select 2–20 photos that form the strongest single Instagram carousel. Choose a number that feels natural for the theme — quality over quantity, don't pad.`;

  content.push({
    type: "text",
    text: `From these ${capped.length} photos: ${countInstruction} Give the carousel a punchy name (3–5 words) and a subtitle describing the vibe (under 10 words).

Respond ONLY with valid JSON — no markdown, no explanation, no code fences:
{"clusters":[{"name":"Name Here","subtitle":"Vibe here","photoIndices":[2,5,7,11]}]}`,
  });

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown fences if present
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: { clusters: { name: string; subtitle: string; photoIndices: number[] }[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Claude returned invalid JSON", raw: rawText })
      );
      return;
    }

    // Map photoIndices → photoIds
    const clusters: Cluster[] = (parsed.clusters || []).map((c) => ({
      name: c.name,
      subtitle: c.subtitle,
      photoIds: (c.photoIndices || [])
        .map((idx: number) => capped[idx - 1]?.id)
        .filter(Boolean) as string[],
    }));

    const response: AISuggestResponse = { clusters };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  } catch (err: unknown) {
    console.error("[AI Suggest] Anthropic error:", err);
    captureServerError(err, "ai-suggest", { photoCount: capped.length });
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Claude API error: " + msg }));
  }
}
