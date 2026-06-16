/**
 * photoDupes — lightweight "possible duplicate" detection for the photo pool.
 *
 * We can't hash pixels cheaply on every render, so we lean on signals already
 * captured at upload time:
 *
 *   1. EXIF signature — original fileSize + source width/height (see PhotoMeta).
 *      Re-uploading the same file produces byte-identical originals, so this
 *      catches "doubles" even after downscaling re-encodes the pixels.
 *   2. Exact URL — same data URL or same remote URL = literally the same image
 *      (covers photos with no EXIF, e.g. older uploads or stock).
 *
 * A photo is flagged only when it shares a signature with at least one OTHER
 * photo. Conservative by design: byte-exact fileSize makes coincidental
 * collisions between genuinely different photos extremely unlikely, so this
 * surfaces real re-uploads without crying wolf.
 */
import type { Photo } from "./photoData";

function signature(p: Photo): string | null {
  const m = p.meta;
  if (m && m.fileSize && m.width && m.height) {
    return "s:" + m.fileSize + ":" + m.width + "x" + m.height;
  }
  // No usable EXIF — fall back to exact image identity.
  return p.url ? "u:" + p.url : null;
}

/**
 * Return the set of photo ids that look like duplicates of another photo in
 * the given list. Pass the whole workspace (pool + every dump's photos) so a
 * pooled photo that duplicates one already placed in a dump is still flagged.
 */
export function findDuplicatePhotoIds(photos: Photo[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (let i = 0; i < photos.length; i++) {
    const key = signature(photos[i]);
    if (!key) continue;
    const ids = byKey.get(key);
    if (ids) ids.push(photos[i].id);
    else byKey.set(key, [photos[i].id]);
  }
  const dupes = new Set<string>();
  const groups = Array.from(byKey.values());
  for (let g = 0; g < groups.length; g++) {
    if (groups[g].length > 1) {
      for (let j = 0; j < groups[g].length; j++) dupes.add(groups[g][j]);
    }
  }
  return dupes;
}
