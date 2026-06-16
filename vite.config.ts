import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
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
      server.middlewares.use("/api/ai-label", async (req, res) => {
        const { handleAILabel } = await import("./server/aiLabel.js");
        await handleAILabel(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ prefix) into process.env
  const env = loadEnv(mode, path.resolve(import.meta.dirname), "");
  Object.assign(process.env, env);

  // Only enable Sentry source-map upload when the auth token is present.
  // Lets local builds and PR previews work without Sentry credentials.
  var sentryEnabled = Boolean(
    process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
  );

  return {
    plugins: [
      react(),
      tailwindcss(),
      aiSuggestPlugin(),
      ...(sentryEnabled
        ? [
            sentryVitePlugin({
              org: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT,
              authToken: process.env.SENTRY_AUTH_TOKEN,
              // Tag the release with the commit SHA when Vercel provides it
              release: { name: process.env.VERCEL_GIT_COMMIT_SHA },
              telemetry: false,
            }),
          ]
        : []),
    ],
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
      // "hidden" = generate .map files for Sentry but don't link them from
      // the JS bundle, so they aren't shipped to end-users.
      sourcemap: sentryEnabled ? "hidden" : false,
    },
    server: {
      port: 3000,
      strictPort: false,
      host: true,
    },
  };
});
