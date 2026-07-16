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
  "AUTOMOTIVE", "SELFIE", "NIGHTLIFE", "DINING", "FITNESS", "TRAVEL",
  "ARCHITECTURE", "ART", "FASHION", "STUDIO", "CULTURE", "LIFESTYLE",
];
const FALLBACK_CATEGORY = "LIFESTYLE";

// Hints so Claude maps the same way native's keyword→category map does.
// No separate PORTRAIT bucket: a posed/styled photo of a person is a fashion
// moment (what they're wearing is the point) — folded into FASHION. Only a
// self-taken shot gets its own category (SELFIE), since that's a distinct,
// visually-detectable framing, not a styling choice.
const CATEGORY_HINTS = [
  "AUTOMOTIVE — cars, vehicles, rims, engines, dashboards",
  "SELFIE — self-taken: arm's-length shot, front camera, mirror photo — the giveaway is the visible arm/phone/mirror reflection, or the framing angle only a self-shot produces",
  "NIGHTLIFE — bars, clubs, parties, drinks, concerts, neon",
  "DINING — food, meals, restaurants, coffee, plated dishes",
  "FITNESS — gym, workouts, sports, athletes, training",
  "TRAVEL — beaches, nature, landscapes, sunsets, mountains, water",
  "ARCHITECTURE — buildings, interiors, cities, rooms, structures",
  "ART — paintings, galleries, sculpture, museums, exhibitions",
  "FASHION — outfits, clothing, style, accessories, shoes, AND any posed/styled photo of a person taken by someone else (headshots, formal portraits) — what they're wearing is always part of the shot",
  "STUDIO — product shots, controlled/studio lighting, flat lays",
  "CULTURE — crowds, gatherings, festivals, sports/concert audiences, ceremonies, public events (the event/group is the subject, not one styled person)",
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

  const system = `You are an expert photo classifier. Look carefully at EACH photo, decide what it is PRIMARILY about, then pick the single best category and write a precise 2–5 word label that names the specific subject.

Categories (use the UPPERCASE name exactly):
${CATEGORY_HINTS}

How to choose accurately:
- Judge by the PRIMARY subject — what the photo is really about — not incidental background. A latte on a cafe table is DINING even if a building shows through the window.
- Activity/context beats "there is a person in it". A person mid-workout is FITNESS; a person in clubwear under neon is NIGHTLIFE; a posed shot taken by someone else — outfit, headshot, formal photo — is FASHION; only a self-taken arm's-length/mirror/front-camera shot is SELFIE; a crowd/audience/gathering where no single styled person is the subject is CULTURE.
- Use STUDIO only for product/object shots on a controlled or seamless background (e-commerce look), not real-world scenes.
- Use TRAVEL for outdoor nature/landscapes (beach, mountains, sunsets); ARCHITECTURE for buildings/interiors/cityscapes.
- Only use ${FALLBACK_CATEGORY} when it genuinely doesn't fit any specific category — don't default to it out of uncertainty; commit to the best fit.

Label rules — SPECIFICITY IS THE WHOLE JOB:
- Name the ACTUAL subject with identifying detail: make/model, breed, dish name, landmark, color + object. "Matte black G-Wagon", not "car". "Shrimp pad thai", not "food". "Golden Gate Bridge at dusk", not "bridge".
- Include the strongest distinguishing attribute you can actually see (color, brand, location, action): "Nike Air Force 1s", "Barber fade lineup", "Courtside Hawks game".
- BANNED as labels: "photo", "image", "picture", "scene", "view", "moment", "vibe", "aesthetic", and any one-word generic noun ("food", "car", "building", "person", "outfit"). If tempted, add what KIND.
- 2–5 words. Every word must carry information.
- If you genuinely can't identify the specific subject, describe the most concrete visible details instead ("Neon-lit ramen bar", not "restaurant").
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
      max_tokens: 80 * usableIds.length + 250,
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
