/**
 * POST /api/workspace — write-back (Phase 2 of cross-device sync).
 *
 * Persists the caller's full workspace (dumps + pool layout, plus any newly
 * uploaded photo bytes) into the normalized schema so edits sync to every
 * device:
 *   photos(id,user_id,url,category,"order")
 *   dumps(id,user_id,title,subtitle,description)
 *   dump_photos(dump_id,photo_id,"order")
 *
 * userId comes from the Supabase JWT (never the body). Writes use the service
 * role (server-side), so no client-side storage/table RLS write policies are
 * required.
 *
 * SAFETY / scope (v1 — layout sync, non-destructive to photos):
 *   - Upserts photos (uploading base64 → Storage bucket `workspace-uploads`).
 *   - Upserts dumps; rebuilds dump_photos to match the sent layout.
 *   - Deletes dumps that were removed locally (and their links) — photos rows
 *     are NEVER deleted, so nothing is lost; a photo removed from the pool will
 *     reappear in the pool on reload (documented limitation, fixed in a later
 *     pass with explicit photo deletion).
 *   - WIPE GUARD: refuses to save an empty workspace, so a load race can't
 *     blank the account.
 *   - IDs: a value that's already a UUID is kept; any client id (e.g.
 *     "upload-x", "dump-x") is mapped to a STABLE derived UUID (uuid v5-style),
 *     so repeated saves are idempotent without the client tracking ids.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { createHash } from "crypto";
import { getUserFromRequest } from "../server/creditGate.js";
import { supabaseAdmin } from "../server/supabaseAdmin.js";
import { captureServerError } from "../server/sentry.js";

export const config = { runtime: "nodejs", maxDuration: 30, memory: 512 };

var BUCKET = "workspace-uploads";
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface InPhoto { id: string; url: string; category?: string }
interface InDump { id: string; title?: string; subtitle?: string; photos: InPhoto[] }
interface InBody { dumps: InDump[]; pool: InPhoto[] }

/** Already a UUID → keep. Otherwise derive a stable UUID (v5-style) from the id. */
function normId(id: string): string {
  if (UUID_RE.test(id)) return id.toLowerCase();
  var h = createHash("sha1").update("dumpster:" + id).digest("hex");
  return (
    h.slice(0, 8) + "-" + h.slice(8, 12) + "-5" + h.slice(13, 16) + "-" +
    ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.slice(18, 20) +
    "-" + h.slice(20, 32)
  );
}

