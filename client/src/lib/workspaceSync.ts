/**
 * Workspace cloud sync — OWNER ACCOUNT ONLY (beta).
 *
 * Mirrors the dumps+pool workspace to Supabase so the owner sees the same
 * photos on every device. Scope is intentionally limited to IS_OWNER builds:
 * regular users stay device-local, so the "photos never leave your device"
 * privacy promise in Terms/Privacy is unchanged for them.
 *
 * Storage model:
 *   - Image bytes      → Supabase Storage bucket `user-photos` at
 *                        `{userId}/{photoId}.jpg` (public-read; consistent with
 *                        the owner's existing public CloudFront photos).
 *   - Workspace layout → Postgres table `workspaces` (one row per user),
 *                        holding dumps/pool JSON with CLOUD urls only — never
 *                        base64. Bytes live in Storage, references live here.
 *
 * SAFETY: every Supabase call is wrapped. If the bucket/table don't exist yet
 * (backend not provisioned), or any network error occurs, these functions
 * no-op and the app silently falls back to the existing device-local behavior.
 * Nothing here can break the live app when the backend is absent.
 *
 * Backend setup required before this does anything: see
 * docs/SETUP_PHOTO_SYNC.md (creates the bucket + table + RLS).
 */
import { supabase } from "./supabase";
import { IS_OWNER, type Dump, type Photo } from "./photoData";

var BUCKET = "user-photos";
var TABLE = "workspaces";

/** True only when sync should run at all. */
function syncEnabled(userId: string | null): userId is string {
  return IS_OWNER && !!userId;
}

/** A url we can store cross-device as-is (already hosted somewhere). */
function isCloudUrl(url: string): boolean {
  return url.indexOf("http://") === 0 || url.indexOf("https://") === 0;
}

/** Decode a `data:` URL into a Blob for upload. Returns null on bad input. */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    var comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    var header = dataUrl.slice(0, comma);
    var b64 = dataUrl.slice(comma + 1);
    var mimeMatch = header.match(/data:([^;]+)/);
    var mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    var binary = atob(b64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Ensure a single photo's bytes live in cloud storage and return a copy whose
 * `url` is a cloud url. If the photo is already a cloud url, returns it
 * unchanged. If it's a `data:`/blob url, uploads to Storage and swaps the url.
 * On ANY failure returns null — caller drops the photo from the cloud copy so
 * we never persist base64 into the DB row.
 */
async function cloudifyPhoto(userId: string, photo: Photo): Promise<Photo | null> {
  if (isCloudUrl(photo.url)) return photo;
  var blob = dataUrlToBlob(photo.url);
  if (!blob) return null;
  var path = userId + "/" + photo.id + ".jpg";
  try {
    var up = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
    if (up.error) return null;
    var pub = supabase.storage.from(BUCKET).getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : "";
    if (!url) return null;
    return { id: photo.id, url: url, alt: photo.alt, isFavorite: photo.isFavorite, category: photo.category, meta: photo.meta };
  } catch {
    return null;
  }
}

/** Cloudify a list of photos, dropping any that fail to upload. */
async function cloudifyPhotos(userId: string, photos: Photo[]): Promise<Photo[]> {
  var out: Photo[] = [];
  for (var i = 0; i < photos.length; i++) {
    var c = await cloudifyPhoto(userId, photos[i]);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Load the owner's workspace from the cloud. Returns null if sync is disabled,
 * the row doesn't exist, the backend isn't provisioned, or on any error — the
 * caller then keeps whatever device-local state it already has.
 */
export async function loadWorkspace(
  userId: string | null
): Promise<{ dumps: Dump[]; pool: Photo[] } | null> {
  if (!syncEnabled(userId)) return null;
  try {
    var res = await supabase
      .from(TABLE)
      .select("dumps, pool")
      .eq("user_id", userId)
      .maybeSingle();
    if (res.error || !res.data) return null;
    var dumps = Array.isArray(res.data.dumps) ? (res.data.dumps as Dump[]) : null;
    var pool = Array.isArray(res.data.pool) ? (res.data.pool as Photo[]) : null;
    if (!dumps || !pool) return null;
    return { dumps: dumps, pool: pool };
  } catch {
    return null;
  }
}

/**
 * Save the owner's workspace to the cloud NOW (uploads any new photo bytes
 * first, then upserts the layout JSON with cloud urls only). Safe no-op when
 * sync is disabled or the backend is missing.
 */
export async function saveWorkspaceNow(
  userId: string | null,
  dumps: Dump[],
  pool: Photo[]
): Promise<void> {
  if (!syncEnabled(userId)) return;
  try {
    var cloudDumps: Dump[] = [];
    for (var i = 0; i < dumps.length; i++) {
      var d = dumps[i];
      var photos = await cloudifyPhotos(userId, d.photos);
      cloudDumps.push({
        id: d.id, number: d.number, title: d.title, subtitle: d.subtitle,
        photos: photos, captions: d.captions, vibe: d.vibe,
        favorited: d.favorited, rating: d.rating, chatHistory: d.chatHistory,
      });
    }
    var cloudPool = await cloudifyPhotos(userId, pool);
    var up = await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, dumps: cloudDumps, pool: cloudPool, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (up.error) {
      // Most likely: table not created yet. Stay quiet — device-local still works.
      console.warn("[workspaceSync] save skipped:", up.error.message);
    }
  } catch (e) {
    console.warn("[workspaceSync] save failed:", e);
  }
}

// ── Debounced save ──────────────────────────────────────────────────────────
// Photo uploads are heavy, so debounce generously. Caller fires this on every
// dumps/pool change; we coalesce to one save 4s after the last edit.

var _timer: ReturnType<typeof setTimeout> | null = null;
var _pending: { userId: string; dumps: Dump[]; pool: Photo[] } | null = null;

export function scheduleWorkspaceSave(
  userId: string | null,
  dumps: Dump[],
  pool: Photo[]
): void {
  if (!syncEnabled(userId)) return;
  _pending = { userId: userId, dumps: dumps, pool: pool };
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(function () {
    _timer = null;
    var p = _pending;
    _pending = null;
    if (p) saveWorkspaceNow(p.userId, p.dumps, p.pool);
  }, 4000);
}

/** Force any pending save immediately (call on tab close). */
export function flushWorkspaceSave(): void {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  var p = _pending;
  _pending = null;
  if (p) saveWorkspaceNow(p.userId, p.dumps, p.pool);
}
