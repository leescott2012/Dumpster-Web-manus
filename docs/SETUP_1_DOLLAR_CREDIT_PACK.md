# Setup: $1 → 30 Credits Pack

**For:** Manus
**Goal:** Finish wiring the new `$1.00 → 30 credits` pack so it can actually be purchased. The **code is already done and merged**; what remains is Stripe + Vercel config, then a deploy.

---

## Background (already done — no action needed)

The app now knows about a pack with id `credits_30`:

- `client/src/lib/credits.ts` — pack listed in `CREDIT_PACKS` (`$1.00`, 30 credits)
- `api/stripe-checkout.ts` — `PRICE_MAP.credits_30 = process.env.STRIPE_PRICE_CREDITS_30`
- `api/stripe-webhook.ts` — `CREDIT_AMOUNTS.credits_30 = 30` (grants 30 credits on purchase)

Also rebalanced per-action credit costs so **1 credit ≈ 1¢ of real AI cost** (caption 3, suggest 25, chat 1, recycle 3). No action needed on this — just context.

The pack will **not work** until the two steps below are completed, because `STRIPE_PRICE_CREDITS_30` is empty → checkout returns `"Price not configured"`.

---

## Step 1 — Create the price in Stripe

> ⚠️ **Mode matters.** Create the price in the **same mode your production app uses**.
> - Live app w/ live keys → **Live mode** (toggle, top-right of dashboard)
> - End-to-end testing w/ Stripe test cards → **Test mode**, and use the test `price_...` ID
> Match whatever the other `STRIPE_PRICE_CREDITS_*` vars use.

1. Go to <https://dashboard.stripe.com/products/create>
2. **Name:** `30 Credits` (description optional, e.g. "Starter credit pack")
3. **Pricing model:** One time
4. **Amount:** `1.00` **USD**
5. Click **Save product**
6. On the product page, locate the price and **copy its API ID** — it looks like `price_1AbC...`

---

## Step 2 — Set the env var in Vercel

1. Vercel → project `dumpster-web` (or current prod project) → **Settings → Environment Variables**
2. Add a new variable:
   - **Name:** `STRIPE_PRICE_CREDITS_30`
   - **Value:** the `price_...` ID from Step 1
   - **Environments:** `Production` (add `Preview` too if testing on preview deploys)
3. Save.

> Naming must be **exactly** `STRIPE_PRICE_CREDITS_30` — `api/stripe-checkout.ts` reads `process.env.STRIPE_PRICE_CREDITS_30`.

---

## Step 3 — Redeploy

Env var changes only take effect on a new deployment. Trigger a redeploy of the latest production commit (Vercel dashboard → Deployments → Redeploy, or push a commit).

---

## Step 4 — Verify end-to-end

1. Open the live app → credits menu. Confirm the **$1.00 / 30 Credits "Try it"** pack appears (it sorts first).
2. Click it → should redirect to Stripe Checkout showing **$1.00** (not "Price not configured").
3. Complete payment (real $1, or a Stripe **test card** `4242 4242 4242 4242` if in Test mode).
4. After redirect back, confirm the account balance increased by **30 credits**.
5. (Optional) In Stripe → Webhooks, confirm `checkout.session.completed` fired and the app returned `200`.

### If it fails
| Symptom | Cause / fix |
|---|---|
| "Price not configured" | `STRIPE_PRICE_CREDITS_30` missing/misnamed, or not redeployed |
| Checkout shows wrong amount | Price created with wrong amount → recreate at `1.00 USD` |
| Paid but no credits granted | Wrong Stripe mode (price vs webhook keys mismatch), or webhook not receiving events — check Stripe → Webhooks logs |

---

## Checklist

- [ ] Stripe price created at `$1.00 USD` one-time (correct mode)
- [ ] `price_...` ID copied
- [ ] `STRIPE_PRICE_CREDITS_30` set in Vercel (Production)
- [ ] Redeployed
- [ ] Pack visible in app and checkout shows $1.00
- [ ] Test purchase granted 30 credits
