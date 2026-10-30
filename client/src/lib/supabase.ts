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

/** Auth headers plus the user's own verified AI key (Claude first, then Gemini, OpenAI, OpenRouter) for AI calls. */
export async function getAiHeaders(): Promise<Record<string, string>> {
  var h = await getAuthHeaders();
  try {
    var order = ["anthropic", "gemini", "openai", "openrouter"];
    for (var i = 0; i < order.length; i++) {
      var meta = JSON.parse(localStorage.getItem("dumpster_aikey_meta_" + order[i]) || "null");
      var key = localStorage.getItem("dumpster_aikey_" + order[i]);
      if (key && meta && meta.status === "verified") {
        h["x-api-key"] = key;
        h["x-api-provider"] = order[i];
        break;
      }
    }
  } catch { /* storage blocked — fall back to credits */ }
  return h;
}
