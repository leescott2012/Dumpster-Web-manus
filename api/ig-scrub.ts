/**
 * /api/ig-scrub — Instagram scraper via Apify
 *
 * Two modes, one function (kept together to stay under the Vercel fn budget):
 *   A. { urls: [...] }      → media scrub: direct image/video URLs pass through,
 *                             IG post URLs go to apify~instagram-scraper (sync run)
 *   B. { profileURL: "…" }  → profile scrub: scrape a profile's posts, rank by
 *                             engagement, distill style + playbook via Claude.
 *                             Native iOS calls this via the /api/scrub-instagram
 *                             rewrite (ported from the legacy dumpster-omega
 *                             endpoint, now behind the standard credit gate).
 *
 * Env: APIFY_TOKEN, ANTHROPIC_API_KEY  (set in Vercel dashboard)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { checkCredits } from "../server/creditGate.js";
import { captureServerError } from "../server/sentry.js";

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

// ── Profile scrub (mode B) ───────────────────────────────────────────────────

interface RankedPost {
  caption: string;
  firstLine: string;
  hashtags: string[];
  mentions: string[];
  likes: number;
  comments: number;
  views: number;
  productType: string;
  carouselLength: number;
  location: string;
  postedAt: string;
  engagementScore: number;
}

function fmtEng(p: RankedPost): string {
  const parts: string[] = [];
  if (p.likes) parts.push(`${formatNum(p.likes)} likes`);
  if (p.comments) parts.push(`${formatNum(p.comments)} comments`);
  if (p.views) parts.push(`${formatNum(p.views)} views`);
  return parts.length ? parts.join(" / ") : "no engagement data";
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

async function handleProfileScrub(
  req: VercelRequest,
  res: VercelResponse,
  profileURL: string,
  resultsLimit: number,
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Profile scrub is not configured on this server." });
  }
  if (!/instagram\.com\//i.test(profileURL)) {
    return res.status(400).json({ error: "Provide a valid Instagram profile URL." });
  }

  const limit = Math.min(Math.max(resultsLimit, 4), 25);

  // 1. Apify scrape (profile → posts)
  const apifyUrl =
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items` +
    `?token=${process.env.APIFY_TOKEN}&timeout=50&memory=256`;
  const apifyRes = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [profileURL],
      resultsType: "posts",
      resultsLimit: limit,
      searchType: "user",
      addParentData: false,
    }),
    signal: AbortSignal.timeout(55_000),
  });

  if (!apifyRes.ok) {
    const detail = await apifyRes.text().catch(() => "");
    return res.status(502).json({ error: "Apify scrub failed", detail: detail.slice(0, 500) });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (await apifyRes.json()) as any[];
  if (!Array.isArray(posts) || posts.length === 0) {
    return res.status(404).json({ error: "No public posts found on this profile." });
  }

  // 2. Normalize + rank by engagement
  const ranked: RankedPost[] = posts.map((p) => {
    const caption = (p?.caption ?? "").toString();
    const likes = Number(p?.likesCount ?? 0);
    const comments = Number(p?.commentsCount ?? 0);
    const views = Number(p?.videoViewCount ?? p?.videoPlayCount ?? 0);
    return {
      caption,
      firstLine: caption.split(/\r?\n/)[0]?.trim().slice(0, 200) ?? "",
      hashtags: Array.isArray(p?.hashtags) ? p.hashtags.slice(0, 15) : [],
      mentions: Array.isArray(p?.mentions) ? p.mentions.slice(0, 8) : [],
      likes,
      comments,
      views,
      productType: (p?.productType ?? p?.type ?? "Feed").toString(),
      carouselLength: Array.isArray(p?.images)
        ? p.images.length
        : Array.isArray(p?.childPosts) ? p.childPosts.length : 1,
      location: (p?.locationName ?? "").toString(),
      postedAt: (p?.timestamp ?? p?.takenAt ?? "").toString(),
      // comments weighted 3x (engagement quality), views 0.05x (reels reach)
      engagementScore: likes + comments * 3 + views * 0.05,
    };
  });

  ranked.sort((a, b) => b.engagementScore - a.engagementScore);
  const winners = ranked.slice(0, 3);
  const allUnique = Array.from(new Set(ranked.flatMap((r) => r.hashtags))).slice(0, 20);

  // 3. Claude distill — explicit winner weighting
  const winnerBlock = winners
    .map((p, i) =>
      `WINNER #${i + 1} (${fmtEng(p)})
Type: ${p.productType}${p.carouselLength > 1 ? ` (${p.carouselLength}-slide carousel)` : ""}
Hook: ${p.firstLine || "[no caption]"}
Full caption: ${p.caption.slice(0, 400) || "[no caption]"}
Hashtags: ${p.hashtags.slice(0, 8).join(", ") || "none"}
${p.location ? `Location: ${p.location}\n` : ""}${p.mentions.length ? `Mentions: ${p.mentions.join(", ")}\n` : ""}`)
    .join("\n\n");

  const restBlock = ranked
    .slice(3, limit)
    .map((p, i) => `Post ${i + 4} (${fmtEng(p)}, ${p.productType}): ${p.firstLine || "[no caption]"}`)
    .join("\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const distill = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 700,
    messages: [
      {
        role: "user",
        content: `You are an Instagram strategist. Analyze this creator's public posts and produce TWO outputs as valid JSON:

{
  "styleDescription": "2-3 sentence description of the creator's aesthetic + verbal voice (visual mood, subject matter, caption tone, recurring motifs). 400-600 chars.",
  "engagementPlaybook": "2-3 sentence playbook of WHAT WORKS for this creator (best-performing post types, hook formulas, hashtag combos, content patterns that drove the top engagement). 400-600 chars. Be specific and actionable — another AI will use this to write content that performs."
}

Weight the TOP-3 WINNERS heavily — those reflect what the audience rewards. The lower-engagement posts are context only.

TOP-3 WINNERS (highest engagement, weight these most):
${winnerBlock}

REST OF FEED (context only):
${restBlock || "[none]"}

Top hashtags overall: ${allUnique.slice(0, 12).join(", ") || "none"}

Respond with ONLY the JSON object. No preamble, no markdown fences, no commentary.`,
      },
    ],
  });

  const block = distill.content[0];
  const raw = block && "text" in block ? block.text.trim() : "";

  // 4. Parse Claude's JSON (robust to fences and trailing chatter)
  let parsed: { styleDescription?: string; engagementPlaybook?: string } = {};
  const tryParse = (s: string): boolean => {
    try {
      parsed = JSON.parse(s);
      return typeof parsed === "object" && parsed != null;
    } catch {
      return false;
    }
  };
  if (!tryParse(raw)) {
    const stripped = raw.replace(/^[\s`]*(?:json)?\s*/i, "").replace(/[\s`]*$/g, "").trim();
    if (!tryParse(stripped)) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match || !tryParse(match[0])) {
        parsed = { styleDescription: raw.slice(0, 750), engagementPlaybook: "" };
      }
    }
  }

  return res.status(200).json({
    description: parsed.styleDescription ?? "",
    engagementPlaybook: parsed.engagementPlaybook ?? "",
    postsAnalyzed: ranked.length,
    hashtags: allUnique.slice(0, 10),
    topPosts: winners.map((w) => ({
      firstLine: w.firstLine.slice(0, 120),
      likes: w.likes,
      comments: w.comments,
      views: w.views,
      productType: w.productType,
    })),
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Fail fast if Apify isn't configured — don't charge credits for a broken call.
  if (!process.env.APIFY_TOKEN) {
    return res.status(503).json({ error: "IG Scrub is not configured on this server." });
  }

  // Auth + rate limit + daily budget + credit gate.
  const gate = await checkCredits(req, res, "ig_scrub");
  if (!gate.proceed) return;

  const { urls, profileURL, resultsLimit } = req.body as {
    urls?: string[];
    profileURL?: string;
    resultsLimit?: number;
  };

  // Mode B: profile scrub (native "Generate from Instagram")
  if (typeof profileURL === "string" && profileURL) {
    try {
      return await handleProfileScrub(req, res, profileURL, resultsLimit ?? 12);
    } catch (err) {
      captureServerError(err, "ig-scrub.profile", { userId: gate.userId });
      return res.status(500).json({ error: "Scrub failed" });
    }
  }

  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: "urls array required" });
  }

  try {
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
  } catch (err) {
    // Previously unhandled — an Apify/network failure here would 500 with no
    // observability at all (backend security audit, 2026-07-01).
    captureServerError(err, "ig-scrub", { userId: gate.userId });
    return res.status(500).json({ error: "Scrub failed" });
  }
}
