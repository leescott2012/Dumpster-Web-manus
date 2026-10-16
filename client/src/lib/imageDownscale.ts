/**
 * Client-side image downscaling.
 *
 * Why this exists:
 *  - Claude Vision API rejects images > 5 MB; iPhone JPEGs routinely exceed this.
 *  - localStorage caps around 5–10 MB per origin; full-res photos blow that fast.
 *  - IG carousels publish at 1080×1350, so storing > 2048px is wasted bytes.
 *
 * Strategy: scale to max 2048px (callers pass 1600 on phones) on the long
 * side, re-encode as JPEG 0.85 (≈ 300–800 KB for a typical iPhone photo).
 */

export var MAX_DIMENSION = 2048;
var JPEG_QUALITY = 0.85;

/**
 * Read a File as a data URL — used as the no-resize fallback path.
 */
function readAsDataURL(file: Blob): Promise<string> {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var result = e.target && e.target.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("FileReader returned no string"));
    };
    reader.onerror = function() { reject(reader.error || new Error("FileReader error")); };
    reader.readAsDataURL(file);
  });
}

/**
 * Load a data URL into an HTMLImageElement and resolve with its natural size.
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function() { reject(new Error("Image decode failed")); };
    img.src = dataUrl;
  });
}

export var HEIC_UNSUPPORTED = "heic-unsupported";

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(function(resolve) { canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY); });
}

/**
 * Downscale an image File to a JPEG data URL, plus the original (oriented)
 * dimensions so the EXIF step doesn't decode the photo a second time.
 *
 * Memory-lean on purpose — iPhone Safari kills the tab on spikes:
 *  - object URL (no base64 copy of the original); <img> load reads size only
 *  - createImageBitmap with resize options so the browser can decode-to-size
 *    instead of materialising the ~48 MB full-res bitmap
 *  - async toBlob, then ONE base64 conversion at the end
 *  - bitmap.close() + canvas zeroed so iOS frees the memory right away
 * Throws Error(HEIC_UNSUPPORTED) for HEIC the browser can't decode; other
 * decode failures throw too — the caller soft-fails just that file.
 */
export async function downscaleImageFile(
  file: File,
  maxDim: number = MAX_DIMENSION,
): Promise<{ dataUrl: string; width?: number; height?: number }> {
  // Small, browser-renderable files: store as-is (no decode at all).
  // 1.5 MB is well under Claude's 5 MB cap; no point burning CPU re-encoding.
  if (file.size < 1_500_000 && !isHeic(file)) return { dataUrl: await readAsDataURL(file) };

  var objUrl = URL.createObjectURL(file);
  var bitmap: ImageBitmap | null = null;
  var canvas: HTMLCanvasElement | null = null;
  try {
    var img: HTMLImageElement;
    try { img = await loadImage(objUrl); }
    catch { throw new Error(isHeic(file) ? HEIC_UNSUPPORTED : "decode failed"); }
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error("decode failed");
    var scale = Math.min(1, maxDim / Math.max(w, h));

    var source: CanvasImageSource = img;
    if (typeof createImageBitmap === "function") {
      try {
        // Constrain only the long edge so the browser keeps the aspect ratio.
        bitmap = await createImageBitmap(file, w >= h
          ? { resizeWidth: Math.round(w * scale), resizeQuality: "medium", imageOrientation: "from-image" }
          : { resizeHeight: Math.round(h * scale), resizeQuality: "medium", imageOrientation: "from-image" });
        source = bitmap;
      } catch { /* older Safari: draw the <img> instead */ }
    }
    var sw = bitmap ? bitmap.width : w, sh = bitmap ? bitmap.height : h;
    var s2 = Math.min(1, maxDim / Math.max(sw, sh)); // covers browsers that ignore resize options
    canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * s2);
    canvas.height = Math.round(sh * s2);
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (bitmap) { bitmap.close(); bitmap = null; }

    var blob = await canvasToBlob(canvas);
    if (!blob) throw new Error("encode failed");
    // Re-encode came out bigger (rare)? Keep the original bytes.
    var useOriginal = blob.size >= file.size && !isHeic(file);
    return { dataUrl: await readAsDataURL(useOriginal ? file : blob), width: w, height: h };
  } finally {
    if (bitmap) bitmap.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    URL.revokeObjectURL(objUrl);
  }
}

/**
 * Convert a data: URL back into a Blob (for upload to Supabase Storage).
 * Uses fetch under the hood — handles base64 and any media type.
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  var res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Compress an existing data URL down for Vision API requests.
 * Defaults: 1024px / q0.65 (~80–150 KB) for batch features like ai-suggest where
 * many images share one 4.5 MB request. Callers that need higher fidelity (e.g.
 * the Scan classifier) can pass a larger maxDim/quality — Claude vision benefits
 * from detail up to ~1568px on the long edge.
 * Returns the original URL unchanged if it isn't a data URL or compression fails.
 */
export async function compressDataUrlForVision(
  url: string,
  maxDim: number = 1024,
  quality: number = 0.65,
): Promise<string> {
  if (!url.startsWith("data:image/")) return url; // cloud URLs, blob:, etc — leave alone
  try {
    var img = await loadImage(url);
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    if (!w || !h) return url;

    var VISION_MAX = maxDim;
    var VISION_QUALITY = quality;
    var longest = Math.max(w, h);
    var scale = longest > VISION_MAX ? VISION_MAX / longest : 1;
    var targetW = Math.round(w * scale);
    var targetH = Math.round(h * scale);

    var canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext("2d");
    if (!ctx) return url;

    ctx.drawImage(img, 0, 0, targetW, targetH);
    var compressed = canvas.toDataURL("image/jpeg", VISION_QUALITY);
    if (compressed.length >= url.length) return url;
    return compressed;
  } catch {
    return url;
  }
}
