# Dumpster — Native iOS Port Checklist

Tracks every web feature that needs a SwiftUI / iOS equivalent. **This file is kept current automatically — Claude updates it whenever a web feature ships that affects native parity.** Don't ask, just check this file.

Status legend: `🟢 done on web` · `⚪ port pending on iOS` · `🛑 web-only by design` · `🟡 in flight`

---

## 1. Cross-device sync (AI profile only)

| | Web | Native |
|---|---|---|
| Status | 🟢 | ⚪ |
| File / module | `client/src/lib/aiProfileSync.ts`, `client/src/lib/captionPool.ts` | (new `AIProfileSync.swift`) |

**What syncs:** `taste_profile` (string), `ai_rules` (string), `caption_pool` (array). All under Supabase `public.user_ai_profile` keyed by `user_id`.

**What does NOT sync:** dumps, photos, workspace state. Each device is its own world.

**Caption shape:** `{ id, text, style, favorited, banned, deleted?, createdAt, dumpId? }`. `deleted` is a tombstone — don't filter on write; mark and propagate.

**Merge semantics on sign-in:**
- Cloud authoritative for `favorited / banned` flags.
- Tombstone (`deleted=true`) on either side wins.
- Dedup by `(style, text)` lowercase-trim after id-merge to handle legacy duplicates.

**Seed IDs are deterministic:** `seed-<djb2hash(style+text)>` so iOS and web produce identical IDs for the same seed text. Reference djb2 implementation lives in `captionPool.ts:seedId()`.

**Debounce:** 2s after any mutation, upsert to Supabase.

---

## 2. Bug reporting

| | Web | Native |
|---|---|---|
| Status | 🟢 | ⚪ |
| File | `client/src/components/BugReportButton.tsx` | (new `BugReportSheet.swift`) |

Floating right-edge pill with bug icon → opens sheet with textarea + optional email → submits to **Sentry `captureFeedback`**.

**Auto-tags every report with:** `source=in-app-bug-button`, `signed_in`, `user_id`, `url`, `viewport`, `userAgent`.

Native iOS already has Sentry SDK — use `SentrySDK.capture(feedback:)`.

---

## 3. Caption pool deletion

| | Web | Native |
|---|---|---|
| Status | 🟢 | ⚪ |

`removeCaption(id)` sets `deleted=true` rather than filtering the row out. `loadCaptions()` filters tombstones for UI; `loadCaptionsRaw()` includes them for the sync layer.

**Cloud always writes the raw list with tombstones included.**

---

## 4. Auto Gen — Advanced filters

| | Web | Native |
|---|---|---|
| Status | 🟢 | ⚪ |
| File | `client/src/components/AutoGenAdvanced.tsx` | (new `AutoGenAdvanced.swift`) |

Collapsible "Advanced" section inside the Auto Gen sheet:

- **Date range** (from/to) — filters on `photo.meta.takenAt`. Native `DatePicker` is the iOS equivalent (matches the wheel UI user asked for).
- **Time-of-day range** (from/to in HH:MM) — filters on the clock hour of `takenAt`. **Hard window**: photo with no metadata is excluded.
- **Category chips** — multi-select, **OR** logic (any chip match).
- **Mix mode toggle** exposing sub-checkboxes:
  - *Surprise me* — bypasses date/time/category filters
  - *Shuffle on re-gen* — randomize input order each press
- **Vibe note** — freeform textarea passed to AI as `userHint` in the request body (server appends as "User instructions: …" in the prompt).

### Hard rule (NOT a toggle)
Photos already used in any dump are **always** excluded from Auto Gen, every code path. Surprise mode still respects this. Permanent label in the UI surfaces the rule.

Filter application logic lives in `applyAutoGenFilters()` in `AutoGenAdvanced.tsx`. Port the logic verbatim.

---

## 5. Photo upload pipeline (EXIF)

| | Web | Native |
|---|---|---|
| Status | 🟢 | ⚪ |
| File | `client/src/lib/exif.ts` (uses `exifr`) | (new — use `PHAsset` / `ImageIO`) |

