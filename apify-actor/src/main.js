import { Actor, log } from 'apify';
import { parseHandle, isPostUrl, usablePosts, normalizePost, bestTimes, formats, mediaFromPost } from './lib.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
  handles = [], postUrls = [], resultsPerProfile = 12,
  upstreamTimeoutSecs = 90, upstreamMemoryMbytes = 1024, retryOnTimeout = true,
} = input;
const UPSTREAM = 'apify/instagram-scraper';

/** Run the store scraper; retry once, longer, if it times out. Returns dataset items or throws. */
async function scrape(runInput) {
  for (let attempt = 0; attempt < (retryOnTimeout ? 2 : 1); attempt++) {
    const timeout = Math.round(upstreamTimeoutSecs * (attempt ? 1.5 : 1));
    const run = await Actor.call(UPSTREAM, runInput, { memory: upstreamMemoryMbytes, timeout });
    if (run.status === 'SUCCEEDED') {
      const { items } = await Actor.apifyClient.dataset(run.defaultDatasetId).listItems();
      return items;
    }
    log.warning(`Upstream run ${run.id} ended ${run.status} (attempt ${attempt + 1})`);
    if (run.status !== 'TIMED-OUT') throw new Error(`upstream ${run.status}`);
  }
  throw new Error(retryOnTimeout ? 'upstream TIMED-OUT twice' : 'upstream TIMED-OUT');
}

const limit = Math.min(Math.max(Number(resultsPerProfile) || 12, 4), 30);

// Profiles: one upstream run per handle so one bad handle never sinks the others.
for (const raw of handles) {
  const handle = parseHandle(raw);
  if (!handle) { await Actor.pushData({ mode: 'profile', input: raw, ok: false, error: 'bad_handle' }); continue; }
  try {
    const items = await scrape({
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: 'posts', resultsLimit: limit, searchType: 'user', addParentData: false,
    });
    const posts = usablePosts(items).map(normalizePost).sort((a, b) => b.score - a.score);
    if (posts.length === 0) {
      await Actor.pushData({ mode: 'profile', handle, ok: false, error: 'no_public_posts' });
      continue;
    }
    await Actor.pushData({
      mode: 'profile', handle, ok: true, postCount: posts.length,
      topPosts: posts.slice(0, 3), posts,
      hashtags: [...new Set(posts.flatMap((p) => p.hashtags))].slice(0, 20),
      formats: formats(posts), bestTimes: bestTimes(posts),
    });
  } catch (e) {
    log.error(`handle ${handle}: ${e.message}`);
    await Actor.pushData({ mode: 'profile', handle, ok: false, error: /TIMED-OUT/.test(e.message) ? 'scrape_timeout' : 'scrape_unavailable' });
  }
}

// Post / reel links: one batched run, expanded into image/video links.
const links = postUrls.filter(isPostUrl);
if (links.length) {
  try {
    const items = await scrape({ directUrls: links, resultsType: 'posts', resultsLimit: 50, addParentData: false });
    const media = usablePosts(items).flatMap(mediaFromPost);
    await Actor.pushData({ mode: 'media', ok: media.length > 0, error: media.length ? undefined : 'no_media', media });
  } catch (e) {
    log.error(`post urls: ${e.message}`);
    await Actor.pushData({ mode: 'media', ok: false, error: /TIMED-OUT/.test(e.message) ? 'scrape_timeout' : 'scrape_unavailable', media: [] });
  }
}

await Actor.exit();
