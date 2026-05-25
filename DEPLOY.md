# Deploy to Vercel

The web app ships to **Vercel** with serverless functions in `api/`. The Vercel project name is `dumpster-web-manus` (not `dumpster` — that's an older project that doesn't auto-deploy).

Production URL: **https://dumpster-web-manus.vercel.app**

---

## Required environment variables

Set these in **Vercel → Project (dumpster-web-manus) → Settings → Environment Variables**. Each should be set for **Production** and **Preview** (Development optional). The full canonical list is in `.env.example`.

### Anthropic (AI)
| Var | Why |
|---|---|
| `ANTHROPIC_API_KEY` | Claude Vision for AI Suggest + Captions + Valet |

### Supabase (auth + DB + storage)
| Var | Why |
|---|---|
| `VITE_SUPABASE_URL` | Client connects here for auth + DB reads |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations (credit deduction) |

### Stripe (payments)
| Var | Why |
|---|---|
| `STRIPE_SECRET_KEY` | Charges + webhook signatures |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook events |
| `STRIPE_PRICE_CREDITS_100/500/1500` | Credit pack price IDs |
| `STRIPE_PRICE_PRO_MONTHLY/YEARLY` | Subscription price IDs |
| `STRIPE_PRICE_LIFETIME` | Lifetime price ID |

### Sentry (error tracking)
| Var | Why |
|---|---|
| `VITE_SENTRY_DSN` | Client SDK reports errors here |
| `SENTRY_ORG` | For source-map upload at build time |
| `SENTRY_PROJECT` | Project slug for source-map upload |
| `SENTRY_AUTH_TOKEN` | Auth token scoped to `project:releases` |

### Upstash Redis (rate limit + daily budget)
| Var | Why |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Sliding-window rate limiter backend |
| `UPSTASH_REDIS_REST_TOKEN` | Same |
| `DAILY_BUDGET_USD` | Daily $ ceiling (default 20). When exceeded → all AI endpoints return 503 |
| `DAILY_BUDGET_ALERT_PCT` | Log warning when daily spend crosses this % (default 80) |

### Testing escape hatches (set to `1` to enable, `0` or unset to disable)
| Var | Why |
|---|---|
| `DISABLE_CREDIT_LIMIT` | Server bypasses per-user credit deduction. Auth + rate limit + daily $ budget still enforce. |
| `VITE_DISABLE_CREDIT_LIMIT` | Client bypasses the "Out of Credits" overlay. **Both must be set together** for testing to feel seamless. |

**To flip credits back on after beta testing**: set both to `0` (or delete) in Vercel and redeploy.

---

## Supabase database migrations

The web app expects four tables (RLS-enforced) and one storage bucket. Each SQL file in the repo is **idempotent** — safe to re-run.

| Migration | What | Run when |
|---|---|---|
| `supabase-cloud-sync.sql` | `user_workspaces` table (dumps/pool JSON, currently unused — kept for revival) | Once on project creation |
| `supabase-storage-uploads.sql` | `workspace-uploads` storage bucket + RLS (currently unused — photos are local) | Once on project creation |
| `supabase-ai-profile.sql` | `user_ai_profile` table for cross-device AI memory (taste profile, AI rules, caption pool) | **Required** — every AI feature touches this |

Run them in **Supabase → SQL Editor → New Query** → paste → Run. Each prints "Success. No rows returned." when applied (or already present).

---

## What's wired

| Route | Type | File |
|---|---|---|
| `/` and `/*` | Static SPA | `dist/public/` (Vite build) |
| `/api/ai-suggest` | Serverless Function (Node, 60s) | `api/ai-suggest.ts` → `server/aiSuggest.ts` |
| `/api/ai-caption` | Serverless Function (Node) | `api/ai-caption.ts` → `server/aiCaption.ts` |
| `/api/ai-chat` | Serverless Function (Node) | `api/ai-chat.ts` → `server/aiChat.ts` (Valet) |
| `/api/ig-scrub` | Serverless Function (Node) | `api/ig-scrub.ts` |
| `/api/stripe-checkout` | Serverless Function (Node) | `api/stripe-checkout.ts` |
| `/api/stripe-webhook` | Serverless Function (Node) | `api/stripe-webhook.ts` |

Every AI endpoint runs through `server/creditGate.ts` which enforces, in order:
1. **Auth required** — 401 `auth_required` if no valid Supabase JWT
2. **Per-user rate limit** — 429 (Upstash sliding window)
3. **Daily $ budget** — 503 when daily total spend exceeds `DAILY_BUDGET_USD`
4. **Credit balance** — 402 `insufficient_credits` (skipped when `DISABLE_CREDIT_LIMIT=1`)

---

## Verifying a deploy is healthy

```bash
# Replace with the live URL
URL=https://dumpster-web-manus.vercel.app

# 1) Site loads
curl -s -o /dev/null -w "%{http_code}\n" $URL    # → 200

# 2) Auth gate works on AI endpoints
curl -s $URL/api/ai-caption -X POST -H 'Content-Type: application/json' -d '{}'
# → {"error":"Sign in to use AI features.","code":"auth_required"}

# 3) Sentry SDK loaded in bundle
curl -s $URL | grep -c "VITE_SENTRY_DSN\|sentry"   # > 0
```

In the browser console on the live site:
```js
window.__SENTRY__   // should be truthy when DSN is configured
```

---

## Cost / spend monitoring

- **Anthropic dashboard** → set an org-wide monthly spend cap as the ultimate backstop
- **Upstash Redis** → check the `budget:YYYY-MM-DD` key for today's cents spent
- **Vercel logs** → search for `[dailyBudget] ⚠️ Crossed` to see alert-threshold warnings

---

## Pushing changes

```bash
git add .
git commit -m "your message"
git push origin main
# Vercel auto-deploys in ~40s.
```

To redeploy without code changes (e.g. after updating env vars):
```bash
npx vercel ls dumpster-web-manus    # find the latest production URL
npx vercel redeploy <url> --target production
```

---

## Local dev

```bash
npm install      # works — package-lock.json is canonical
npm run dev      # Vite + middleware on http://localhost:3000
```

> **Both `package-lock.json` and `pnpm-lock.yaml` exist** because the project's been touched by both managers. npm wins (it's what CI uses). If you use pnpm and the lockfiles drift, delete `pnpm-lock.yaml` and `pnpm install` from scratch — don't commit a regenerated one without also bumping `package-lock.json` to match.

`.env` (gitignored) holds your local secrets. Copy `.env.example` and fill in values. Local dev fails open when Upstash env vars are missing (rate limit and budget are bypassed) — see `server/rateLimit.ts` and `server/dailyBudget.ts`.
