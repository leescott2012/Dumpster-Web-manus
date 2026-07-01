/**
 * POST /api/upload-photo — store ONE photo's bytes in Supabase Storage.
 *
 * Called at import time (right when a signed-in user adds a photo) so every
 * photo's bytes live in the cloud immediately. Returns the public HTTPS URL,
 * which the client stores in place of the data URL.
 *
 * Why per-photo (not bundled into /api/workspace): bundling every photo's
 * base64 into one JSON request blows past Vercel's 4.5 MB body limit once you
 * have a handful of photos, so the whole save fails and nothing persists.
 * Uploading one photo per request keeps each body tiny (~1 MB) and lets the
 * workspace JSON carry only small HTTPS URLs.
 *
 * userId comes from the Supabase JWT (never the body). Writes use the service
 * role server-side, so no client-side Storage RLS write policy is required.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { getUserFromRequest } from "../server/creditGate.js";
import { supabaseAdmin } from "../server/supabaseAdmin.js";
import { captureServerError } from "../server/sentry.js";

export const config = { runtime: "nodejs", maxDuration: 30, memory: 512 };

var BUCKET = "workspace-uploads";

// Hard cap on decoded bytes — a photo has no legitimate reason to exceed this
// (client downscales before upload); also bounds memory/storage-cost abuse.
var MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// Only these mime types are ever accepted, and (security audit, 2026-07-01)
// the decoded bytes' own magic number must match the claimed type — the data
// URL header alone is caller-supplied and was previously trusted as-is,
// letting someone label arbitrary bytes (e.g. SVG/HTML) as an image and have
// Storage serve them back with that same claimed Content-Type.
var MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  "image/jpeg": function (b) { return b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF; },
  "image/png": function (b) { return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47; },
  "image/webp": function (b) {
    return b.length >= 12 && b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP";
  },
  "image/gif": function (b) {
    return b.length >= 6 && (b.slice(0, 6).toString("ascii") === "GIF87a" || b.slice(0, 6).toString("ascii") === "GIF89a");
  },
};

// Storage path is `${userId}/${id}.${ext}` — id must be safe to splice into a
// path with no traversal (`../`), no separators, no null bytes.
var SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/;

interface InBody { id?: string; dataUrl?: string }

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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  function json(code: number, obj: unknown) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  }
  if (req.method !== "POST") { res.writeHead(405).end("Method not allowed"); return; }

  try {
    var userId = await getUserFromRequest(req);
    if (!userId) return json(401, { error: "Sign in to sync.", code: "auth_required" });

    var body = await parseBody(req);
    var id = typeof body.id === "string" ? body.id : "";
    var dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
    if (!id || dataUrl.indexOf("data:") !== 0) {
      return json(400, { error: "Expected { id, dataUrl }", code: "bad_request" });
    }
    if (!SAFE_ID.test(id)) {
      return json(400, { error: "Invalid id", code: "bad_id" });
    }

    var comma = dataUrl.indexOf(",");
    if (comma < 0) return json(400, { error: "Malformed data URL", code: "bad_data_url" });
    var header = dataUrl.slice(0, comma);
    var mime = (header.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    if (!Object.prototype.hasOwnProperty.call(MAGIC_BYTES, mime)) {
      return json(400, { error: "Unsupported image type", code: "bad_mime" });
    }

    // Base64 expands ~4/3x, so this is a cheap pre-check before the (more
    // expensive) actual decode below.
    var base64Body = dataUrl.slice(comma + 1);
    if (base64Body.length > MAX_UPLOAD_BYTES * 1.4) {
      return json(413, { error: "Image too large", code: "too_large" });
    }
    var buf = Buffer.from(base64Body, "base64");
    if (buf.length > MAX_UPLOAD_BYTES) {
      return json(413, { error: "Image too large", code: "too_large" });
    }
    if (!MAGIC_BYTES[mime](buf)) {
      return json(400, { error: "File content doesn't match declared image type", code: "mime_mismatch" });
    }

    var ext = mime.indexOf("png") >= 0 ? "png" : mime.indexOf("webp") >= 0 ? "webp" : mime.indexOf("gif") >= 0 ? "gif" : "jpg";
    var path = userId + "/" + id + "." + ext;

    var up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
    if (up.error) {
      captureServerError(up.error, "upload-photo", { userId: userId, code: "storage_error" });
      return json(502, { error: "Upload failed", code: "storage_error" });
    }

    var pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : null;
    if (!url) return json(502, { error: "No public URL", code: "no_url" });

    return json(200, { url: url });
  } catch (e) {
    captureServerError(e, "upload-photo");
    return json(500, { error: "Server error", code: "server_error" });
  }
}
