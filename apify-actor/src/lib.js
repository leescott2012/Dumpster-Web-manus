// Pure helpers (no Apify imports) so test.js can run them anywhere.

const HANDLE = /^@?([A-Za-z0-9._]{1,30})$/;
const RESERVED = /^(p|reel|reels|tv|stories|explore|accounts|direct|about|s)$/i;
const POST_URL = /instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i;

/** "@name" / "name" / "instagram.com/name/" -> "name", or null. */
export function parseHandle(input) {
  const s = String(input || '').trim();
  const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(s) || HANDLE.exec(s);
  const h = m && m[1];
  return h && !RESERVED.test(h) ? h : null;
}

export function isPostUrl(u) { return POST_URL.test(String(u || '')); }

/** Apify returns {error, errorDescription} rows (not HTTP errors) for private/missing profiles. */
export function usablePosts(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((p) => p && typeof p === 'object' && !p.error && (p.caption != null || p.displayUrl || p.likesCount != null));
}

/** Top comments on a post: text, likes, replies only (no usernames: we keep trends, not people). */
function pickComments(p) {
  const src = Array.isArray(p.latestComments) ? p.latestComments : [];
  const out = src
    .filter((c) => c && typeof c.text === 'string' && c.text.trim())
    .map((c) => ({ text: c.text.trim().slice(0, 240), likes: Math.max(0, Number(c.likesCount ?? 0)), replies: Number(c.repliesCount ?? 0) }))
    .sort((a, b) => b.likes + b.replies - (a.likes + a.replies));
  return out.slice(0, 10);
}

/** One normalized, scored post. Comments weigh 3x, views 0.05x (same formula as the Dumpster server).
 *  Instagram hides like counts on some posts and the scraper then returns -1: treat that as unknown (0) and flag it. */
export function normalizePost(p) {
  const caption = String(p.caption ?? '');
  const rawLikes = Number(p.likesCount ?? 0);
  const likesHidden = rawLikes < 0;
  const likes = likesHidden ? 0 : rawLikes;
  const comments = Math.max(0, Number(p.commentsCount ?? 0));
  const views = Math.max(0, Number(p.videoViewCount ?? p.videoPlayCount ?? 0));
  const slideUrls = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  return {
    url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : ''),
    caption,
    firstLine: caption.split(/\r?\n/)[0].trim().slice(0, 200),
    hashtags: Array.isArray(p.hashtags) ? p.hashtags.slice(0, 15) : [],
    mentions: Array.isArray(p.mentions) ? p.mentions.slice(0, 8) : [],
    likes, likesHidden, comments, views,
    type: String(p.productType ?? p.type ?? 'Feed'),
    slides: slideUrls.length > 1 ? slideUrls.length : Array.isArray(p.childPosts) ? Math.max(p.childPosts.length, 1) : 1,
    slideUrls,                       // in carousel order: first = hook, last = ender
    slideTypes: Array.isArray(p.childPosts) ? p.childPosts.map((c) => String(c?.type ?? 'Image')) : [],
    altText: String(p.alt ?? '').slice(0, 300),
    comments_top: pickComments(p),
    isPinned: Boolean(p.isPinned),
    location: String(p.locationName ?? ''),
    postedAt: String(p.timestamp ?? p.takenAt ?? ''),
    score: likes + comments * 3 + views * 0.05,
  };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Best weekday and 3-hour window (UTC) by average score. Needs >= minPosts dated posts, else null. */
export function bestTimes(posts, minPosts = 8) {
  const dated = posts.filter((p) => !p.isPinned && p.postedAt && !Number.isNaN(new Date(p.postedAt).getTime()));
  if (dated.length < minPosts) return null;
  const day = Array(7).fill(0).map(() => ({ s: 0, n: 0 }));
  const win = Array(8).fill(0).map(() => ({ s: 0, n: 0 }));
  for (const p of dated) {
    const d = new Date(p.postedAt);
    day[d.getUTCDay()].s += p.score; day[d.getUTCDay()].n++;
    const w = Math.floor(d.getUTCHours() / 3);
    win[w].s += p.score; win[w].n++;
  }
  const best = (arr) => arr.reduce((bi, c, i) => (c.n && (bi < 0 || c.s / c.n > arr[bi].s / arr[bi].n) ? i : bi), -1);
  const di = best(day), wi = best(win);
  const pad = (n) => String(n).padStart(2, '0');
  return { weekday: DAYS[di], windowUtc: `${pad(wi * 3)}:00-${pad(wi * 3 + 3)}:00`, sample: dated.length, timezone: 'UTC' };
}

/** Counts of carousel / single / video posts and average score per format. */
export function formats(posts) {
  const out = {};
  for (const p of posts) {
    const k = /video|reel|clips/i.test(p.type) ? 'video' : p.slides > 1 || /sidecar/i.test(p.type) ? 'carousel' : 'single';
    out[k] = out[k] || { posts: 0, avgScore: 0 };
    out[k].posts++; out[k].avgScore += p.score;
  }
  for (const k of Object.keys(out)) out[k].avgScore = Math.round(out[k].avgScore / out[k].posts);
  return out;
}

/** Image/video links from a raw post (carousels expanded), for the media (post URL) mode. */
export function mediaFromPost(p) {
  const url = p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : undefined);
  const out = [];
  if (p.type === 'Sidecar' || p.type === 'GraphSidecar') {
    for (const img of Array.isArray(p.images) ? p.images : []) if (img) out.push({ src: img, category: 'Image', postUrl: url });
  } else if ((p.type === 'Video' || p.type === 'GraphVideo') && p.videoUrl) {
    out.push({ src: p.videoUrl, category: 'Video', postUrl: url });
    if (p.displayUrl) out.push({ src: p.displayUrl, category: 'Image', postUrl: url });
  } else if (p.displayUrl) {
    out.push({ src: p.displayUrl, category: 'Image', postUrl: url });
  }
  return out;
}
