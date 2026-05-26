/**
 * Offline Auto Gen — build a dump without calling Claude.
 *
 * Used as an automatic fallback when the AI call fails for any reason:
 *   - 5 MB image size limit (rare now post-downscale, but possible)
 *   - 429 rate limit / 503 daily budget cap / 402 out of credits
 *   - 504 timeout / 529 overloaded
 *   - Offline / network unreachable
 *
 * Algorithm (no vision, just metadata + heuristics):
 *   1. Score every pool photo:
 *        +10 if favorited
 *        +3  if user upload (id starts with "upload-") — prefer real over stock
 *        +1  if portrait/square (better for IG)
 *        - falls back to natural order otherwise
 *   2. Bucket by category. Pick the biggest bucket as primary. If primary has
 *      < targetCount items, dip into the second-biggest for variety.
 *   3. Order the chosen photos:
 *        slot[0]     = highest-scored photo (the "hook")
 *        slot[n-1]   = second-highest (the "closer")
 *        middle      = remaining photos, shuffled by score for visual variety
 *   4. Title = "{category} — {n} slides" if single category, else category mix.
 *
 * This isn't trying to beat Claude — it's a graceful degradation so the app
 * still produces *something* useful when AI is unreachable.
 */
import type { Photo } from "./photoData";
import type { SuggestedCluster } from "@/components/AISuggestSheet";

interface ScoredPhoto {
  photo: Photo;
  score: number;
  isPortrait: boolean | null; // null = unknown (couldn't decode)
}

/** Promise-resolves with the natural orientation of an image, or null on failure. */
function probeOrientation(url: string): Promise<boolean | null> {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) return resolve(null);
      resolve(h >= w); // portrait or square = true, landscape = false
    };
    img.onerror = function() { resolve(null); };
    img.src = url;
  });
}

/**
 * Score and group a pool of photos for offline Auto Gen.
 * Returns a single SuggestedCluster ready to be passed to onCreateDumps,
 * or null if the pool is too small (need at least 2 photos).
 *
 * @param pool         all photos available in the user's pool
 * @param targetCount  desired slide count (null = auto: 6–10 depending on pool size)
 */
export async function offlineAutoGen(
  pool: Photo[],
  targetCount: number | null
): Promise<SuggestedCluster | null> {
  if (pool.length < 2) return null;

  // Probe orientations in parallel (don't block on slow images — cap at 200ms each)
  var oriPromises = pool.map(function(p) {
    return Promise.race([
      probeOrientation(p.url),
      new Promise<null>(function(resolve) { setTimeout(function() { resolve(null); }, 200); }),
    ]);
  });
  var orientations = await Promise.all(oriPromises);

  // Score
  var scored: ScoredPhoto[] = pool.map(function(p, i) {
    var score = 0;
    if (p.isFavorite) score += 10;
    if (p.id.indexOf("upload-") === 0) score += 3;
    var isPortrait = orientations[i];
    if (isPortrait === true) score += 1;
    return { photo: p, score: score, isPortrait: isPortrait };
  });

  // Determine target count if user said "auto"
  var n: number;
  if (targetCount && targetCount >= 2) {
    n = Math.min(targetCount, 20, pool.length);
  } else {
    // Heuristic: 60% of pool, clamped 6–10
    n = Math.max(2, Math.min(10, Math.max(6, Math.round(pool.length * 0.6))));
    n = Math.min(n, pool.length);
  }

  // Bucket by category
  var buckets: Record<string, ScoredPhoto[]> = {};
  for (var i = 0; i < scored.length; i++) {
    var cat = scored[i].photo.category || "Uncategorized";
    if (!buckets[cat]) buckets[cat] = [];
    buckets[cat].push(scored[i]);
  }
  var bucketList = Object.keys(buckets)
    .map(function(k) { return { cat: k, photos: buckets[k] }; })
    .sort(function(a, b) { return b.photos.length - a.photos.length; });

  // Pick photos: primary bucket first (sorted by score desc), then secondary if needed
  var picked: ScoredPhoto[] = [];
  var usedIds: Record<string, boolean> = {};
  for (var b = 0; b < bucketList.length && picked.length < n; b++) {
    var sorted = bucketList[b].photos.slice().sort(function(x, y) { return y.score - x.score; });
    for (var j = 0; j < sorted.length && picked.length < n; j++) {
      if (!usedIds[sorted[j].photo.id]) {
        picked.push(sorted[j]);
        usedIds[sorted[j].photo.id] = true;
      }
    }
  }

  if (picked.length < 2) return null;

  // Order: hook (highest score), closer (second highest), middle shuffled.
  // Sort by score desc, then split.
  picked.sort(function(a, b) { return b.score - a.score; });
  var hook = picked[0];
  var closer = picked.length >= 3 ? picked[1] : null;
  var middle = picked.length >= 3 ? picked.slice(2) : picked.slice(1);

  // Light shuffle of the middle so consecutive runs feel different
  for (var s = middle.length - 1; s > 0; s--) {
    var k = Math.floor(Math.random() * (s + 1));
    var tmp = middle[s]; middle[s] = middle[k]; middle[k] = tmp;
  }

  var ordered: ScoredPhoto[] = [hook].concat(middle);
  if (closer) ordered.push(closer);

  // Title — single category vs mix
  var primaryCat = bucketList[0].cat;
  var usedCats: Record<string, boolean> = {};
  for (var p2 = 0; p2 < ordered.length; p2++) {
    usedCats[ordered[p2].photo.category || "Uncategorized"] = true;
  }
  var catCount = Object.keys(usedCats).length;
  var title: string;
  var subtitle: string;
  if (catCount === 1) {
    title = primaryCat === "Uncategorized" ? "Untitled Dump" : primaryCat + " Edit";
    subtitle = ordered.length + " slides";
  } else {
    title = primaryCat + " + more";
    subtitle = ordered.length + " slides · " + catCount + " vibes";
  }

  return {
    name: title,
    subtitle: subtitle,
    photoIds: ordered.map(function(o) { return o.photo.id; }),
  };
}
