/**
 * /api/ig-scrub — Instagram / URL image extractor
 * Accepts an array of URLs (IG post URLs or direct image URLs).
 * For direct image/video URLs → passes through.
 * For page URLs → fetches with a browser-like UA and parses og:image / og:video.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|webm)(\?|$)/i;

async function extractFromPage(url: string): Promise<{ src: string; category: "Image" | "Video" }[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });

    const html = await res.text();
    const results: { src: string; category: "Image" | "Video" }[] = [];

    // og:video (Reels, video posts)
    const ogVideo = html.match(/property=["']og:video["'][^>]*content=["']([^"']+)["']/);
    const ogVideoAlt = html.match(/content=["']([^"']+)["'][^>]*property=["']og:video["']/);
    const videoSrc = ogVideo?.[1] || ogVideoAlt?.[1];
    if (videoSrc) results.push({ src: videoSrc, category: "Video" });

    // og:image (all posts — also the thumbnail for videos)
    const ogImg = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/);
    const ogImgAlt = html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/);
    const imgSrc = ogImg?.[1] || ogImgAlt?.[1];
    if (imgSrc && imgSrc !== videoSrc) results.push({ src: imgSrc, category: "Image" });

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { urls } = req.body as { urls: string[] };
  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: "urls array required" });
  }

  const results: { src: string; category: "Image" | "Video" }[] = [];
  const errors: string[] = [];

  for (const raw of urls.slice(0, 30)) {
    const url = raw.trim();
    if (!url) continue;

    // Direct image / video URL — pass straight through
    if (IMAGE_EXT.test(url)) {
      results.push({ src: url, category: "Image" });
      continue;
    }
    if (VIDEO_EXT.test(url)) {
      results.push({ src: url, category: "Video" });
      continue;
    }

    // Page URL — try to scrape meta tags
    try {
      const extracted = await extractFromPage(url);
      if (extracted.length > 0) {
        results.push(...extracted);
      } else {
        errors.push(url);
      }
    } catch {
      errors.push(url);
    }
  }

  return res.status(200).json({ results, errors });
}
