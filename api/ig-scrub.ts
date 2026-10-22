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
import { llmComplete, llmConfigured } from "../server/llm.js";
import { checkCredits, runCharged } from "../server/creditGate.js";
import { captureServerError } from "../server/sentry.js";
import { bestTimesLine } from "../server/bestTimes.js";
import { carouselFormula, composePlaybook, pickCarousels } from "../server/carouselVision.js";

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|webm)(\?|$)/i;
const IG_URL    = /instagram\.com\/(p|reel|tv|stories)\//i;

type Category = "Image" | "Video";

// Apify run budget. Vercel kills the function at maxDuration (120s, vercel.json) and
// SKIPS the refund, so Apify + Claude must finish well inside it: 90s + 20s.
// (40s was too short: a real profile run returned TIMED-OUT on 2026-10-21.)
const APIFY_TIMEOUT_S = 90;
const APIFY_ABORT_MS = 92_000;
const CLAUDE_TIMEOUT_MS = 20_000;
const RESERVED_PATHS = /^(p|reel|reels|tv|stories|explore|accounts|direct|about|s)$/i;

/** Plain-English failure. `code` lets clients branch without parsing the message. */
function fail(res: VercelResponse, status: number, error: string, code: string): false {
  res.status(status).json({ error, code });
  return false;
}

/** "@name", "name", "instagram.com/name/?igsh=…" → canonical profile URL, or null. */
export function normalizeProfileURL(input: string): string | null {
  const s = input.trim();
  const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(s) || /^@?([A-Za-z0-9._]{1,30})$/.exec(s);
  const handle = m?.[1];
  if (!handle || RESERVED_PATHS.test(handle)) return null;
  return `https://www.instagram.com/${handle}/`;
}

const NOT_READABLE =
  "We couldn't read any posts from that account. It may be private, spelled differently, or Instagram blocked the lookup. " +
  "Check the handle and that the account is public, then try again.";

/** Apify returns {error, errorDescription} rows (not HTTP errors) for private/missing profiles. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function usablePosts(items: any): any[] {
  if (!Array.isArray(items)) return [];
  return items.filter((p) => p && typeof p === "object" && !p.error && (p.caption != null || p.displayUrl || p.likesCount != null));
}

function isTimeout(e: unknown): boolean {
  const n = (e as { name?: string })?.name;
  return n === "TimeoutError" || n === "AbortError";
}

interface ScrapedItem {
  src: string;
  category: Category;
  postUrl?: string;
}

// ── Apify ────────────────────────────────────────────────────────────────────

async function scrapeWithApify(igUrls: string[], resultsLimit = 50): Promise<{ items: ScrapedItem[]; errors: string[] }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { items: [], errors: ["APIFY_TOKEN environment variable is not set"] };
  }

  // run-sync-get-dataset-items blocks until the actor finishes (up to `timeout` seconds)
  // memory=1024: more RAM = faster runs (256 MB timed out at 40s once); cost is per result, not RAM
  const url =
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items` +
    `?token=${token}&timeout=${APIFY_TIMEOUT_S}&memory=1024`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: igUrls,
      resultsType: "posts",
      resultsLimit,
      addParentData: false,
    }),
    // node fetch signal for overall request timeout
    signal: AbortSignal.timeout(APIFY_ABORT_MS),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn("[ig-scrub] apify", res.status, txt.slice(0, 200));
    return { items: [], errors: [res.status === 408 ? "Instagram took too long to answer" : `Scraper unavailable (${res.status})`] };
  }

  // Dataset items — array of post objects
  const posts = usablePosts(await res.json()) as ApifyPost[];
  const items: ScrapedItem[] = [];
  if (posts.length === 0) return { items, errors: ["Instagram returned nothing (private, deleted, or blocked)"] };

  for (const post of posts) {
    const postUrl = post.url
      || (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : undefined);

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
  slideUrls: string[];
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

// Our own Apify actor (apify-actor/ in this repo). Calls the store scraper itself, ranks posts, retries.
// Default is the actor's id so renaming it on Apify never breaks the route.
const PROFILE_ACTOR = process.env.APIFY_PROFILE_ACTOR || "Zj1CthOiflFEQ6hnM";
const ACTOR_TIMEOUT_S = 60; // one scraper attempt; the route owns the retry/fallback budget

/** Posts from our actor in the raw shape the ranking code below expects; null = actor failed (use fallback). */
async function postsViaDumpsterActor(
  profileURL: string,
  limit: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ posts: any[] } | { timeout: true } | null> {
  if (!PROFILE_ACTOR || PROFILE_ACTOR === "off") return null;
  const handle = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(profileURL)?.[1];
  if (!handle) return null;
  try {
    const r = await fetch(
      `https://api.apify.com/v2/acts/${PROFILE_ACTOR}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&timeout=${ACTOR_TIMEOUT_S + 10}&memory=512`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles: [handle], resultsPerProfile: limit, upstreamTimeoutSecs: ACTOR_TIMEOUT_S, retryOnTimeout: false }),
        signal: AbortSignal.timeout((ACTOR_TIMEOUT_S + 15) * 1000),
      },
    );
    if (!r.ok) { console.warn("[ig-scrub] dumpster actor", r.status, (await r.text().catch(() => "")).slice(0, 200)); return null; }
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows.find((x) => x && x.mode === "profile") : null;
    if (!row) return null;
    if (row.error === "scrape_timeout") return { timeout: true };
    if (row.error === "no_public_posts") return { posts: [] };
    if (!row.ok || !Array.isArray(row.posts)) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { posts: row.posts.map((p: any) => ({
      caption: p.caption, likesCount: p.likes, commentsCount: p.comments, videoViewCount: p.views,
      productType: p.type,
      images: Array.isArray(p.slideUrls) && p.slideUrls.length > 1 ? p.slideUrls : p.slides > 1 ? new Array(p.slides).fill(null) : undefined,
      locationName: p.location, timestamp: p.postedAt, hashtags: p.hashtags, mentions: p.mentions,
    })) };
  } catch (e) {
    if (isTimeout(e)) return { timeout: true };
    console.warn("[ig-scrub] dumpster actor failed", (e as Error)?.message);
    return null;
  }
}

