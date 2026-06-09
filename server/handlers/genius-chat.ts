/**
 * /api/genius-chat  (admin-only; served via /api/admin?fn=genius-chat)
 *
 * GENIUSS — the admin "brain". Takes a voice transcript and answers, with real
 * tool-use over the production database:
 *   - query_database: any read-only SELECT (via the geniuss_read SQL bridge)
 *   - write_database: any INSERT/UPDATE/DELETE (via geniuss_write), gated by
 *     spoken confirmation for credit / tier / billing / delete changes.
 * Returns a short spoken-style reply the client pipes to /api/tts.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../creditGate.js";
import { createClient } from "@supabase/supabase-js";

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are GENIUSS, the AI core of the Chamillion Collective — a calm, precise, slightly sardonic British AI assistant (a refined butler) wired into the admin dashboard of the Dumpster app (an Instagram carousel "photo dump" creator). Address the user as "sir" now and then.

Your reply is read aloud by text-to-speech, so answer in 1-3 short, natural spoken sentences. No markdown, no bullet points, no code, no URLs, no emoji. Speak money and numbers naturally.

You can read AND change the live production database with tools:
- query_database: run a read-only SQL SELECT to answer ANY question about the business.
- write_database: run a single INSERT/UPDATE/DELETE to make changes.

DATABASE SCHEMA (Postgres):
- profiles(id uuid = auth user id, email, display_name, subscription_tier 'free'|'pro', subscription_status, stripe_customer_id, stripe_subscription_id, credits int, daily_credits_remaining int, lifetime_purchase bool, referral_code, created_at)
- credit_transactions(id, user_id -> profiles.id, amount int signed, type, description, stripe_payment_id, created_at)
- activity_log(id, user_id, event, metadata jsonb, created_at)
- bug_reports(id, user_id, email, source, message, error_code, status 'new'|'seen'|'fixed', admin_note, created_at)
- photos(id, user_id, url, category, created_at), dumps(id, user_id, title, created_at), dump_photos(dump_id, photo_id)
- auth.users(id, email, created_at, last_sign_in_at)  -- join profiles.id = auth.users.id for sign-in info

SQL RULES:
- query_database takes ONE SELECT statement with no trailing semicolon. Add LIMIT (<= 50) on large tables. Use ILIKE for fuzzy email/name matching.
- To act on a person, look them up in profiles by email or display_name first.

SAFETY — CONFIRMATION REQUIRED:
- Before ANY write that changes credits, subscription_tier, billing, or DELETES anything: do NOT call write_database yet. First reply with the exact change and ask the user to confirm (e.g. "I'll set Lee's credits to 100 — shall I proceed, sir?"). Only call write_database after the user clearly confirms in the conversation.
- Low-risk writes (e.g. a bug_reports status or admin_note) may be done directly; briefly say what you did.
- Never select or reveal secret columns: profiles.api_key_openai, profiles.api_key_anthropic, stripe ids/keys. Do not read api_key_* columns at all.`;

const TOOLS = [
  {
    name: "query_database",
    description:
      "Run a read-only SQL SELECT against the production Postgres DB and get rows back as JSON. Use for any question about users, revenue, credits, activity, bugs, photos, or dumps.",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "A single SQL SELECT statement, no trailing semicolon." },
      },
      required: ["sql"],
    },
  },
  {
    name: "write_database",
    description:
      "Run a single INSERT/UPDATE/DELETE statement. Only call after the user has explicitly confirmed any change to credits, tier, billing, or any deletion. Returns the affected row count.",
    input_schema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "A single write SQL statement, no trailing semicolon." },
        summary: { type: "string", description: "Plain-English summary of the change." },
      },
      required: ["sql"],
    },
  },
];

interface AdminStatsLite {
  overview?: { total_users?: number; active_today?: number; active_week?: number; ai_calls_today?: number; credits_spent_today?: number };
  feature_usage?: { action: string; count: number; credits: number }[];
  dau?: { date: string; count: number }[];
  users?: { email: string; tier: string; credits: number; ai_calls: number; photos_uploaded: number; exports: number; last_sign_in_at: string | null }[];
}

function statsBlock(stats: AdminStatsLite | undefined): string {
  if (!stats?.overview) return "";
  const o = stats.overview;
  return `\n\nQUICK CONTEXT (live dashboard): total users ${o.total_users ?? "?"}, active today ${o.active_today ?? "?"}, active this week ${o.active_week ?? "?"}, AI calls today ${o.ai_calls_today ?? "?"}, credits spent today ${o.credits_spent_today ?? "?"}. Use query_database for anything more specific.`;
}

type AnyObj = Record<string, any>;

async function callAnthropic(apiKey: string, system: string, messages: AnyObj[]): Promise<AnyObj> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools: TOOLS, messages }),
  });
  return (await r.json()) as AnyObj;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Admin-only — same gate as the other admin endpoints.
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId) return res.status(503).json({ error: "ADMIN_USER_ID env var not set." });
  if (userId !== adminId) return res.status(403).json({ error: "Forbidden." });

  const { transcript, stats } = req.body as { transcript: string; stats?: AdminStatsLite };
  if (!transcript?.trim()) return res.status(400).json({ error: "No transcript provided." });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  let replyText = "";

  try {
    // Conversation memory: reconstruct recent turns from system_logs.
    let history: AnyObj[] = [];
    try {
      const { data: logs } = await supabase
        .from("system_logs")
        .select("level, message, created_at")
        .in("level", ["USER", "GENIUS"])
        .order("created_at", { ascending: false })
        .limit(12);
      if (logs?.length) {
        history = logs
          .reverse()
          .map((l: AnyObj) => ({ role: l.level === "USER" ? "user" : "assistant", content: String(l.message ?? "") }))
          .filter((m: AnyObj) => m.content.trim().length > 0);
      }
    } catch (e) {
      console.warn("[genius-chat] history fetch failed:", e);
    }

    const system = SYSTEM_PROMPT + statsBlock(stats);

    // Primary: Anthropic with tool-use (the god-mode brain).
    if (anthropicKey) {
      const messages: AnyObj[] = [...history, { role: "user", content: transcript }];
      for (let step = 0; step < 6; step++) {
        const data = await callAnthropic(anthropicKey, system, messages);
        if (data?.error) {
          console.warn("[genius-chat] anthropic error:", data.error.message);
          break;
        }
        const content: AnyObj[] = Array.isArray(data.content) ? data.content : [];
        const toolUses = content.filter((b) => b.type === "tool_use");
        if (data.stop_reason === "tool_use" && toolUses.length) {
          messages.push({ role: "assistant", content });
          const results: AnyObj[] = [];
          for (const tu of toolUses) {
            let out = "";
            try {
              const sql = String(tu.input?.sql ?? "");
              if (tu.name === "query_database") {
                const { data: d, error } = await supabase.rpc("geniuss_read", { q: sql });
                out = error ? "ERROR: " + error.message : JSON.stringify(d ?? []).slice(0, 6000);
              } else if (tu.name === "write_database") {
                const { data: d, error } = await supabase.rpc("geniuss_write", { q: sql });
                out = error ? "ERROR: " + error.message : "OK — " + String(d);
              } else {
                out = "ERROR: unknown tool";
              }
            } catch (e: any) {
              out = "ERROR: " + (e?.message || String(e));
            }
            results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
          }
          messages.push({ role: "user", content: results });
          continue;
        }
        replyText = content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
        break;
      }
    }

    // Fallback (no Anthropic key / it failed): basic reply without DB tools.
    if (!replyText && googleKey) {
      const sys = SYSTEM_PROMPT.split("You can read AND change")[0] + statsBlock(stats);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sys }] },
            contents: [{ parts: [{ text: transcript }] }],
            generationConfig: { maxOutputTokens: 400 },
          }),
        },
      );
      const data = (await response.json()) as AnyObj;
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    }
    if (!replyText && openaiKey) {
      const sys = SYSTEM_PROMPT.split("You can read AND change")[0] + statsBlock(stats);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 400,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: transcript },
          ],
        }),
      });
      const data = (await response.json()) as AnyObj;
      replyText = data.choices?.[0]?.message?.content?.trim() || "";
    }
    if (!replyText && !anthropicKey && !googleKey && !openaiKey) {
      replyText = "Neural link established, sir, but no AI model key is configured. Please add ANTHROPIC_API_KEY in Vercel.";
    }
    if (!replyText) replyText = "I processed that, sir, but the neural core returned nothing. Do try again.";

    try {
      await supabase.from("system_logs").insert([
        { level: "USER", message: transcript },
        { level: "GENIUS", message: replyText },
      ]);
    } catch (e) {
      console.warn("[genius-chat] log write failed:", e);
    }

    return res.status(200).json({ reply: replyText });
  } catch (err: any) {
    console.error("[genius-chat] error:", err);
    return res.status(500).json({ error: "Neural core error: " + err.message });
  }
}
