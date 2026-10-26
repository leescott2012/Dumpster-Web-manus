/**
 * What this user's behavior has taught us, as prompt text (see shared/learning.ts).
 * Reads their recent learning events from activity_log. NEVER throws: a failed read
 * just means the AI runs without the extra hints.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { LEARN_EVENTS, learnedBlock, summarizeLearning, type LearnEvent } from "../shared/learning.js";

const DAYS = 90;
const MAX_EVENTS = 400;

export async function learnedForUser(userId: string | null): Promise<string> {
  if (!userId) return "";
  try {
    const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("activity_log").select("event, metadata")
      .eq("user_id", userId).in("event", [...LEARN_EVENTS]).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(MAX_EVENTS);
    if (error || !data) return "";
    return learnedBlock(summarizeLearning(data as LearnEvent[]));
  } catch {
    return "";
  }
}
