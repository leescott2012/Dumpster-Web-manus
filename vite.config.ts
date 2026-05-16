import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";

function aiSuggestPlugin(): Plugin {
  return {
    name: "ai-suggest-middleware",
    configureServer(server) {
      server.middlewares.use("/api/ai-suggest", async (req, res) => {
        const { handleAISuggest } = await import("./server/aiSuggest.js");
        await handleAISuggest(req, res);
      });
      server.middlewares.use("/api/ai-caption", async (req, res) => {
        const { handleAICaption } = await import("./server/aiCaption.js");
        await handleAICaption(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ prefix) into process.env
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");
  Object.assign(process.env, env);

  return {
    plugins: [react(), tailwindcss(), aiSuggestPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
      },
    },
    envDir: path.resolve(import.meta.dirname),
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      target: ["es2015", "safari13"],
    },
    server: {
      port: 3000,
      strictPort: false,
      host: true,
    },
  };
});