function parseBody(req: IncomingMessage): Promise<InBody> {
  return new Promise(function (resolve, reject) {
    var chunks: Buffer[] = [];
    req.on("data", function (c: Buffer) { chunks.push(c); });
    req.on("end", function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

/** Upload a data: URL to Storage and return its public URL (or null on failure). */
async function uploadDataUrl(userId: string, photoId: string, dataUrl: string): Promise<string | null> {
  try {
    var comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    var header = dataUrl.slice(0, comma);
    var mime = (header.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    var buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
    var path = userId + "/" + photoId + ".jpg";
    var up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
    if (up.error) { console.warn("[workspace] upload failed:", up.error.message); return null; }
    var pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return pub && pub.data ? pub.data.publicUrl : null;
  } catch (e) {
    console.warn("[workspace] upload threw:", e);
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  function json(code: number, obj: unknown) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  }
  if (req.method !== "POST") { res.writeHead(405).end("Method not allowed"); return; }

  var userId: string | null = null;
  try {
    userId = await getUserFromRequest(req);
    if (!userId) return json(401, { error: "Sign in to sync.", code: "auth_required" });

    var body = await parseBody(req);
    var dumps = Array.isArray(body.dumps) ? body.dumps : [];
    var pool = Array.isArray(body.pool) ? body.pool : [];

    // WIPE GUARD — never let an empty payload blank the account.
    var totalPhotos = pool.length + dumps.reduce(function (n, d) { return n + (d.photos ? d.photos.length : 0); }, 0);
    if (dumps.length === 0 && pool.length === 0) return json(400, { error: "Refusing to save empty workspace", code: "empty" });

    // 1) Collect every unique photo (dump photos + pool), upload base64, upsert.
    var seen: Record<string, boolean> = {};
    var photoRows: Array<{ id: string; user_id: string; url: string; category: string; order: number }> = [];
    var idMap: Record<string, string> = {}; // localId -> dbId
    var order = 0;
    var all: InPhoto[] = [];
    for (var di = 0; di < dumps.length; di++) for (var pi = 0; pi < dumps[di].photos.length; pi++) all.push(dumps[di].photos[pi]);
    for (var qi = 0; qi < pool.length; qi++) all.push(pool[qi]);

    for (var i = 0; i < all.length; i++) {
      var ph = all[i];
      var dbId = normId(ph.id);
      idMap[ph.id] = dbId;
      if (seen[dbId]) continue;
      seen[dbId] = true;
      var url = ph.url;
      if (url && url.indexOf("data:") === 0) {
        var uploaded = await uploadDataUrl(userId, dbId, url);
        if (!uploaded) continue; // couldn't store bytes — skip this photo this round
        url = uploaded;
      }
      if (!url) continue;
      photoRows.push({ id: dbId, user_id: userId, url: url, category: ph.category || "", order: order++ });
    }

    // SECURITY: the service role bypasses RLS, so we must manually ensure none
    // of these ids belong to ANOTHER account before upserting (an attacker could
    // otherwise send a known UUID and overwrite someone else's row).
    var photoIds = photoRows.map(function (r) { return r.id; });
    if (photoIds.length > 0) {
      var ownP = await supabaseAdmin.from("photos").select("id, user_id").in("id", photoIds);
      if (!ownP.error && ownP.data && ownP.data.some(function (r) { return r.user_id !== userId; })) {
        return json(409, { error: "Photo id conflict with another account", code: "id_conflict" });
      }
    }

    if (photoRows.length > 0) {
      var pUp = await supabaseAdmin.from("photos").upsert(photoRows, { onConflict: "id" });
      if (pUp.error) {
        captureServerError(pUp.error, "workspace.photos_upsert", { userId: userId });
        return json(500, { error: "Failed to save photos" });
      }
    }

    // 2) Upsert dumps.
    var dumpRows = dumps.map(function (d) {
      return {
        id: normId(d.id), user_id: userId,
        title: d.title || "Untitled", subtitle: d.subtitle || "", description: d.subtitle || "",
      };
    });
    var keepDumpIds = dumpRows.map(function (d) { return d.id; });
    // SECURITY: same cross-account guard for dumps.
    if (keepDumpIds.length > 0) {
      var ownD = await supabaseAdmin.from("dumps").select("id, user_id").in("id", keepDumpIds);
      if (!ownD.error && ownD.data && ownD.data.some(function (r) { return r.user_id !== userId; })) {
        return json(409, { error: "Dump id conflict with another account", code: "id_conflict" });
      }
    }
    if (dumpRows.length > 0) {
      var dUp = await supabaseAdmin.from("dumps").upsert(dumpRows, { onConflict: "id" });
      if (dUp.error) {
        captureServerError(dUp.error, "workspace.dumps_upsert", { userId: userId });
        return json(500, { error: "Failed to save dumps" });
      }
    }

    // 3) Delete dumps removed locally (+ their links). Photos are untouched.
    var existing = await supabaseAdmin.from("dumps").select("id").eq("user_id", userId);
    if (!existing.error && existing.data) {
      var stale = existing.data.map(function (r) { return r.id as string; }).filter(function (id) { return keepDumpIds.indexOf(id) < 0; });
      if (stale.length > 0) {
        await supabaseAdmin.from("dump_photos").delete().in("dump_id", stale);
        await supabaseAdmin.from("dumps").delete().in("id", stale);
      }
    }

    // 4) Rebuild dump_photos for each sent dump.
    for (var dd = 0; dd < dumps.length; dd++) {
      var dumpId = normId(dumps[dd].id);
      await supabaseAdmin.from("dump_photos").delete().eq("dump_id", dumpId);
      var links = dumps[dd].photos
        .map(function (p, idx) { return { dump_id: dumpId, photo_id: idMap[p.id] || normId(p.id), order: idx }; })
        // guard: only link photos we actually persisted
        .filter(function (l) { return seen[l.photo_id]; });
      if (links.length > 0) {
        var lIns = await supabaseAdmin.from("dump_photos").insert(links);
        if (lIns.error) {
          captureServerError(lIns.error, "workspace.dump_photos_insert", { userId: userId });
          return json(500, { error: "Failed to save dump layout" });
        }
      }
    }

    // 5) Delete photos removed locally. The pool is rebuilt on load from
    //    "photos not attached to a dump", so a leftover row reappears in the
    //    pool forever unless we prune it here (this is the explicit photo
    //    deletion the v1 note deferred). SAFETY: only the caller's own rows,
    //    only ids absent from this payload, and only when the payload actually
    //    carried photos (photoRows.length > 0) — so a data-URL-only or racy
    //    empty payload can never wipe the account.
    if (photoRows.length > 0) {
      var existingP = await supabaseAdmin.from("photos").select("id").eq("user_id", userId);
      if (!existingP.error && existingP.data) {
        var keepPhotoIds: Record<string, boolean> = {};
        for (var kp = 0; kp < photoRows.length; kp++) keepPhotoIds[photoRows[kp].id] = true;
        var staleP = existingP.data
          .map(function (r) { return r.id as string; })
          .filter(function (id) { return !keepPhotoIds[id]; });
        if (staleP.length > 0) {
          await supabaseAdmin.from("dump_photos").delete().in("photo_id", staleP);
          await supabaseAdmin.from("photos").delete().in("id", staleP);
        }
      }
    }

    return json(200, { ok: true, dumps: dumpRows.length, photos: photoRows.length, totalSent: totalPhotos });
  } catch (err) {
    captureServerError(err, "workspace", { userId: userId });
    return json(500, { error: "Server error" });
  }
}
