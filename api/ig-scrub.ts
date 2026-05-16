/**
 * /api/ig-scrub — Instagram scraper via Apify
 *
 * Splits the incoming URL list into:
 *   1. Direct image/video URLs → passed through immediately
 *   2. Instagram page URLs     → sent to apify~instagram-scraper (sync run)
 *
 * Env: APIFY_TOKEN  (set in Vercel dashboard)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|webm)(\?|$)/i;
const IG_URL    = /instagram\.com\/(p|reel|tv|stories)\//i;

type Category = "Image" | "Video";

interface ScrapedItem {
  src: string;
  category: Category;
  postUrl?: string;
}

// ── Apify ────────────────────────────────────────────────────────────────────

async function scrapeWithApify(igUrls: string[]): Promise<{ items: ScrapedItem[]; errors: string[] }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { items: [], errors: ["APIFY_TOKEN environment variable is not set"] };
  }

  // run-sync-get-dataset-items blocks until the actor finishes (up to `timeout` seconds)
  // memory=256 keeps cost low; instagram-scraper typically finishes in 15-40 s
  const url =
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items` +
    `?token=${token}&timeout=50&memory=256`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: igUrls,
      resultsType: "posts",
      resultsLimit: 50,
      addParentData: false,
    }),
    // node fetch signal for overall request timeout
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { items: [], errors: [`Apify error ${res.status}: ${txt.slice(0, 120)}`] };
  }

  // Dataset items — array of post objects
  const posts = (await res.json()) as ApifyPost[];
  const items: ScrapedItem[] = [];

  for (const post of posts) {
    const postUrl = post.url || post.shortCode
      ? `https://www.instagram.com/p/${post.shortCode}/`
      : undefined;

    if (post.type === "GraphSidecar" && Array.isArray(post.images) && post.images.length > 0) {
      // Carousel — extract each slide
      for (const img of post.images) {
        if (img) items.push({ src: img, category: "Image", postUrl });
      }
    } else if (post.type === "GraphVideo" && post.videoUrl) {
      items.push({ src: post.videoUrl, category: "Video", postUrl });
      // Also include the thumbnail
      if (post.displayUrl) items.push({ src: post.displayUrl, category: "Image", postUrl });
    } else if (post.displayUrl) {
      items.push({ src: post.displayUrl, category: "Image", postUrl });
    }
  }

  return { items, errors: [] };
}

// ── Apify post shape (partial) ───────────────────────────────────────────────

interface ApifyPost {
  type?: "GraphImage" | "GraphVideo" | "GraphSidecar";
  url?: string;
  shortCode?: string;
  displayUrl?: string;
  videoUrl?: string;
  images?: string[];   // carousel slides
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { urls } = req.body as { urls: string[] };
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: "urls array required" });
  }

  const results: ScrapedItem[] = [];
  const errors: string[] = [];
  const igUrls: string[] = [];

  for (const raw of urls.slice(0, 30)) {
    const url = raw.trim();
    if (!url) continue;

    if (IMAGE_EXT.test(url)) {
      results.push({ src: url, category: "Image" });
    } else if (VIDEO_EXT.test(url)) {
      results.push({ src: url, category: "Video" });
    } else if (IG_URL.test(url)) {
      igUrls.push(url);
    } else {
      errors.push(url + " (unrecognised URL format)");
    }
  }

  // Batch all IG URLs into one Apify run
  if (igUrls.length > 0) {
    const { items, errors: apifyErrors } = await scrapeWithApify(igUrls);
    results.push(...items);
    errors.push(...apifyErrors);
  }

  return res.status(200).json({ results, errors });
}
