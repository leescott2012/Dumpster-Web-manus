import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { handleAISuggest } from "./aiSuggest.js";
import { handleAICaption } from "./aiCaption.js";
import { handleAIChat } from "./aiChat.js";
import { handleAILabel } from "./aiLabel.js";
import { checkCredits } from "./creditGate.js";
import adminStats from "./handlers/admin-stats.js";
import adminUserDetail from "./handlers/admin-user-detail.js";
import bugReport from "./handlers/bug-report.js";
import geniusChat from "./handlers/genius-chat.js";
import tts from "./handlers/tts.js";

// Vercel-style handlers that use IncomingMessage/ServerResponse directly
import stripeCheckoutHandler from "../api/stripe-checkout.js";
import stripeWebhookHandler from "../api/stripe-webhook.js";
import workspaceHandler from "../api/workspace.js";
import uploadPhotoHandler from "../api/upload-photo.js";
import lifetimeSlotsHandler from "../api/lifetime-slots.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── AI Routes ─────────────────────────────────────────────────────────────
  app.post("/api/ai-suggest", (req, res) => {
    handleAISuggest(req, res);
  });

  app.post("/api/ai-caption", (req, res) => {
    handleAICaption(req, res);
  });

  app.post("/api/ai-chat", (req, res) => {
    handleAIChat(req, res);
  });

  // AI Label — credit-gated like the Vercel function
  app.post("/api/ai-label", async (req, res) => {
    const gate = await checkCredits(req, res, "ai_label");
    if (!gate.proceed) return;
    handleAILabel(req, res);
  });

  // ─── Stripe Routes ─────────────────────────────────────────────────────────
  app.post("/api/stripe-checkout", (req, res) => {
    stripeCheckoutHandler(req, res);
  });

  // Stripe webhook needs the raw body for signature verification.
  // The handler reads the raw body itself via stream, so we must NOT
  // apply express.json() before it.
  app.post("/api/stripe-webhook", (req, res) => {
    stripeWebhookHandler(req, res);
  });

  // ─── Workspace & Upload Routes ─────────────────────────────────────────────
  app.post("/api/workspace", (req, res) => {
    workspaceHandler(req, res);
  });

  app.post("/api/upload-photo", (req, res) => {
    uploadPhotoHandler(req, res);
  });

  // ─── Lifetime Slots (GET) ──────────────────────────────────────────────────
  app.get("/api/lifetime-slots", (req, res) => {
    lifetimeSlotsHandler(req, res);
  });

  // ─── Admin Routes ──────────────────────────────────────────────────────────
  // These mirror the Vercel rewrites in vercel.json.
  // The handlers use VercelRequest/VercelResponse types, but Express's
  // req/res are compatible enough (query, body, headers, status(), json()).
  app.all("/api/admin-stats", (req, res) => {
    (adminStats as any)(req, res);
  });

  app.all("/api/admin-user-detail", (req, res) => {
    (adminUserDetail as any)(req, res);
  });

  app.all("/api/bug-report", (req, res) => {
    (bugReport as any)(req, res);
  });

  app.post("/api/genius-chat", (req, res) => {
    (geniusChat as any)(req, res);
  });

  app.post("/api/tts", (req, res) => {
    (tts as any)(req, res);
  });

  // ─── Static Files & SPA Fallback ──────────────────────────────────────────
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

