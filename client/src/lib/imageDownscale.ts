/**
 * Client-side image downscaling.
 *
 * Why this exists:
 *  - Claude Vision API rejects images > 5 MB; iPhone JPEGs routinely exceed this.
 *  - localStorage caps around 5–10 MB per origin; full-res photos blow that fast.
 *  - IG carousels publish at 1080×1350, so storing > 2048px is wasted bytes.
 *
 * Strategy:
 *  - Decode the File into a canvas.
 *  - Scale to max 2048px on the longest side (preserves aspect ratio).
 *  - Re-encode as JPEG at quality 0.85 (≈ 300–800 KB for a typical iPhone photo).
 *  - Fall back to the original FileReader data URL if anything goes sideways.
 */

var MAX_DIMENSION = 2048;
var JPEG_QUALITY = 0.85;

/**
 * Read a File as a data URL — used as the no-resize fallback path.
 */
function readAsDataURL(file: File): Promise<string> {
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

/**
 * Downscale a single image File to a JPEG data URL.
 * Returns the original-as-data-URL if the file is already small, can't be decoded,
 * or isn't an image. Never throws — caller can trust the result.
 */
export async function downscaleImageToDataUrl(file: File): Promise<string> {
  // Skip non-images (videos, etc.) — caller handles those separately.
  if (!file.type.startsWith("image/")) {
    return readAsDataURL(file);
  }

  // Small enough already? Skip the round-trip through canvas.
  // 1.5 MB is well under Claude's 5 MB cap; no point burning CPU re-encoding.
  if (file.size < 1_500_000) {
    return readAsDataURL(file);
  }

  try {
    var originalDataUrl = await readAsDataURL(file);
    var img = await loadImage(originalDataUrl);

    var w = img.naturalWidth;
    var h = img.naturalHeight;
    if (!w || !h) return originalDataUrl;

    // Already within budget? Re-encode anyway if file is huge — JPEG quality at
    // a fixed level can be significantly smaller than the camera-default.
    var longest = Math.max(w, h);
    var scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
    var targetW = Math.round(w * scale);
    var targetH = Math.round(h * scale);

    var canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    var ctx = canvas.getContext("2d");
    if (!ctx) return originalDataUrl;

    ctx.drawImage(img, 0, 0, targetW, targetH);
    var resized = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

    // Sanity check — if the "resized" version came back larger somehow
    // (e.g. tiny PNG up-encoded to JPEG), keep the original.
    if (resized.length >= originalDataUrl.length) return originalDataUrl;
    return resized;
  } catch {
    // Any failure: degrade gracefully to the original.
    return readAsDataURL(file);
  }
}

/**
 * Compress an existing data URL down further for Vision API requests.
 * Resizes to 1024px max longest side, JPEG quality 0.65 → ~80–150 KB per image.
 * Why: Vercel caps serverless request bodies at 4.5 MB. With 20 photos this
 * budget is gone fast at pool-quality sizing. Vision API doesn't need full res.
 * Returns the original URL unchanged if it isn't a data URL or compression fails.
 */
export async function compressDataUrlForVision(url: string): Promise<string> {
  if (!url.startsWith("data:image/")) return url; // cloud URLs, blob:, etc — leave alone
  try {
    var img = await loadImage(url);
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    if (!w || !h) return url;

    var VISION_MAX = 1024;
    var VISION_QUALITY = 0.65;
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
