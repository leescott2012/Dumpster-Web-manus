/**
 * Best posting day / hour from a creator's scraped posts. Deterministic, no extra API cost.
 * Instagram timestamps are UTC (no per-post offset in the scrape), so the line says UTC.
 */
export const MIN_POSTS_FOR_BEST_TIMES = 8;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function bestTimesLine(posts: { postedAt: string; engagementScore: number }[]): string {
  const dated: { t: Date; s: number }[] = [];
  for (const p of posts) {
    // ISO string, or unix seconds from some scraper versions
    const raw = /^\d{9,10}$/.test(p.postedAt) ? Number(p.postedAt) * 1000 : Date.parse(p.postedAt);
    if (Number.isFinite(raw)) dated.push({ t: new Date(raw), s: p.engagementScore });
  }
  if (dated.length < MIN_POSTS_FOR_BEST_TIMES) return "";

  // ponytail: mean score per bucket, buckets need >=2 posts; no significance test.
  const best = (key: (d: Date) => number): number | null => {
    const agg = new Map<number, { sum: number; n: number }>();
    for (const { t, s } of dated) {
      const a = agg.get(key(t)) ?? { sum: 0, n: 0 };
      a.sum += s; a.n++;
      agg.set(key(t), a);
    }
    let top: number | null = null, topMean = -1;
    agg.forEach((a, k) => {
      if (a.n >= 2 && a.sum / a.n > topMean) { topMean = a.sum / a.n; top = k; }
    });
    return top;
  };

  const day = best((d) => d.getUTCDay());
  const block = best((d) => Math.floor(d.getUTCHours() / 3)); // 3-hour windows
  const parts: string[] = [];
  if (day !== null) parts.push(DAYS[day] + "s");
  if (block !== null) parts.push(`${String(block * 3).padStart(2, "0")}:00-${String(block * 3 + 3).padStart(2, "0")}:00 UTC`);
  return parts.length ? `Best times to post: ${parts.join(", ")} (from ${dated.length} posts).` : "";
}
