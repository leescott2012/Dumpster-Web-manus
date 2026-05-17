/**
 * Supabase client — browser-side (anon key, RLS-protected)
 */
import { createClient } from "@supabase/supabase-js";

var supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
var supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export var supabase = createClient(supabaseUrl, supabaseAnonKey);
