/**
 * Supabase client — browser-side (anon key, RLS-protected)
 */
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
var supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export var supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Get Authorization headers for API calls (empty if not logged in) */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  var { data: { session } } = await supabase.auth.getSession();
  if (session && session.access_token) {
    return { Authorization: "Bearer " + session.access_token };
  }
  return {};
}
