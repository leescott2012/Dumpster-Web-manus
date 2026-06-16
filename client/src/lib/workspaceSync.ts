/**
 * Workspace cloud sync — OWNER ACCOUNT ONLY (beta).
 *
 * Reads the owner's dumps + photos from the EXISTING normalized Supabase
 * schema so the same content shows on every device:
 *
 *   photos(id, user_id, url, category, "order")
 *   dumps(id, user_id, title, subtitle, description)
 *   dump_photos(id, dump_id, photo_id, "order")   -- junction, ordered
 *
 * Pool = the user's photos that aren't attached to any dump.
 *
 * SCOPE: read-only for now (Phase 1). This makes already-synced content appear
 * cross-device without any risk to the seeded data. Writing local edits back to
 * the normalized tables is Phase 2 (see scheduleWorkspaceSave stub below).
 *
 * SAFETY: every call is wrapped. If RLS blocks the read, the tables are empty,
 * or anything errors, loadWorkspace returns null and the app keeps its existing
 * device-local state. Nothing here can break the live app.
 */
import { supabase } from "./supabase";
import { type Dump, type Photo } from "./photoData";

// Sync runs for ANY signed-in user. RLS scopes every query to the user's own
// rows, so a user only ever loads their own workspace. Users without a cloud
// workspace get an empty result and keep their device-local state. No special
// "?owner=1" link is required — logging in is enough.
function syncEnabled(userId: string | null): userId is string {
  return !!userId;
}

interface PhotoRow { id: string; url: string; category: string | null; order: number | null; }
interface DumpRow { id: string; title: string | null; subtitle: string | null; description: string | null; }
interface DumpPhotoRow { dump_id: string; photo_id: string; order: number | null; }

function toPhoto(r: PhotoRow): Photo {
  return { id: r.id, url: r.url, alt: "", isFavorite: false, category: r.category || "" };
}

/**
 * Load the owner's workspace from the existing tables. Returns null when sync
 * is disabled, nothing is found, or on any error — caller keeps device-local.
 */
export async function loadWorkspace(
  userId: string | null
): Promise<{ dumps: Dump[]; pool: Photo[] } | null> {
  if (!syncEnabled(userId)) return null;
  try {
    var photosRes = await supabase
      .from("photos")
      .select("id, url, category, order")
      .eq("user_id", userId);
    if (photosRes.error) return null;
    var photoRows = (photosRes.data || []) as PhotoRow[];
    if (photoRows.length === 0) return null; // nothing seeded → don't wipe local

    var dumpsRes = await supabase
      .from("dumps")
      .select("id, title, subtitle, description")
      .eq("user_id", userId);
    if (dumpsRes.error) return null;
    var dumpRows = (dumpsRes.data || []) as DumpRow[];

    // Junction rows for this user's dumps (filter client-side by known dump ids).
    var dumpIds = dumpRows.map(function (d) { return d.id; });
    var links: DumpPhotoRow[] = [];
    if (dumpIds.length > 0) {
      var linkRes = await supabase
        .from("dump_photos")
        .select("dump_id, photo_id, order")
        .in("dump_id", dumpIds);
      if (linkRes.error) return null;
      links = (linkRes.data || []) as DumpPhotoRow[];
    }

    var photoById: Record<string, PhotoRow> = {};
    for (var i = 0; i < photoRows.length; i++) photoById[photoRows[i].id] = photoRows[i];

    var usedPhotoIds = new Set<string>();
    var linksByDump: Record<string, DumpPhotoRow[]> = {};
    for (var j = 0; j < links.length; j++) {
      var ln = links[j];
      if (!linksByDump[ln.dump_id]) linksByDump[ln.dump_id] = [];
      linksByDump[ln.dump_id].push(ln);
      usedPhotoIds.add(ln.photo_id);
    }

    var dumps: Dump[] = dumpRows.map(function (d, idx): Dump {
      var dl = (linksByDump[d.id] || []).slice().sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
      var photos: Photo[] = [];
      for (var k = 0; k < dl.length; k++) {
        var pr = photoById[dl[k].photo_id];
        if (pr) photos.push(toPhoto(pr));
      }
      return {
        id: d.id,
        number: idx + 1,
        title: d.title || "Untitled",
        subtitle: d.subtitle || d.description || "",
        photos: photos,
      };
    });

    // Pool = photos not attached to any dump, ordered by their "order".
    var pool: Photo[] = photoRows
      .filter(function (p) { return !usedPhotoIds.has(p.id); })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      .map(toPhoto);

    return { dumps: dumps, pool: pool };
  } catch {
    return null;
  }
}

// ── Phase 2: write-back ─────────────────────────────────────────────────────
// Local edits (reorder, move, rename, create/delete dump, new uploads) are
// pushed to /api/workspace, which reconciles them into the normalized tables
// and uploads any new photo bytes to Storage (service role, server-side).
// Saves are debounced; the server has a wipe-guard against empty payloads.

import { getAuthHeaders } from "./supabase";

function isCloudUrl(url: string) { return url.startsWith("http"); }

function serialize(dumps: Dump[], pool: Photo[]) {
  // Data-URL photos are too large for the workspace JSON (hits Vercel's 4.5 MB
  // body limit fast). They live in IndexedDB only; only HTTPS-URL photos sync.
  return {
    dumps: dumps.map(function (d) {
      return {
        id: d.id, title: d.title, subtitle: d.subtitle,
        photos: d.photos
          .filter(function (p) { return isCloudUrl(p.url); })
          .map(function (p) { return { id: p.id, url: p.url, category: p.category }; }),
      };
    }),
    pool: pool
      .filter(function (p) { return isCloudUrl(p.url); })
      .map(function (p) { return { id: p.id, url: p.url, category: p.category }; }),
  };
}

export async function saveWorkspaceNow(
  userId: string | null,
  dumps: Dump[],
  pool: Photo[]
): Promise<void> {
  if (!syncEnabled(userId)) return;
  // Client-side wipe guard mirrors the server's — never push an empty workspace.
  if (dumps.length === 0 && pool.length === 0) return;
  try {
    var headers = await getAuthHeaders();
    if (!headers.Authorization) return; // not signed in → nothing to sync
    await fetch("/api/workspace", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify(serialize(dumps, pool)),
      keepalive: true,
    });
  } catch (e) {
    console.warn("[workspaceSync] save failed:", e);
  }
}

/**
 * Upload one photo's bytes to Supabase Storage at import time and return its
 * public HTTPS URL. Returns null when not signed in, the url isn't a data URL,
 * or anything fails — caller keeps the data URL (device-local fallback).
 */
export async function uploadPhotoToCloud(id: string, dataUrl: string): Promise<string | null> {
  if (!dataUrl || dataUrl.indexOf("data:") !== 0) return null;
  try {
    var headers = await getAuthHeaders();
    if (!headers.Authorization) return null; // guest → stays local
    var res = await fetch("/api/upload-photo", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ id: id, dataUrl: dataUrl }),
    });
    if (!res.ok) return null;
    var data = await res.json();
    return data && typeof data.url === "string" ? data.url : null;
  } catch {
    return null;
  }
}

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
    var p = _pending; _pending = null;
    if (p) saveWorkspaceNow(p.userId, p.dumps, p.pool);
  }, 4000);
}

export function flushWorkspaceSave(): void {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  var p = _pending; _pending = null;
  if (p) saveWorkspaceNow(p.userId, p.dumps, p.pool);
}