**Order matters: extract EXIF BEFORE downscale.** The downscale step strips EXIF.

**PhotoMeta fields captured:**
```ts
{ takenAt, lat, lng, camera, lens, iso, focalLength, fStop, shutterSpeed,
  format, orientation, width, height, fileSize }
```

**Persist on the photo record** so subsequent sessions still have it.

**Sent to AI in two ways:**
- `/api/ai-suggest`: per-photo `metaLine` appended to each photo's prompt entry, e.g. `[taken 2024-09-12 14:32 · iPhone 14 Pro · 37.78,-122.41]`.
- `/api/ai-caption`: batch summary at top — `Date range: ...`, `Location: ...`, `Shot on: ...`.

**Offline auto-gen heuristic** adds +2 score for photos taken within 7 days of the newest in the pool.

---

## 6. Lightbox info panel

| | Web | Native |
|---|---|---|
| Status | 🟢 | ⚪ |
| File | `client/src/components/PhotoInfoPanel.tsx`, `PhotoLightbox.tsx` | (new) |

Apple-Photos-style metadata card. On web: **(i) toggle button** in lightbox header. On native iOS: **swipe-up gesture** to reveal (user's chosen interaction).

**Card sections (all conditional on data presence):**
- Day · date · time
- Filename
- Camera + format badge (HEIF, JPEG, …)
- Lens / focal length / f-stop
- Resolution (MP, WxH) + file size
- Exposure row: ISO, mm, ƒ, shutter
- Map preview at GPS coords + decimal-degree label

**Map source:**
- **Web:** Google Static Maps via Frontend Forge proxy (pending swap to MapKit JS once Apple Dev Program is active).
- **Native:** MapKit (free, no token needed in-app).

---

## 7. Pricing / commerce

| | Web | Native |
|---|---|---|
| Status | 🟢 LIVE Stripe | 🛑 must use IAP |

**Web:** Stripe Live keys + webhook at `/api/stripe-webhook` handle:
- `checkout.session.completed` → grant credits / set subscription tier
- `customer.subscription.deleted` → revert to free
- `customer.subscription.updated` → placeholder (no-op currently)
- `invoice.paid` → monthly credit drop on renewal

**Native iOS:** **must use Apple In-App Purchase** (App Store rules forbid Stripe checkouts inside the iOS app). Implementation needs:
- StoreKit 2 products mirroring the 6 Stripe prices (100 Credits / 500 / 1500 / Pro Monthly / Pro Yearly / Lifetime)
- New backend endpoint `POST /api/iap-verify` that verifies Apple's transaction receipt server-side and grants credits via the same `addCredits()` path
- Subscription status sync via App Store Server Notifications V2 → backend webhook (parallel to current `stripe-webhook.ts`)

**Credit costs (keep in sync client+server):** `ai_caption=1`, `ai_suggest=15`, `ai_chat=2`.

**Daily budget circuit breaker:** `$10/day` in `server/dailyBudget.ts` — all AI endpoints 503 when tripped. Server-side, applies to native too.

**Sliding-window rate limit:** Upstash Redis per user per action. Server-side, applies to native too.

---

## 8. Privacy / security

| Rule | Applies to native? |
|---|---|
| `userId` ALWAYS pulled from Supabase JWT, never request body | ✅ yes |
| Server-side Sentry capture in all error catches | ✅ yes (already done) |
| `IS_OWNER` flag (URL `?owner=1`) for personal data | 🛑 web-only concept |
| EXIF never logged or sent to Sentry | ✅ yes |

---

## 9. Observability

- **Sentry DSN** (same for web + native + server): `cac00263ad517cfa1ab22990dff35fc2@o4511424233013248.ingest.us.sentry.io/4511424250576896`
- **Sentry org slug:** `dumpster` · **project:** `javascript-react` (native should add a separate iOS project under the same org)
- In-app bug feedback API call (see §2)
- Issues + feedback queryable via `SENTRY_AUTH_TOKEN` (held in local `.env`)

---

## 10. Items native can leapfrog

Web doesn't have these yet — opportunity for native to ship first:

- 🔔 **Push notifications** — APNs setup, weekly "you have unfinished dumps" nudge, post-purchase confirmations
- 📸 **Photos Library live access** — bypass file upload UX entirely with PHAsset picker
- 🎬 **Smart photo grouping using on-device Vision** — face/scene detection before sending to Claude
- 🔋 **Battery / network awareness** — defer cloud sync when on cellular or low battery

---

## 11. Native → Admin dashboard wiring

The **GENIUSS admin dashboard** (`/admin`) is web-only by design, but its data is **backend-sourced, not client-sourced**. It reads entirely from Supabase + Stripe via `server/handlers/admin-stats.ts` (service_role, bypasses RLS). So native usage flows into the same dashboard **automatically** for anything the server records — no per-client dashboard exists or is needed.

### What connects automatically (zero native work)
As long as the iOS app (a) authenticates against the **same Supabase project** and (b) routes AI calls through the **same backend endpoints** (`/api/ai-caption`, `/api/ai-suggest`, `/api/ai-chat`):

| Dashboard data | Backend source | Why it's automatic |
|---|---|---|
| Total users, join date, last sign-in | `auth.users` | same Supabase Auth |
| Credits, subscription tier | `profiles` | shared table |
| AI feature usage (counts + credit spend), per-user `ai_calls`/`credits_used` | `credit_transactions` | written **server-side** in `server/supabaseAdmin.ts` on every gated AI call |

### Gap A — Activity events (DAU / uploads / exports) ⚪
These are the **only** dashboard inputs emitted client-side (`client/src/lib/analytics.ts`), so native must emit its own. Insert directly into `public.activity_log` via the Supabase Swift SDK using the signed-in user's JWT — RLS policy `users_insert_own_activity` already permits `auth.uid() = user_id`, so **no new endpoint is required**. Fire-and-forget; never block UI.

Emit the exact same three events with the exact metadata shapes the aggregator reads:

| Event | When | Metadata | Read by dashboard as |
|---|---|---|---|
| `session_start` | once per sign-in | _(none)_ | DAU + active_today/active_week |
| `photo_uploaded` | after photos land in pool | `{ "count": <n> }` | per-user `photos_uploaded` (sums `count`) |
| `dump_exported` | after a full-dump export | `{ "photo_count": <n> }` | per-user `exports` (counts rows) |

```swift
// AIProfileSync.swift / Analytics.swift — mirror analytics.ts:28 verbatim
func track(_ event: String, metadata: [String: Any]? = nil) async {
    guard let userId = currentUserId else { return }
    if userId == adminUserId { return }   // keep owner's own usage out of analytics
    try? await supabase.from("activity_log").insert([
        "user_id": userId, "event": event, "metadata": metadata
    ]).execute()                          // fire-and-forget; ignore errors
}
```

**Owner exclusion:** web skips analytics for `IS_OWNER` accounts. Native is account-based — skip tracking when `userId == ADMIN_USER_ID` so your own usage doesn't pollute the data (shown above).

### Gap B — IAP revenue ⚪
The revenue chart pulls Stripe `balanceTransactions` (`fetchRevenue()` in `admin-stats.ts:98`). Apple IAP money never touches Stripe, so it won't appear. To unify:
1. Verify IAP receipts in the planned `POST /api/iap-verify` endpoint (§7).
2. Record each verified purchase into a revenue table (or reuse `credit_transactions` with a positive `amount` + `type='iap_purchase'`).
3. Extend `fetchRevenue()` to merge that source into the daily buckets + today/week/month sums alongside Stripe.

### Summary
Point native at the same Supabase + backend → **users, credits, tiers, and AI usage land in the dashboard with no changes.** Add the three `activity_log` inserts (Gap A) and an IAP revenue feed (Gap B) for full parity.

---

_Last updated by Claude: 2026-06-14 · added §11 Native → Admin dashboard wiring. Prior: 2026-05-28 `live-stripe-deploy`. NOTE: §§1–10 predate the GENIUSS/reactor/admin wave, owner cross-device sync write-back, bulk delete, IG Scrub, and the $1 pack — those web features are not yet itemized here._
