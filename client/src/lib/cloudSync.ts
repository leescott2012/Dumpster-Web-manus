/**
 * Cloud sync — persists user workspace (dumps + pool) to Supabase
 * and uploads photo files to Supabase Storage.
 *
 * Architecture:
 *   - JSON state (dumps[], pool[]) → public.user_workspaces table (jsonb)
 *   - Photo bytes (File objects)   → storage bucket "workspace-uploads"
 *
 * Why this split:
 *   Data URLs in jsonb would bloat rows past Postgres limits. By uploading
 *   files to Storage and only persisting the public URLs in jsonb, the
 *   workspace JSON stays small (~KBs) regardless of photo count.
 *
 * Owner mode (IS_OWNER): all cloud operations no-op so personal photos
 * never leave the local browser.
 */
import { supabase } from "./supabase";
import { IS_OWNER, type Dump, type Photo } from "./photoData";

export interface WorkspaceState {
  dumps: Dump[];
  pool: Photo[];
}

var STORAGE_BUCKET = "workspace-uploads";

// ──────────────────────────────────────────────────────────────────────────
// Workspace JSON (dumps + pool)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Loads the user's workspace state from Supabase.
 * Returns null if no saved state exists, fetch fails, or owner mode is on.
 */
export async function loadCloudState(userId: string): Promise<WorkspaceState | null> {
  if (IS_OWNER) return null;

  var { data, error } = await supabase
    .from("user_workspaces")
    .select("dumps_json, pool_json")
    .eq("id", userId)
    .single();

  if (error || !data) {
    // PGRST116 = no rows returned (new user, no workspace yet)
    if (error && error.code !== "PGRST116") {
      console.error("[cloudSync] load failed:", error);
    }
    return null;
  }

  return {
    dumps: (data.dumps_json as Dump[]) || [],
    pool: (data.pool_json as Photo[]) || [],
  };
}

/**
 * Saves workspace state to Supabase. Caller is responsible for debouncing.
 * Returns true on success — Home.tsx uses this to update its "last saved" hash.
 */
export async function saveCloudState(userId: string, dumps: Dump[], pool: Photo[]): Promise<boolean> {
  if (IS_OWNER) return false;

  var { error } = await supabase
    .from("user_workspaces")
    .upsert({
      id: userId,
      dumps_json: dumps,
      pool_json: pool,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[cloudSync] save failed:", error);
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────────────
// Photo file uploads (Supabase Storage)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Uploads a single photo/video file to Supabase Storage under the user's namespace.
 * Returns the public URL to embed in the workspace JSON, or null on failure
 * (caller falls back to a data URL so the UX still works offline).
 *
 * Path layout: <userId>/<photoId>.<ext>  — RLS enforces userId === auth.uid()
 */
export async function uploadPhotoToCloud(
  file: File,
  userId: string,
  photoId: string
): Promise<string | null> {
  if (IS_OWNER) return null;

  // Derive extension from mime or filename
  var ext = "bin";
  if (file.type) {
    var slash = file.type.lastIndexOf("/");
    if (slash >= 0) ext = file.type.slice(slash + 1);
  } else if (file.name) {
    var dot = file.name.lastIndexOf(".");
    if (dot >= 0) ext = file.name.slice(dot + 1);
  }

  var path = userId + "/" + photoId + "." + ext;

  var { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000", // 1y — content is immutable per photoId
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error("[cloudSync] upload failed:", uploadError);
    return null;
  }

  // Build public URL (bucket must be configured as public; RLS still gates writes)
  var { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return urlData.publicUrl || null;
}

// ──────────────────────────────────────────────────────────────────────────
// Legacy aliases — kept for any callers that still import the old names.
// (Safe to delete once nothing references them.)
// ──────────────────────────────────────────────────────────────────────────
export var fetchCloudWorkspace = loadCloudState;
export async function saveCloudWorkspace(userId: string, state: WorkspaceState): Promise<void> {
  await saveCloudState(userId, state.dumps, state.pool);
}
