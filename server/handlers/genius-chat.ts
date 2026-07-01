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
import Stripe from "stripe";
import { getUserFromRequest } from "../creditGate.js";
import { createClient } from "@supabase/supabase-js";
import { captureServerError, captureServerMessage } from "../sentry.js";

// Sonnet for the brain: far more reliable multi-step tool use than Haiku, which
// matters when it's wielding write_database and issuing real Stripe refunds.
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are GENIUSS, the AI core of the Chamillion Collective — a calm, precise, slightly sardonic British AI assistant (a refined butler) wired into the admin dashboard of the Dumpster app (an Instagram carousel "photo dump" creator). Address the user as "sir" now and then.

Your reply is read aloud by text-to-speech, so answer in 1-3 short, natural spoken sentences. No markdown, no bullet points, no code, no URLs, no emoji. Speak money and numbers naturally.

You can read AND change the live production database with tools:
- query_database: run a read-only SQL SELECT to answer ANY question about the business.
- write_database: run a single INSERT/UPDATE/DELETE to make changes.
- refund_payment: issue a REAL Stripe refund. First find the customer's payment_intent with query_database (credit_transactions.stripe_payment_id where type = 'purchase'), confirm the amount and person with the user, and only then call refund_payment. A refund returns real money — treat it like a billing change.

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
- Before ANY write that changes credits, subscription_tier, billing, DELETES anything, or issues a refund: do NOT call write_database or refund_payment yet. First reply with the exact change and ask the user to confirm (e.g. "I'll set Lee's credits to 100 — shall I proceed, sir?" or "I'll refund Lee's $5 purchase — confirm, sir?"). Only call the tool after the user clearly confirms in the conversation.
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
  {
    name: "refund_payment",
    description:
      "Issue a real Stripe refund for a customer payment. ONLY call after the user has explicitly confirmed the refund in conversation (amount + who). Find the payment first with query_database: SELECT stripe_payment_id, amount, created_at FROM credit_transactions WHERE user_id = '<id>' AND type = 'purchase' ORDER BY created_at DESC. Pass the stripe_payment_id (a payment_intent, 'pi_...'). Refunds the full charge unless amount_cents is given.",
    input_schema: {
      type: "object",
      properties: {
        stripe_payment_id: { type: "string", description: "The Stripe payment_intent id (pi_...) from credit_transactions.stripe_payment_id." },
        amount_cents: { type: "number", description: "Optional partial refund amount in cents. Omit to refund the full charge." },
        reason: { type: "string", description: "Plain-English reason for the refund." },
      },
      required: ["stripe_payment_id"],
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

// SQL validation for query_database / write_database (backend security audit,
// 2026-07-01). Previously these forwarded the model's `sql` string straight to
// geniuss_read/geniuss_write with zero checks — a prompt-injection payload (e.g.
// text embedded in a bug report GENIUSS later reads) could steer it into
// destructive or exfiltrating queries under service_role. This is app-layer
// defense-in-depth; geniuss_read/geniuss_write themselves were also hardened
// with matching checks directly in Postgres (migration
// harden_geniuss_read_write_sql_validation) so a bypass here isn't fatal.
const WRITABLE_TABLES = ["profiles", "credit_transactions", "bug_reports", "photos", "dumps", "dump_photos", "activity_log"];

function stripSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function bareStatement(sql: string): string {
  return stripSqlComments(sql).trim().replace(/;+\s*$/, "");
}

function isSingleStatement(sql: string): boolean {
  return !sql.includes(";");
}

/** Returns an error string if `sql` isn't a safe single SELECT, else null. */
function validateSelectSql(rawSql: string): string | null {
  const sql = bareStatement(rawSql);
  if (!sql) return "empty SQL";
  if (!isSingleStatement(sql)) return "only a single statement is allowed (no semicolons/stacked queries)";
  if (!/^select\s/i.test(sql)) return "query_database only accepts a single SELECT statement";
  // Blocks writable CTEs (WITH x AS (DELETE ... RETURNING *) SELECT * FROM x) and
  // any other write/DDL keyword smuggled into an otherwise-SELECT statement.
  if (/\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|into)\b/i.test(sql)) {
    return "SELECT statements may not contain write/DDL keywords";
  }
  if (/api_key_/i.test(sql)) return "refusing to select api_key_* columns";
  return null;
}

/** Returns an error string if `sql` isn't a safe single write, else null. */
function validateWriteSql(rawSql: string): string | null {
  const sql = bareStatement(rawSql);
  if (!sql) return "empty SQL";
  if (!isSingleStatement(sql)) return "only a single statement is allowed (no semicolons/stacked queries)";
  const m = sql.match(/^(insert\s+into|update|delete\s+from)\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i);
  if (!m) return "write_database only accepts a single INSERT/UPDATE/DELETE statement";
  if (/\b(drop|alter|truncate|grant|revoke|create|select)\b/i.test(sql)) {
    return "write statement contains disallowed keywords";
  }
  if (/api_key_/i.test(sql)) return "refusing to write api_key_* columns";
  if (/\bauth\.users\b|\bauth\./i.test(sql)) return "refusing to write to the auth schema";
  const table = m[2].toLowerCase();
  if (!WRITABLE_TABLES.includes(table)) {
    return "writes are only allowed to: " + WRITABLE_TABLES.join(", ") + " (got: " + table + ")";
  }
  return null;
}

let _stripe: Stripe | null = null;
function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** Issue a Stripe refund — only for a payment_intent we have on record. */
async function doRefund(supabase: AnyObj, paymentIntentId: string, amountCents?: number): Promise<string> {
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
    return "ERROR: expected a Stripe payment_intent id (pi_...). Find it in credit_transactions.stripe_payment_id first.";
  }
  const stripe = stripeClient();
  if (!stripe) return "ERROR: STRIPE_SECRET_KEY not configured — cannot refund.";
  // Safety net: never refund a payment that isn't in our own ledger.
  try {
    const { data: rows } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("stripe_payment_id", paymentIntentId)
      .limit(1);
    if (!rows || rows.length === 0) {
      return "ERROR: no credit_transactions row references " + paymentIntentId + " — refusing to refund an unrecognized payment.";
    }
  } catch (e: any) {
    return "ERROR: could not verify the payment in our records: " + (e?.message || String(e));
  }
  try {
    const params: Stripe.RefundCreateParams = { payment_intent: paymentIntentId };
    if (typeof amountCents === "number" && amountCents > 0) params.amount = Math.round(amountCents);
    const refund = await stripe.refunds.create(params);
    return "OK — refund " + refund.id + ", status " + refund.status + ", " +
      (refund.amount / 100).toFixed(2) + " " + String(refund.currency || "usd").toUpperCase() + " returned.";
  } catch (e: any) {
    return "ERROR: Stripe refund failed: " + (e?.message || String(e));
  }
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
      captureServerError(e, "genius-chat.history_fetch", { userId });
    }

    const system = SYSTEM_PROMPT + statsBlock(stats);

    // Primary: Anthropic with tool-use (the god-mode brain).
    if (anthropicKey) {
      const messages: AnyObj[] = [...history, { role: "user", content: transcript }];
      for (let step = 0; step < 6; step++) {
        const data = await callAnthropic(anthropicKey, system, messages);
        if (data?.error) {
          captureServerMessage("[genius-chat] anthropic error: " + data.error.message, "genius-chat.anthropic", "warning");
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
                const validationError = validateSelectSql(sql);
                if (validationError) {
                  out = "ERROR: rejected — " + validationError;
                } else {
                  // Hard server-side cap regardless of what the model wrote — never
                  // trust an LLM-supplied LIMIT.
                  const capped = "SELECT * FROM (" + bareStatement(sql) + ") AS _geniuss_capped LIMIT 50";
                  const { data: d, error } = await supabase.rpc("geniuss_read", { q: capped });
                  out = error ? "ERROR: " + error.message : JSON.stringify(d ?? []).slice(0, 6000);
                }
              } else if (tu.name === "write_database") {
                const validationError = validateWriteSql(sql);
                if (validationError) {
                  out = "ERROR: rejected — " + validationError;
                } else {
                  const { data: d, error } = await supabase.rpc("geniuss_write", { q: bareStatement(sql) });
                  out = error ? "ERROR: " + error.message : "OK — " + String(d);
                }
              } else if (tu.name === "refund_payment") {
                out = await doRefund(supabase, String(tu.input?.stripe_payment_id ?? ""),
                  typeof tu.input?.amount_cents === "number" ? tu.input.amount_cents : undefined);
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
      captureServerError(e, "genius-chat.log_write", { userId });
    }

    return res.status(200).json({ reply: replyText });
  } catch (err: any) {
    captureServerError(err, "genius-chat", { userId });
    return res.status(500).json({ error: "Neural core error: " + err.message });
  }
}
