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
  if (m && m.fileSize) {
    // fileSize is byte-exact, so it alone catches a re-uploaded file even when
    // the cloud URL differs. Append dimensions when we have them to make
    // coincidental same-size collisions between different photos essentially nil.
    if (m.width && m.height) return "s:" + m.fileSize + ":" + m.width + "x" + m.height;
    return "s:" + m.fileSize;
  }
  // No metadata at all (e.g. videos) — fall back to exact image identity.
  return p.url ? "u:" + p.url : null;
}

/**
 * Return the set of photo ids that look like duplicates of another photo in
 * the given list. Pass the whole workspace (pool + every dump's photos) so a
 * pooled photo that duplicates one already placed in a dump is still flagged.
 *
 * Optionally pass `hashById` (photo id → perceptual aHash) to also group
 * visually-identical photos whose bytes differ — e.g. mobile Safari re-encodes
 * on every upload, so the byte-exact EXIF signature misses them (bug report
 * 2026-07-10). Compute hashes with `hashMissingPhotos` below.
 */
export function findDuplicatePhotoIds(photos: Photo[], hashById?: Map<string, string>): Set<string> {
  const byKey = new Map<string, string[]>();
  const add = (key: string, id: string) => {
    const ids = byKey.get(key);
    if (ids) ids.push(id);
    else byKey.set(key, [id]);
  };
  for (let i = 0; i < photos.length; i++) {
    const key = signature(photos[i]);
    if (key) add(key, photos[i].id);
    const hash = hashById ? hashById.get(photos[i].id) : undefined;
    if (hash) add("h:" + hash, photos[i].id);
  }
  const dupes = new Set<string>();
  const groups = Array.from(byKey.values());
  for (let g = 0; g < groups.length; g++) {
    if (groups[g].length > 1) {
      // Same photo can sit in both an EXIF group and a hash group — Set dedupes.
      for (let j = 0; j < groups[g].length; j++) dupes.add(groups[g][j]);
    }
  }
  return dupes;
}

// ── Perceptual hash (aHash) ──────────────────────────────────────────────────
// 8×8 grayscale average hash: identical for byte-different re-encodes of the
// same photo; different photos essentially never agree on all 64 bits.

function loadImageForHash(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed to read pixels from cloud (Supabase) URLs without tainting the canvas.
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = url;
  });
}

async function aHash(url: string): Promise<string | null> {
  try {
    const img = await loadImageForHash(url);
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    const gray: number[] = [];
    for (let i = 0; i < 64; i++) {
      gray.push(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    }
    const avg = gray.reduce((a, b) => a + b, 0) / 64;
    let hash = "";
    for (let i = 0; i < 64; i += 4) {
      let nibble = 0;
      for (let b = 0; b < 4; b++) if (gray[i + b] >= avg) nibble |= 1 << b;
      hash += nibble.toString(16);
    }
    return hash;
  } catch {
    return null; // CORS-tainted, video, undecodable — skip; EXIF sig still applies
  }
}

/**
 * Fill `cache` (photo id → aHash) for photos not yet hashed. Skips videos.
 * Decodes sequentially to avoid jank; call fire-and-forget and re-run
 * findDuplicatePhotoIds when it resolves true. Failed hashes are cached as ""
 * so they aren't retried on every call.
 */
export async function hashMissingPhotos(photos: Photo[], cache: Map<string, string>): Promise<boolean> {
  let added = false;
  for (const p of photos) {
    if (p.category === "Video" || cache.has(p.id) || !p.url) continue;
    const h = await aHash(p.url);
    cache.set(p.id, h === null ? "" : h);
    if (h) added = true;
  }
  return added;
}
