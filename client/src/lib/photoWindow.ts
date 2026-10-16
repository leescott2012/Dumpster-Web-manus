/**
 * AI Suggest only sends MAX photos per run (vision cost + Vercel's 4.5MB body
 * limit). Instead of always sending the same first N, each run takes the next
 * window of N, wrapping around, so repeated "New Suggestion" runs cover the
 * whole pool.
 */
export function pickPhotoWindow<T>(photos: T[], size: number, windowIndex: number): T[] {
  if (photos.length <= size) return photos.slice();
  var start = (Math.max(0, windowIndex) * size) % photos.length;
  var out: T[] = [];
  for (var i = 0; i < size; i++) out.push(photos[(start + i) % photos.length]);
  return out;
}
