/**
 * EXIF extraction — runs on the ORIGINAL File before downscale.
 *
 * The downscale step (imageDownscale.ts) re-encodes through a canvas and
 * drops the entire EXIF block. So we read what we want first, stash it on
 * the Photo, then continue with the existing downscale pipeline.
 *
 * We deliberately only return a small curated subset — full EXIF can be
 * 50+ fields per photo and most are noise (lens model, exposure mode, etc.).
 *
 * Privacy notes:
 *   - GPS coordinates are personally identifiable. They're stored alongside
 *     the photo locally and are included in the AI prompt context when
 *     present, so Claude can do location-aware clustering / captions. They
 *     are NEVER sent to Sentry or any analytics path.
 *   - If a photo has no EXIF (screenshots, downloaded images, photos already
 *     processed), all fields stay undefined and the rest of the app behaves
 *     exactly like before this feature shipped.
 */
import exifr from "exifr";
import type { PhotoMeta } from "./photoData";

/**
 * Pull a small, useful EXIF subset from an uploaded file.
 * Returns an empty object if the file has no EXIF or parsing fails — never
 * throws, so callers can drop the result into the photo unconditionally.
 */
export async function extractPhotoMeta(file: File): Promise<PhotoMeta> {
  // Bail fast for non-images — videos and screenshots have no useful EXIF.
  if (!file.type.startsWith("image/")) return {};

  try {
    var raw = await exifr.parse(file, {
      // Only ask for the tags we'll actually use — keeps the parse light.
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "GPSLatitude",
        "GPSLongitude",
        "Make",
        "Model",
        "Orientation",
        "ExifImageWidth",
        "ExifImageHeight",
        "PixelXDimension",
        "PixelYDimension",
      ],
      // Get GPS as decimal degrees with hemisphere applied
      gps: true,
      // Don't try to load IPTC/XMP — saves bandwidth/CPU
      iptc: false,
      xmp: false,
    });

    if (!raw) return {};

    var meta: PhotoMeta = {};

    var taken = raw.DateTimeOriginal || raw.CreateDate;
    if (taken instanceof Date) {
      meta.takenAt = taken.getTime();
    } else if (typeof taken === "string") {
      var t = Date.parse(taken);
      if (!isNaN(t)) meta.takenAt = t;
    }

    if (typeof raw.latitude === "number" && typeof raw.longitude === "number") {
      meta.lat = raw.latitude;
      meta.lng = raw.longitude;
    }

    if (raw.Make || raw.Model) {
      var make = (raw.Make || "").trim();
      var model = (raw.Model || "").trim();
      // De-duplicate ("Apple Apple iPhone 14" → "Apple iPhone 14")
      if (model.toLowerCase().indexOf(make.toLowerCase()) === 0) {
        meta.camera = model;
      } else {
        meta.camera = (make + " " + model).trim();
      }
    }

    if (typeof raw.Orientation === "number") meta.orientation = raw.Orientation;

    var w = raw.ExifImageWidth || raw.PixelXDimension;
    var h = raw.ExifImageHeight || raw.PixelYDimension;
    if (typeof w === "number") meta.width = w;
    if (typeof h === "number") meta.height = h;

    return meta;
  } catch (_err) {
    // exifr throws on malformed/unknown formats — treat as "no EXIF" and move on
    return {};
  }
}

/**
 * Compact a PhotoMeta into a short string suitable for inclusion in an AI
 * prompt. Returns "" if nothing useful is present so callers can join() safely.
 *
 *   "taken 2024-09-12 14:32 · iPhone 14 Pro · 37.78, -122.41"
 */
export function metaToPromptLine(m?: PhotoMeta): string {
  if (!m) return "";
  var parts: string[] = [];
  if (m.takenAt) {
    var d = new Date(m.takenAt);
    parts.push(
      "taken " +
      d.getUTCFullYear() + "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(d.getUTCDate()).padStart(2, "0") + " " +
      String(d.getUTCHours()).padStart(2, "0") + ":" +
      String(d.getUTCMinutes()).padStart(2, "0")
    );
  }
  if (m.camera) parts.push(m.camera);
  if (typeof m.lat === "number" && typeof m.lng === "number") {
    parts.push(m.lat.toFixed(3) + ", " + m.lng.toFixed(3));
  }
  return parts.join(" · ");
}
