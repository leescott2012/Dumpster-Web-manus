/**
 * AI Label — server-side handler.
 * Scans a batch of photos with Claude Vision and returns a category + a short
 * human label for each. Powers the Pool "Scan" button so uploaded photos get
 * auto-tagged (category drives the pool filters; label becomes the alt text).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage, ServerResponse } from "http";
import { fetchImageAsBase64 } from "./imageBase64.js";
import { captureServerError } from "./sentry.js";

export interface LabelPhotoInput { id: string; url: string }
export interface LabelResult { id: string; category: string; label: string }

const MAX_PHOTOS = 12; // per request — client chunks larger sets

// Taxonomy mirrors the native iOS PhotoAnalyzer (Apple Vision) categories EXACTLY
// so a photo lands in the same bucket whether it's scanned on web or on device.
// Keep this list in sync with dumpster/ios/.../PhotoAnalyzer.swift. Fallback is
// LIFESTYLE (same as native's default).
const CATEGORIES = [
  "AUTOMOTIVE", "PORTRAIT", "NIGHTLIFE", "DINING", "FITNESS", "TRAVEL",
  "ARCHITECTURE", "ART", "FASHION", "STUDIO", "LIFESTYLE",
];
const FALLBACK_CATEGORY = "LIFESTYLE";

// Hints so Claude maps the same way native's keyword→category map does.
const CATEGORY_HINTS = [
  "AUTOMOTIVE — cars, vehicles, rims, engines, dashboards",
  "PORTRAIT — people, faces, selfies, headshots, crowds",
  "NIGHTLIFE — bars, clubs, parties, drinks, concerts, neon",
  "DINING — food, meals, restaurants, coffee, plated dishes",
  "FITNESS — gym, workouts, sports, athletes, training",
  "TRAVEL — beaches, nature, landscapes, sunsets, mountains, water",
  "ARCHITECTURE — buildings, interiors, cities, rooms, structures",
  "ART — paintings, galleries, sculpture, museums, exhibitions",
  "FASHION — outfits, clothing, style, accessories, shoes",
  "STUDIO — product shots, controlled/studio lighting, flat lays",
  "LIFESTYLE — everyday / anything that doesn't clearly fit above (default)",
].join("\n");

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

export async function handleAILabel(
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

  let photos: LabelPhotoInput[];
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    photos = Array.isArray(parsed.photos) ? parsed.photos.slice(0, MAX_PHOTOS) : [];
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  if (photos.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No photos to scan" }));
    return;
  }

  const system = `You label photos for a photo-organizing app. For EACH photo, pick the single best category and write a 2–4 word descriptive label.

Categories (use the UPPERCASE name exactly):
${CATEGORY_HINTS}

Rules:
- category MUST be exactly one of: ${CATEGORIES.join(", ")}.
- When a photo doesn't clearly fit a specific category, use ${FALLBACK_CATEGORY}.
- label is a short human description, e.g. "Latte and croissant", "Sunset at the pier", "Group selfie".
- Match each result to the photo's id given before its image.

Respond ONLY with valid JSON, no markdown, no code fences:
{"labels":[{"id":"<id>","category":"<CATEGORY>","label":"<short label>"}]}`;

  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } }
    | { type: "text"; text: string };

  const fetched = await Promise.all(photos.map((p) => fetchImageAsBase64(p.url)));
  const content: ContentBlock[] = [];
  const usableIds: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    const img = fetched[i];
    if (!img) continue;
    usableIds.push(photos[i].id);
    content.push({ type: "text", text: `Photo id: ${photos[i].id}` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
  }

  if (usableIds.length === 0) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Could not load any images", code: "no_images" }));
    return;
  }

  content.push({ type: "text", text: `Label all ${usableIds.length} photos now. Return JSON only.` });

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 60 * usableIds.length + 200,
      system,
      messages: [{ role: "user", content }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const rawLabels: any[] = Array.isArray(parsed.labels) ? parsed.labels : [];

    // Validate + clamp categories to the taxonomy; drop anything unrecognized.
    const labels: LabelResult[] = [];
    for (const l of rawLabels) {
      if (!l || typeof l.id !== "string") continue;
      const raw = typeof l.category === "string" ? l.category.toUpperCase() : "";
      const cat = CATEGORIES.indexOf(raw) >= 0 ? raw : FALLBACK_CATEGORY;
      const label = typeof l.label === "string" ? l.label.slice(0, 60) : "";
      labels.push({ id: l.id, category: cat, label });
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ labels }));
  } catch (e) {
    captureServerError(e, "aiLabel.handler", { count: usableIds.length });
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Scan failed — try again", code: "ai_error" }));
  }
}
