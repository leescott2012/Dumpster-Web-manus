import { supabase } from "./supabase";
import { IS_OWNER, type Dump, type Photo } from "./photoData";

export interface WorkspaceState {
  dumps: Dump[];
  pool: Photo[];
}

/**
 * Fetches the user's workspace from Supabase.
 */
export async function fetchCloudWorkspace(userId: string): Promise<WorkspaceState | null> {
  if (IS_OWNER) return null;

  const { data, error } = await supabase
    .from("user_workspaces")
    .select("dumps_json, pool_json")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No workspace found for this user yet
      return null;
    }
    console.error("Error fetching cloud workspace:", error);
    return null;
  }

  return {
    dumps: data.dumps_json as Dump[],
    pool: data.pool_json as Photo[],
  };
}

/**
 * Saves the user's workspace to Supabase.
 * This should be debounced in the UI layer.
 */
export async function saveCloudWorkspace(userId: string, state: WorkspaceState): Promise<void> {
  if (IS_OWNER) return;

  const { error } = await supabase
    .from("user_workspaces")
    .upsert({
      id: userId,
      dumps_json: state.dumps,
      pool_json: state.pool,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error saving cloud workspace:", error);
  }
}
