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

export const config = { runtime: "nodejs", maxDuration: 30, memory: 512 };

var BUCKET = "workspace-uploads";

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

    var comma = dataUrl.indexOf(",");
    if (comma < 0) return json(400, { error: "Malformed data URL", code: "bad_data_url" });
    var header = dataUrl.slice(0, comma);
    var mime = (header.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    var ext = mime.indexOf("png") >= 0 ? "png" : mime.indexOf("webp") >= 0 ? "webp" : "jpg";
    var buf = Buffer.from(dataUrl.slice(comma + 1), "base64");
    var path = userId + "/" + id + "." + ext;

    var up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
    if (up.error) return json(502, { error: "Upload failed", code: "storage_error" });

    var pub = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    var url = pub && pub.data ? pub.data.publicUrl : null;
    if (!url) return json(502, { error: "No public URL", code: "no_url" });

    return json(200, { url: url });
  } catch (e) {
    return json(500, { error: "Server error", code: "server_error" });
  }
}
