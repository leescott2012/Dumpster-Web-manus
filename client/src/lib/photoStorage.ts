import { supabase } from "./supabase";
import { dataUrlToBlob } from "./imageDownscale";

const BUCKET = "workspace-uploads";

/** Max number of uploaded images per user (videos excluded from cap). */
export const PHOTO_CAP = 50;

/**
 * Count how many images a user has stored in Supabase Storage.
 * Videos are not counted — they use blob: URLs and aren't stored.
 */
export async function countUserPhotos(userId: string): Promise<number> {
  var { data, error } = await supabase.storage
    .from(BUCKET)
    .list(userId, { limit: 1000 });
  if (error || !data) return 0;
  return data.filter(function(f) { return /\.(jpg|jpeg|png|webp)$/i.test(f.name); }).length;
}

/**
 * Upload a downscaled image data URL to Supabase Storage.
 * Returns the public HTTPS URL on success, null on failure.
 * Falls back gracefully — caller should keep the data URL if this returns null.
 */
export async function uploadPhotoToStorage(
  userId: string,
  photoId: string,
  dataUrl: string
): Promise<string | null> {
  try {
    var blob = await dataUrlToBlob(dataUrl);
    var ext = blob.type.includes("png") ? "png" : "jpg";
    var path = userId + "/" + photoId + "." + ext;

    var { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type, upsert: false });

    if (error) {
      console.error("[photoStorage] upload failed:", error.message);
      return null;
    }

    var { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("[photoStorage] upload error:", e);
    return null;
  }
}

/**
 * Delete a photo from Supabase Storage.
 * Tries both .jpg and .png since we don't store the extension separately.
 * Silent on failure — worst case the file stays in storage (no user impact).
 */
export async function deletePhotoFromStorage(
  userId: string,
  photoId: string
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([
    userId + "/" + photoId + ".jpg",
    userId + "/" + photoId + ".png",
  ]).catch(function(e) { console.warn("[photoStorage] delete error:", e); });
}

/** Returns true if the URL is a Supabase Storage URL (not a data: or blob: URL). */
export function isStorageUrl(url: string): boolean {
  return url.startsWith("https://") && url.includes("supabase");
}
