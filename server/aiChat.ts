/**
 * AI Chat — server-side handler
 * Accepts a dump's context (photos, pool, taste profile, chat history)
 * and a user message. Returns a reply + structured actions to execute.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { IncomingMessage, ServerResponse } from "http";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChatPhoto {
  id: string;
  url: string;
  alt: string;
  category: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatAction {
  type: "reorder" | "swap_in" | "swap_out" | "update_vibe" | "taste_update";
  /** reorder: new ordered list of photo IDs */
  photoIds?: string[];
  /** swap_in: photo ID from pool to add */
  photoId?: string;
  /** swap_in: insert position (0-based) */
  position?: number;
  /** swap_out: index in dump to remove */
  index?: number;
  /** update_vibe: new vibe string */
  vibe?: string;
  /** taste_update: preference to remember */
  preference?: string;
}

interface RequestBody {
  dumpId: string;
  dumpTitle: string;
  dumpPhotos: ChatPhoto[];
  poolPhotos: ChatPhoto[];
  history: ChatMessage[];
  message: string;
  tasteProfile: string;
  vibe?: string;
}

export interface AIChatResponse {
  reply: string;
  actions: ChatAction[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise(function(resolve, reject) {
    var chunks: Buffer[] = [];
    req.on("data", function(c: Buffer) { chunks.push(c); });
    req.on("end", function() { resolve(Buffer.concat(chunks).toString("utf-8")); });
    req.on("error", reject);
  });
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function handleAIChat(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured." }));
    return;
  }

  var body: RequestBody;
  try {
    var raw = await readBody(req);
    body = JSON.parse(raw) as RequestBody;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  if (!body.message || !body.message.trim()) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Message is required" }));
    return;
  }

  // Build dump photos description
  var dumpDesc = body.dumpPhotos.map(function(p, i) {
    return "  " + (i + 1) + ". [" + p.id + "] " + p.category + " — " + p.alt;
  }).join("\n");

  // Build pool photos description (cap at 30 for context size)
  var poolCapped = body.poolPhotos.slice(0, 30);
  var poolDesc = poolCapped.map(function(p) {
    return "  [" + p.id + "] " + p.category + " — " + p.alt;
  }).join("\n");

  var tasteSection = body.tasteProfile
    ? "\n\nUSER TASTE PROFILE (accumulated preferences):\n" + body.tasteProfile
    : "";

  var vibeSection = body.vibe
    ? "\nCurrent vibe tag: \"" + body.vibe + "\""
    : "";

  var systemPrompt = "You are the AI assistant inside Dumpster, an Instagram carousel sequencing app. " +
    "The user is chatting with you about a specific dump (carousel). You can:\n" +
    "1. REORDER photos in the dump\n" +
    "2. SWAP IN photos from the pool into the dump\n" +
    "3. SWAP OUT photos from the dump back to the pool\n" +
    "4. UPDATE the dump's vibe tag\n" +
    "5. REMEMBER taste preferences for future sessions\n\n" +
    "CURRENT DUMP: \"" + body.dumpTitle + "\"" + vibeSection + "\n" +
    "Photos in dump (in order):\n" + (dumpDesc || "  (empty)") + "\n\n" +
    "AVAILABLE POOL PHOTOS:\n" + (poolDesc || "  (none)") + "\n" +
    tasteSection + "\n\n" +
    "RULES:\n" +
    "- Be concise and conversational. Sound like a creative director, not a robot.\n" +
    "- When you take actions, explain what you did and why in 1-2 sentences.\n" +
    "- If the user is just chatting or asking questions, respond naturally — don't force actions.\n" +
    "- When you do take actions, ALSO include taste_update actions to remember preferences.\n" +
    "- Dump max is 20 photos.\n\n" +
    "RESPONSE FORMAT — respond ONLY with valid JSON, no markdown, no code fences:\n" +
    "{\n" +
    "  \"reply\": \"Your conversational response\",\n" +
    "  \"actions\": [\n" +
    "    {\"type\": \"reorder\", \"photoIds\": [\"id1\", \"id2\", ...]},\n" +
    "    {\"type\": \"swap_in\", \"photoId\": \"pool-photo-id\", \"position\": 2},\n" +
    "    {\"type\": \"swap_out\", \"index\": 3},\n" +
    "    {\"type\": \"update_vibe\", \"vibe\": \"new vibe text\"},\n" +
    "    {\"type\": \"taste_update\", \"preference\": \"prefers nightlife-heavy openers\"}\n" +
    "  ]\n" +
    "}\n" +
    "\"actions\" can be empty [] if no changes are needed.";

  // Build conversation history for multi-turn
  var messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (var i = 0; i < body.history.length; i++) {
    var msg = body.history[i];
    messages.push({ role: msg.role, content: msg.text });
  }
  messages.push({ role: "user", content: body.message });

  try {
    var anthropic = new Anthropic({ apiKey: apiKey });
    var response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    var rawText = response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown fences if present
    var cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    var parsed: AIChatResponse;
    try {
      parsed = JSON.parse(cleaned) as AIChatResponse;
    } catch {
      // If JSON parsing fails, treat the whole response as a plain reply
      parsed = { reply: rawText, actions: [] };
    }

    // Validate actions
    var validActions: ChatAction[] = [];
    if (Array.isArray(parsed.actions)) {
      for (var ai = 0; ai < parsed.actions.length; ai++) {
        var action = parsed.actions[ai];
        if (action.type === "reorder" && Array.isArray(action.photoIds)) {
          validActions.push(action);
        } else if (action.type === "swap_in" && action.photoId) {
          validActions.push(action);
        } else if (action.type === "swap_out" && typeof action.index === "number") {
          validActions.push(action);
        } else if (action.type === "update_vibe" && action.vibe) {
          validActions.push(action);
        } else if (action.type === "taste_update" && action.preference) {
          validActions.push(action);
        }
      }
    }

    var result: AIChatResponse = {
      reply: parsed.reply || "I'm not sure what to do with that. Try telling me what vibe you want.",
      actions: validActions,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err: unknown) {
    console.error("[AI Chat] Anthropic error:", err);
    var errMsg = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Claude API error: " + errMsg }));
  }
}
