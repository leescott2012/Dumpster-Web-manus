# Deploy to Vercel

The web app is configured for **Vercel** with serverless functions in `api/`.

## One-time setup

1. **Push to GitHub** (skip if already there):
   ```bash
   cd /Users/leescott/Desktop/photos/dumpster-web
   git init && git add . && git commit -m "Initial Dumpster web"
   git remote add origin git@github.com:leescott2012/Dumpster-Web-manus.git
   git push -u origin main
   ```

2. **Import the repo in Vercel**:
   - Go to https://vercel.com/new
   - Pick the GitHub repo
   - Framework Preset: **Other** (vercel.json handles it)
   - Build Command: leave default (uses vercel.json)
   - Output Directory: leave default (uses vercel.json)
   - **Add Environment Variable**: `ANTHROPIC_API_KEY` = your Claude key (the one in `.env`)

3. **Deploy** — Vercel auto-builds and ships. Done.

## What's wired

| Route | Type | File |
|---|---|---|
| `/` and `/*` | Static SPA | `dist/public/` (Vite build) |
| `/api/ai-suggest` | Serverless Function (Node, 60s, 1GB) | `api/ai-suggest.ts` → `server/aiSuggest.ts` |
| `/api/ai-caption` | Serverless Function (Node, 30s, 512MB) | `api/ai-caption.ts` → `server/aiCaption.ts` |

The shared handlers in `server/` work for **all three** environments: Vite dev middleware, Express prod server, and Vercel serverless.

## Local dev unchanged

```bash
pnpm dev   # or npm run dev — runs Vite + middleware on :3000
```

## Future env vars

When you wire up more providers, add these in Vercel → Settings → Environment Variables:
- `OPENAI_API_KEY` (for GPT-4o fallback)
- `STRIPE_SECRET_KEY` (for Pro subscriptions)
- `INSTAGRAM_SCRAPE_TOKEN` (for Instagram Scrub backend)

## After first deploy

Your live URL will be something like `dumpster-web-manus.vercel.app`. Add a custom domain in Vercel → Domains.