async function handleProfileScrub(
  req: VercelRequest,
  res: VercelResponse,
  profileInput: string,
  resultsLimit: number,
) {
  if (!llmConfigured(process.env.ANTHROPIC_API_KEY)) {
    return fail(res, 503, "Profile scrub isn't set up on our side yet. Please try again later.", "scrub_unconfigured");
  }
  const profileURL = normalizeProfileURL(profileInput);
  if (!profileURL) {
    return fail(res, 400, "That doesn't look like an Instagram handle. Enter it like @yourname or instagram.com/yourname.", "bad_handle");
  }

  const limit = Math.min(Math.max(resultsLimit, 4), 25);
  const t0 = Date.now();

  // 1. Apify scrape (profile → posts)
  // Our own actor first (one run = scrape + retry); the plain store scraper is the fallback.
  const viaActor = await postsViaDumpsterActor(profileURL, limit);
  if (viaActor && "timeout" in viaActor) {
    return fail(res, 504, "Instagram took too long to answer. Try again in a minute.", "scrape_timeout");
  }
  let posts: any[] | null = viaActor ? viaActor.posts : null; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!posts) {
  const apifyUrl =
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items` +
    `?token=${process.env.APIFY_TOKEN}&timeout=${APIFY_TIMEOUT_S}&memory=1024`;
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
    signal: AbortSignal.timeout(APIFY_ABORT_MS),
  });

  if (!apifyRes.ok) {
    const detail = await apifyRes.text().catch(() => "");
    console.warn("[ig-scrub] apify profile", apifyRes.status, detail.slice(0, 300));
    if (apifyRes.status === 408 || /TIMED-OUT/.test(detail)) {
      return fail(res, 504, "Instagram took too long to answer. Try again in a minute.", "scrape_timeout");
    }
    // 401/402/403 = our Apify token/credit problem, not the user's: surface to Sentry.
    if ([401, 402, 403].includes(apifyRes.status)) {
      captureServerError(new Error("Apify " + apifyRes.status + ": " + detail.slice(0, 200)), "ig-scrub.apify-account", {});
    }
    return fail(res, 502, "Our Instagram reader is temporarily unavailable. Try again in a few minutes.", "scrape_unavailable");
  }

  posts = usablePosts(await apifyRes.json());
  }
  if (posts.length === 0) return fail(res, 404, NOT_READABLE, "no_public_posts");

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
      slideUrls: Array.isArray(p?.images) ? p.images.filter((u: unknown) => typeof u === "string") : [],
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

  // Carousel vision stays Claude-only (SDK client); the text distill below falls back across providers.
  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: CLAUDE_TIMEOUT_MS, maxRetries: 0 })
    : null;
  // Carousel order/content (vision) runs alongside the text distill: free of extra wall time, own 25s cap,
  // skipped if the actor ate the budget (120s fn limit), "" on any failure.
  const MODEL = "claude-sonnet-4-5-20250929";
  const formulaP: Promise<string> = !anthropic || Date.now() - t0 > 70_000
    ? Promise.resolve("")
    : carouselFormula(anthropic, MODEL, pickCarousels(ranked));
  const raw = (await llmComplete({
    claudeKey: process.env.ANTHROPIC_API_KEY, claudeModel: MODEL, maxTokens: 700, totalMs: CLAUDE_TIMEOUT_MS,
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
  })).trim();

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

  if (!parsed.styleDescription && !parsed.engagementPlaybook) {
    return fail(res, 502, "We read the profile but couldn't turn it into a style. Try again.", "analyze_failed");
  }

  return res.status(200).json({
    description: parsed.styleDescription ?? "",
    engagementPlaybook: composePlaybook(parsed.engagementPlaybook ?? "", await formulaP, bestTimesLine(ranked)),
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
    return res.status(503).json({ error: "Instagram scrub isn't set up on our side yet. Please try again later.", code: "scrub_unconfigured" });
  }

  // Profile scrub = one-time taste-profile creation: FREE (no credits) but still
  // auth + rate limit (3/10min, 5/day) + global daily $ budget. Media scrub stays 5 credits.
  const isProfile = typeof (req.body || {}).profileURL === "string" && !!req.body.profileURL;
  const gate = await checkCredits(req, res, isProfile ? "ig_profile" : "ig_scrub", isProfile ? { free: true } : undefined);
  if (!gate.proceed) return;

  // Same contract as the AI routes: refund unless we wrote a useful 200.
  await runCharged(res, gate, "ig-scrub", () => runScrub(req, res, gate.userId));
}

async function runScrub(req: VercelRequest, res: VercelResponse, userId: string | null): Promise<boolean> {
  const { urls, profileURL, resultsLimit } = (req.body || {}) as {
    urls?: string[];
    profileURL?: string;
    resultsLimit?: number;
  };

  // Mode B: profile scrub (native "Generate from Instagram")
  if (typeof profileURL === "string" && profileURL) {
    try {
      await handleProfileScrub(req, res, profileURL, resultsLimit ?? 12);
      return res.statusCode === 200;
    } catch (err) {
      if (isTimeout(err)) {
        return fail(res, 504, "Instagram took too long to answer. Try again in a minute.", "scrape_timeout");
      }
      captureServerError(err, "ig-scrub.profile", { userId });
      return fail(res, 500, "Something went wrong reading that profile. Try again in a minute.", "scrub_error");
    }
  }

  if (!urls || !Array.isArray(urls)) {
    return fail(res, 400, "Paste at least one Instagram post link.", "bad_request");
  }

  try {
    const results: ScrapedItem[] = [];
    const errors: string[] = [];
    const igUrls: string[] = [];
    let profileCount = 0;

    for (const raw of urls.slice(0, 30)) {
      const url = raw.trim();
      if (!url) continue;

      if (IMAGE_EXT.test(url)) {
        results.push({ src: url, category: "Image" });
      } else if (VIDEO_EXT.test(url)) {
        results.push({ src: url, category: "Video" });
      } else if (IG_URL.test(url)) {
        igUrls.push(url);
      } else if (!/cdninstagram|scontent/i.test(url) && normalizeProfileURL(url)) {
        // "@name", "name" or instagram.com/name → that profile's recent posts
        igUrls.push(normalizeProfileURL(url) as string);
        profileCount++;
      } else {
        errors.push(url + " (unrecognised URL format)");
      }
    }

    // Batch all IG URLs into one Apify run
    if (igUrls.length > 0) {
      const { items, errors: apifyErrors } = await scrapeWithApify(igUrls, profileCount ? Math.min(50, igUrls.length - profileCount + profileCount * 12) : 50);
      results.push(...items);
      errors.push(...apifyErrors);
    }

    // An empty scrub (everything failed / nothing found) still returns 200 so
    // the sheet can show the per-URL errors, but it isn't charged.
    res.status(200).json({ results, errors });
    return results.length > 0;
  } catch (err) {
    // Previously unhandled — an Apify/network failure here would 500 with no
    // observability at all (backend security audit, 2026-07-01).
    if (isTimeout(err)) return fail(res, 504, "Instagram took too long to answer. Try again in a minute.", "scrape_timeout");
    captureServerError(err, "ig-scrub", { userId });
    return fail(res, 500, "Something went wrong with the scrub. Try again in a minute.", "scrub_error");
  }
}
