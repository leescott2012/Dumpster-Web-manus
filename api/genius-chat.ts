/**
 * /api/genius-chat
 * 
 * Receives a voice transcript from the user, sends it to the AI,
 * and returns a short Genius-persona response as plain text.
 * The client then pipes this text to /api/tts for voice playback.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUserFromRequest } from "../server/creditGate.js";
import { createClient } from "@supabase/supabase-js";

// Supabase client for logging
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const GENIUS_SYSTEM_PROMPT = `You are Genius, the AI core of the Chamillion Collective — a hyper-intelligent, 
calm, and slightly sardonic AI assistant built into the admin dashboard. You speak with precision and confidence. 
You are aware of the Dumpster app (an Instagram carousel photo dump creator for iOS). 
Keep responses concise — 1-3 sentences max. No markdown. Speak naturally as if through a voice interface.
Address the user as "sir" occasionally, in the style of a sophisticated AI assistant.

You have access to recent conversation history and system activity. Use this context to provide more personalized and relevant responses.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Sign in required." });

  const { transcript } = req.body as { transcript: string };
  if (!transcript?.trim()) {
    return res.status(400).json({ error: "No transcript provided." });
  }

  // Try OpenAI first, fall back to Anthropic
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  let replyText = "";

  try {
    // Fetch recent logs for context (last 15 messages)
    let recentContext = "";
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );
      const { data: logs } = await supabase
        .from("system_logs")
        .select("level, message")
        .order("created_at", { ascending: false })
        .limit(15);
      
      if (logs && logs.length > 0) {
        recentContext = "\n\nRecent conversation history:\n" + 
          logs
            .reverse()
            .map((log: any) => `[${log.level}] ${log.message}`)
            .join("\n");
      }
    } catch (e) {
      console.warn("Could not fetch logs:", e);
    }

    if (openaiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 150,
          messages: [
            { role: "system", content: GENIUS_SYSTEM_PROMPT + recentContext },
            { role: "user", content: transcript },
          ],
        }),
      });
      const data = await response.json() as any;
      replyText = data.choices?.[0]?.message?.content?.trim() || "";
    } else if (googleKey) {
      // Google Gemini fallback
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: GENIUS_SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: transcript }] }],
            generationConfig: { maxOutputTokens: 150 },
          }),
        }
      );
      const data = await response.json() as any;
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } else if (anthropicKey) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 150,
          system: GENIUS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: transcript }],
        }),
      });
      const data = await response.json() as any;
      replyText = data.content?.[0]?.text?.trim() || "";
    } else {
      replyText = "Neural link established, sir. However, no AI model key is configured in the environment. Please add OPENAI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY to your Vercel environment variables.";
    }

    if (!replyText) {
      replyText = "I processed your request, sir, but received an empty response from the neural core. Please try again.";
    }

    // Log the interaction to system_logs
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );
      
      await supabase.from("system_logs").insert([
        { level: "USER", message: transcript },
        { level: "GENIUS", message: replyText }
      ]);
    } catch (e) {
      console.warn("Could not log to database:", e);
    }

    return res.status(200).json({ reply: replyText });
  } catch (err: any) {
    console.error("[genius-chat] error:", err);
    return res.status(500).json({ error: "Neural core error: " + err.message });
  }
}
