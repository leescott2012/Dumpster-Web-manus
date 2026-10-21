/**
 * Carousel formula for the Instagram profile scan.
 * Looks at the ORDER + CONTENT of the top carousels' slides (hook / filler / ender, pairing rules)
 * and returns one short line for the engagementPlaybook. Every failure returns "" - the scan never depends on it.
 * Slides are PUBLIC Instagram CDN images (not users' own photos).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { fetchImageAsBase64, type MediaType } from "./imageBase64.js";

export const VISION_TIMEOUT_MS = 25_000;
const MAX_CAROUSELS = 2;
const SLIDES_PER_CAROUSEL = 6;   // cost knob: ~12 images/scan
const MAX_IMAGES = 16;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const FORMULA_MAX = 300;
const PLAYBOOK_MAX = 750; // clients keep 750 chars (iOS prefix(750))
const CDN = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

export interface CarouselPost { slideUrls?: string[]; engagementScore: number }

function isCdnUrl(u: unknown): u is string {
  try { return typeof u === "string" && CDN.test(new URL(u).hostname); } catch { return false; }
}

/** Top carousels by score: >=3 slides with real CDN urls; singles skipped. */
export function pickCarousels<T extends CarouselPost>(ranked: T[]): T[] {
  return ranked
    .filter((p) => (p.slideUrls ?? []).filter(isCdnUrl).length >= 3)
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, MAX_CAROUSELS);
}

/** Slide indexes to look at: always first + last, rest evenly sampled from the middle. */
export function pickSlideIndexes(n: number, max = SLIDES_PER_CAROUSEL): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const mid = max - 2, out = [0];
  for (let k = 1; k <= mid; k++) out.push(Math.round((k * (n - 1)) / (mid + 1)));
  out.push(n - 1);
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export const VISION_PROMPT =
  `These are slides from the top-performing Instagram carousels of one creator, shown in order. Before each carousel's images there is a line "CAROUSEL n: total T slides; shown = [slide numbers]". ` +
  `For every shown slide give a role (hook = first slide, ender = last slide, otherwise filler) and a short shot-type tag (e.g. person-luxury-setting, food, scenery, interior, car, detail, selfie, text). ` +
  `Then judge what the ORDER and CONTENT teach: what makes the hook work, what the ender is, how filler is mixed, how shot types are paired/sequenced, what to avoid. ` +
  `Reply with ONLY JSON: {"carousels":[{"slides":[{"n":1,"role":"hook","shot":"..."}]}],` +
  `"hooks":"...","enders":"...","filler":"...","sequencing":"...","avoid":"...",` +
  `"formula":"ONE line, max 280 chars, imperative, e.g. Open with X; middle rotates A/B/C in threes, never repeat a shot type back to back; close with Y."}`;

export interface Slide { n: number; role: string; shot: string }
export interface VisionResult { carousels: { slides: Slide[] }[]; hooks: string; enders: string; filler: string; sequencing: string; avoid: string; formula: string }

/** Tolerant JSON parse (fences / chatter). null if unusable. */
export function parseVision(raw: string): VisionResult | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (!j || typeof j.formula !== "string" || !j.formula.trim()) return null;
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      carousels: Array.isArray(j.carousels) ? j.carousels : [],
      hooks: s(j.hooks), enders: s(j.enders), filler: s(j.filler), sequencing: s(j.sequencing), avoid: s(j.avoid),
      formula: j.formula.trim(),
    };
  } catch { return null; }
}

/** "Carousel formula: ..." capped at 300 chars, cut on a word boundary. */
export function formulaLine(r: VisionResult | null): string {
  if (!r) return "";
  const full = "Carousel formula: " + r.formula.replace(/\s+/g, " ");
  if (full.length <= FORMULA_MAX) return full;
  return full.slice(0, FORMULA_MAX - 1).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "") + ".";
}

/** base playbook + carousel formula + best-times line, <=750 chars. Base text is trimmed first; the formula and times line are kept whole. */
export function composePlaybook(base: string, formula: string, times: string): string {
  const tail = [formula, times].filter(Boolean).join(" ");
  if (!tail) return base;
  return (base.slice(0, Math.max(0, PLAYBOOK_MAX - tail.length - 1)).trimEnd() + " " + tail).trim().slice(0, PLAYBOOK_MAX);
}

/** Fetch slides + one vision call. Always resolves; "" on any failure. */
export async function carouselFormula(client: Anthropic, model: string, carousels: CarouselPost[]): Promise<string> {
  try {
    const content: Anthropic.ContentBlockParam[] = [];
    let images = 0, bytes = 0;
    for (let ci = 0; ci < carousels.length; ci++) {
      const c = carousels[ci];
      const urls = (c.slideUrls ?? []).filter(isCdnUrl);
      const idx = pickSlideIndexes(urls.length).slice(0, MAX_IMAGES - images);
      const got = await Promise.all(idx.map(async (i) => ({ i, img: await fetchImageAsBase64(urls[i]).catch(() => null) })));
      const ok: { i: number; img: { base64: string; mediaType: MediaType } }[] = [];
      for (const g of got) {
        if (!g.img) continue;
        bytes += g.img.base64.length * 0.75;
        if (bytes <= MAX_TOTAL_BYTES) ok.push({ i: g.i, img: g.img });
      }
      if (ok.length < 2) continue;
      content.push({ type: "text", text: `CAROUSEL ${ci + 1}: total ${urls.length} slides; shown = [${ok.map((g) => g.i + 1).join(", ")}]` });
      for (const g of ok) {
        content.push({ type: "image", source: { type: "base64", media_type: g.img.mediaType, data: g.img.base64 } });
        images++;
      }
    }
    if (images < 2) return "";
    content.push({ type: "text", text: VISION_PROMPT });
    const r = await client.messages.create(
      { model, max_tokens: 900, messages: [{ role: "user", content }] },
      { timeout: VISION_TIMEOUT_MS, maxRetries: 0 },
    );
    const b = r.content[0];
    return formulaLine(parseVision(b && "text" in b ? b.text : ""));
  } catch (e) {
    console.warn("[ig-scrub] carousel vision skipped:", (e as Error)?.message);
    return "";
  }
}
