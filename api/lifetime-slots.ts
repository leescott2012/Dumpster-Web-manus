/**
 * GET /api/lifetime-slots — returns remaining early-bird lifetime slots
 * Queries profiles table for lifetime_purchase = true, subtracts from 1000.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";

export var config = { runtime: "nodejs", maxDuration: 5, memory: 128 };

var supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

var TOTAL_SLOTS = 1000;

// Simple in-memory cache (refreshes every 5 minutes)
var cached: { remaining: number; ts: number } | null = null;
var CACHE_TTL = 5 * 60 * 1000;

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // Return cached if fresh
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ remaining: cached.remaining, total: TOTAL_SLOTS }));
    return;
  }

  try {
    var { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("lifetime_purchase", true);

    if (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "DB error" }));
      return;
    }

    var sold = count || 0;
    var remaining = Math.max(0, TOTAL_SLOTS - sold);

    cached = { remaining: remaining, ts: Date.now() };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ remaining: remaining, total: TOTAL_SLOTS }));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Server error" }));
  }
}
