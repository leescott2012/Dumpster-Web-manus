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

// Constrained taxonomy so categories stay consistent for the pool filters.
const CATEGORIES = [
  "Food", "Drink", "People", "Selfie", "Nature", "Beach", "City", "Travel",
  "Pets", "Party", "Fashion", "Fitness", "Art", "Home", "Object", "Other",
];

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

  const system = `You label photos for a photo-organizing app. For EACH photo, pick the single best category from this list and write a 2–4 word descriptive label.

Categories: ${CATEGORIES.join(", ")}

Rules:
- category MUST be exactly one value from the list above.
- label is a short human description, e.g. "Latte and croissant", "Sunset at the pier", "Group selfie".
- Match each result to the photo's id given before its image.

Respond ONLY with valid JSON, no markdown, no code fences:
{"labels":[{"id":"<id>","category":"<Category>","label":"<short label>"}]}`;

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
      model: "claude-haiku-4-5",
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
      const cat = CATEGORIES.indexOf(l.category) >= 0 ? l.category : "Other";
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
