# Dumpster — Web → Native Parity Tracker

Canonical checklist mapping **every web feature** to its native (SwiftUI / iOS) status. This is the source of truth that drives the iOS porting work — keep it current whenever a feature ships on either side.

**Native app:** `~/Documents/AI/Dumpster/dumpster/ios/DumpsterIOS` (the `dumpster` monorepo). Other Xcode projects on disk (`~/Desktop/DumpsterIOS`, `~/Desktop/photos/DumpsterApp`, `dumpster/ios-v2`) are dead/duplicate stubs; ignore them. The Xcode project uses **explicit file registration** (no synchronized groups), so new `.swift` files must be added to `project.pbxproj` or they won't compile in.

**2026-07-01: merged & pushed.** `feat/native-dashboard-analytics` (`3c30440` cloud layer + dashboard analytics, `73cfa31` Instagram URL-scheme fix, `158bc07` EXIF-preserving import) is now fast-forwarded into `main` and pushed (`4c80457`). Native `main` also got a same-day fix (`3f64afe`): `AIProfileSync.scheduleSave()` was fully built but never called from any UI — taste profile / AI-rules edits and caption favorite/ban/delete now actually push to Supabase instead of silently staying device-local. Caption delete also switched from a hard `modelContext.delete` to tombstone (`deleted=true`) to match the sync merge semantics. Verified with a clean `iphonesimulator` build.

**Shared backend:** Supabase project `zstsigakqcggerhjbawj` (`dumpster-prod`) + Stripe (web) / Apple IAP (native). Both clients hit the same project, so users, credits, AI usage, and analytics aggregate in one dashboard.

**Status legend:** ✅ done · 🟡 partial · ⚪ not started (gap) · 🛑 web-only by design · 🟢 native is ahead

> _Last verified 2026-07-01 via grep + file reads (no build this pass). Items tagged **(verify)** are inferred from symbol presence, not confirmed by reading the implementation._

---

## Master parity matrix

### Core workspace — photo dumps
| Web feature | Native | Notes |
|---|---|---|
| Photo pool (grid) | ✅ | `PhotoPoolView`, `PhotoCardView` |
| Dumps (carousels) create/arrange/rename | ✅ | `DumpCardView`, `DumpMenuSheet` |
| Drag-and-drop reorder | ✅ | native gestures |
| Lightbox (fullscreen viewer) | ✅ | `LightboxView` |
| **Lightbox info panel + map** (§A) | ⚪ | `LightboxView` is photo-only (84 lines, no metadata card, no MapKit) |
| Per-photo context menu | ✅ | `PhotoMenuSheet` |
| Recycle bin / restore deleted | 🟡 | native has `UndoManager` (undo), not a persistent trash like web's `RecycleSheet` |
| Bulk multi-select delete | 🟡 | selection exists for add-to-dump; bulk-delete path **(verify)** |
| Duplicate-photo detection | 🟡 | ported 2026-07-01 (`PhotoDupes.swift`, direct port of `photoDupes.ts`) — amber border + "DUPE?" badge wired into `PhotoPoolView`/`PhotoCardView`. Not yet threaded into `DumpCardView` carousels (web shows the badge everywhere via one shared component + prop; native's dump-context call site would need the same set passed down — left out this pass) |
| Local persistence | ✅ | SwiftData + Documents (vs web localStorage) |
| "Find in Photos" | 🟢 | native has on-device Vision instead (see below) |

### Photo import & processing
| Web feature | Native | Notes |
|---|---|---|
| Photo import | ✅ | `PhotosPicker` → `importPickedPhotos` |
| EXIF / PhotoMeta capture (§B) | ✅ | fixed 2026-07-01 (`PhotoEXIF.swift`) — populates all 14 `DumpPhoto` fields via `ImageIO` straight off the original bytes `PhotoStorageManager` already preserves; no PHAsset/Photo-Library permission needed |
| IG Scrub (import media *from* Instagram) | ✅ | `ScrubService`, `SavedScrub`, `ScrubInstagramSheet` |
| Cloud photo upload to Storage | ⚪ | native photos are device-local only |

### AI features
| Web feature | Native | Notes |
|---|---|---|
| AI caption generation | ✅ | `CaptionService`, `LLMService` |
| AI suggest / clustering | ✅ | `AISuggestView` |
| **Auto-Gen advanced filters** (§C) | 🟡 | basic category filter only (`PoolFilterMenu`); no date-range / time-of-day / vibe-note / surprise mode |
| Photo category taxonomy | ✅ | web's Claude-vision Scan now emits the same 11 categories as native's on-device `PhotoAnalyzer` (`3ac9dab`, web-side change only) |
| Caption pool — styles, favorite/ban, tombstone delete | ✅ | `DumpCaption`, `CaptionPoolView` |
| AI memory — taste profile + AI rules sync (§F) | ✅ | fixed 2026-07-01 (`3f64afe`) — `scheduleCloudSync()` now wired into `FileCabinetMenuView` editors and `CaptionPoolView` favorite/ban/delete |
| Dump chat | ✅ | `DumpChatSheet`, `DumpChatMessage` |

### Cross-device sync
| Web feature | Native | Notes |
|---|---|---|
| AI profile sync (taste/rules/captions) | ✅ | `AIProfileSync` (deterministic seed IDs match web) |
| Full workspace (photos/dumps) sync | ⚪ | native is local-only; web's is owner-beta too |

### Auth & accounts
| Web feature | Native | Notes |
|---|---|---|
| Magic-link auth | ✅ | `AuthManager`, `SignInView` |
| OAuth providers (Google/Apple/Facebook) | ⚪ | web `AuthSheet` has them; native is magic-link only **(verify)** |
| Account / owner mode | 🟡 | account-based; web's `IS_OWNER` URL concept is web-only |
| Demo / guest mode | ⚪ | native is sign-in-first; web has `DemoBanner`/`WelcomeOverlay` |

### Monetization & credits
| Web feature | Native | Notes |
|---|---|---|
| Credit system + balance | ✅ | `CreditManager` |
| Commerce | 🟡 | native IAP client built (`SubscriptionManager`, `PaywallView`, `Configuration.storekit`) but **server `/api/iap-verify` doesn't exist** (§D) |
| Stripe checkout | 🛑 | web-only; native must use Apple IAP |
| Lifetime purchase | ⚪ | web has it; no native IAP lifetime product **(verify)** |
| Credit gate — costs, rate limit, daily budget | ✅ | server-side, shared backend applies to native |
| Out-of-credits / paywall trigger | ✅ | `CreditManager` → `PaywallView` |
| Referral | ⚪ | half-built on web (link only, no attribution/reward); none on native |

### Sharing & export
| Web feature | Native | Notes |
|---|---|---|
| Dump share / export | ✅ | `DumpCardView.shareDump` (UIActivityViewController) |
| Instagram export hand-off | 🟢 | native-specific: camera-roll + deep-link (`InstagramExporter`); `Info.plist` URL-scheme fix applied 2026-06-22 |

### Observability & reliability
| Web feature | Native | Notes |
|---|---|---|
| Sentry / crash reporting | ✅ | `CrashReporter` |
| In-app bug report | ✅ | `BugReportSheet` |
| Auto-crash report + user form | ✅ | `CrashReporter` |
| **Dashboard analytics** (§E) | ✅ | `Analytics.swift` (added 2026-06-22) — emits `session_start`/`photo_uploaded`/`dump_exported` to shared `activity_log`, tagged `platform:"ios"`, owner excluded |

### UX, onboarding & shell
| Web feature | Native | Notes |
|---|---|---|
| Guided tour / onboarding | ✅ | `OnboardingView`, `SpotlightTutorialView` |
| Main menu / settings | ✅ | `SettingsView`, `FileCabinetMenuView` |
| Appearance options (dark/light, card size) | 🟢🐛 | web shows "coming soon"; native is actually **ahead** — full Theme Mode (Light/Dark/System) + 6 accent colors (`FileCabinetMenuView.AppearanceTabView`) — but has a real bug, see §G |
| Legal pages (Privacy/Terms) | 🟡 | links present in `SignInView`/`PaywallView` **(verify)** |
| PWA install | 🛑 | n/a — native *is* the native app |

### 🛑 Web-only by design (correctly absent on native — not gaps)
The entire **GENIUSS admin block**: `/admin` dashboard (DAU/revenue/feature-usage analytics, user drill-down), GENIUSS AI assistant (DB tool-use), Arc Reactor voice (STT→LLM→TTS), WebGL reactor visuals, console terminal, system/maps widgets. Owner-only ops tooling; no reason to ship in the consumer app. Native instead **feeds** this dashboard via §E.

### 🟢 Native is ahead (web doesn't have these)
- On-device **Vision** photo analysis / auto-labeling (`PhotoAnalyzer`)
- **Instagram export hand-off** (camera-roll + deep-link)
- **Apple IAP** paywall (StoreKit 2)

---

## Detailed porting specs (open items)

### §A — Lightbox info panel + map  ⚪
Apple-Photos-style metadata card, revealed by **swipe-up** on native (vs web's (i) button). Sections (all conditional on data): day·date·time · filename · camera + format badge · lens/focal/f-stop · resolution + file size · exposure row (ISO, mm, ƒ, shutter) · **map at GPS coords**. Web uses Google Static Maps; **native should use MapKit** (free, no token). No longer blocked — §B shipped 2026-07-01, real EXIF is now on every newly-imported `DumpPhoto`. This is now a standalone SwiftUI view-building task (new card UI + MapKit), not a data-plumbing one — left for a pass with actual layout/gesture decisions rather than guessing them.

### §B — EXIF / PhotoMeta capture  ✅ (done 2026-07-01)
`PhotoEXIF.swift` reads `takenAt, lat, lng, camera, lens, iso, focalLength, fStop, shutterSpeed, imageFormat, orientation, pixelWidth/Height, fileSize` straight off the original `Data` via `ImageIO` (`CGImageSourceCopyPropertiesAtIndex`), called from `importPickedPhotos` right after `PhotoStorageManager.saveImageData` and before insert — no PHAsset fetch, no Photo Library permission needed, since the original bytes (preserved since `158bc07`) already carry any EXIF the source had. Feeds AI prompts (`metaLine`) and unblocks §A. Also backs duplicate-photo detection (fileSize + pixel dims).

### §C — Auto-Gen advanced filters  🟡
Port `applyAutoGenFilters()` from web `AutoGenAdvanced.tsx`: date range (`DatePicker`), time-of-day window (hard — no-metadata photos excluded), category chips (multi-select, OR logic), mix mode (surprise = bypass filters; shuffle = randomize order), vibe note (freeform → AI `userHint`). **Hard rule:** photos already used in any dump are *always* excluded.

### §G — Three UI bugs found via simulator audit  ✅ all fixed (found + fixed 2026-07-01)
Booted an iPhone 17 Pro simulator, built + installed + launched the app, and drove it directly (screenshots + taps) rather than just reading code. Three reproducible issues, all fixed same-day (native commit `da48fa6`), each re-verified live in the simulator after the fix:

1. **Appearance menu didn't reflect its own theme setting.** ✅ Fixed. Root cause: `FileCabinetMenuView.swift`'s root shell (backdrop, header, tab list) and `AppearanceTabView` backgrounded with a literal `Color.black`/`.white.opacity(...)` instead of the `Theme.bg(appState.colorMode, cs)` helper `PhotoPoolView` already used correctly. Converted `darkBg`/`cardBg`/`subtleBorder` to `Theme`-backed computed properties. **Scope note:** only the root shell + Appearance tab were fixed — `AISettingsTabView` (884 lines), `MyDumpsTabView`, `PhotoPoolTabView`, `AboutHelpTabView`, `SocialMediaTabView` still hardcode dark colors (~150 more references across those 5 views) and need the same treatment as a separate pass.
2. **Lightbox close (X) button was unresponsive.** ✅ Fixed. Root cause, found by testing: the button's `.padding(20)` top clearance sat underneath the Dynamic Island/status-bar safe-area band, where taps don't reach the app — not a hit-target-size issue as first suspected. Other working dismiss buttons in this app (`FileCabinetMenuView`'s `cabinetHeader`) use `.padding(.top, 70)`; matched that.
3. **~300-400ms perceptible lag opening a photo.** ✅ Fixed. Root cause: `onDoubleTap` was never passed by any caller anywhere in the codebase, so the `.onTapGesture(count: 2)` recognizer's fallback action was identical to the single-tap action — pure dead weight forcing SwiftUI's double-tap disambiguation wait on every tap. Removed the count:2 recognizer and the dead `onDoubleTap` parameter entirely.

Also noted, not a bug: `DebugSeeder`-seeded pool mixes real bundled photos with plain numbered color-tile placeholders — fine for a dev build, worth confirming it's excluded from release/TestFlight builds.

### §H — Backend security audit + fixes (2026-07-01)
Full audit of `api/` and `server/` (~3,300 lines) via 5 parallel focused reviews (auth/core, payments, AI endpoints, admin/GENIUSS, uploads/misc), then fixed everything Critical and High plus most Medium findings same-day.

**Fixed:**
- **CRITICAL — GENIUSS arbitrary SQL execution.** `genius-chat.ts`'s `query_database`/`write_database` tools forwarded the model's free-form `sql` string straight to Postgres RPCs `geniuss_read`/`geniuss_write` with zero validation, running as `SECURITY DEFINER` (bypasses RLS). Inspecting the live RPC definitions turned up something worse than the app-layer issue alone: `geniuss_read` wrapped the query as `(%s) t`, which Postgres accepts for a **writable CTE** (`WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x`) — the "read-only" tool could actually delete/update data. Fixed at both layers: a DB migration (`harden_geniuss_read_write_sql_validation`) makes both Postgres functions reject multi-statement input, enforce SELECT-only/INSERT-UPDATE-DELETE-only, block write keywords hidden in read queries, block `api_key_*` columns, block auth-schema writes, and enforce a table allowlist for writes; the app layer (`genius-chat.ts`) adds matching validation plus a hard `LIMIT 50` wrap that never trusts the model's own limit. Verified against 5 attack patterns (writable CTE, statement stacking, auth.users write, api_key_ read, DROP TABLE) — all blocked — plus a legit read and a legit no-op write, both succeeded.
- **CRITICAL — SSRF in `imageBase64.ts`.** Any signed-in user's photo `url` (in their own ai-caption/ai-suggest/ai-label request) was fetched server-side with zero validation — could target `169.254.169.254` (cloud metadata) or internal services. Added DNS-resolution-based IP-range blocking (RFC1918, loopback, link-local, CGNAT, IPv4 + IPv6) plus a 10MB response cap. Verified against 11 IP-range cases.
- **HIGH — `upload-photo.ts` gaps.** No size cap (added 20MB), client-claimed MIME type trusted with no content check (added magic-byte verification for jpeg/png/webp/gif — closes a stored-XSS-via-mislabeled-SVG angle), and the user-supplied `id` was spliced unsanitized into the storage path (added a strict `^[a-zA-Z0-9_-]{1,128}$` check, closing a potential path-traversal write).
- **MEDIUM — `ai_label` missing from rate-limit and daily-budget maps**, silently falling to generic defaults (undercounting its real ~12¢ cost by ~6x in the budget breaker's running total). Added proper entries to both.
- **MEDIUM — missing Sentry captures**, violating the documented "every catch must Sentry-capture" rule, fixed in 7 files: `admin-user-detail.ts` (also had zero rate limiting — added), `workspace.ts`, `stripe-checkout.ts`, `lifetime-slots.ts`, `ig-scrub.ts` (had no try/catch around the handler body at all), `genius-chat.ts`, `admin-stats.ts`. Also stopped echoing raw Supabase/error messages to the client in `workspace.ts`/`stripe-checkout.ts` (minor info-disclosure cleanup alongside the observability fix).
- **MEDIUM — `tts.ts` was completely ungated** (no rate limit, no length cap) and **`DISABLE_CREDIT_LIMIT=1` worked in any environment including production** if ever set/misconfigured there. Added a rate limit + 2000-char cap to `tts.ts`; `DISABLE_CREDIT_LIMIT` now ignored whenever `VERCEL_ENV`/`NODE_ENV` is `"production"`.
- **Credit-cost documentation was simply wrong** — see the §D correction above.

**Left open (lower severity / requires a product decision, not a mechanical fix):**
- `invoice.paid` Stripe credit grant skips its per-payment idempotency dedupe (has an outer table-level guard as backstop — not currently exploitable).
- `lifetime-slots.ts` has no server-side hard cap enforcement (a display number only; not exploitable since Stripe still requires real payment).
- Low-severity prompt-injection surface in `aiChat.ts`/`aiCaption.ts`/`aiSuggest.ts` (user text gets elevated trust in the system prompt) — no cross-user data reachable, limited impact.
- The narrow DNS-rebinding race in the SSRF fix (checks DNS at fetch time, not the exact connecting socket) — a much smaller window than before, not a complete close.

**What was already solid** (worth knowing, not just the bad news): `userId` is JWT-derived everywhere, in every file across all 5 audits — never once trusted from a request body. Stripe webhook signature verification and idempotency are both correct and race-safe. Checkout price/quantity is always server-side. Admin owner-gating checks a real server-side env var from the verified JWT, no client-supplied bypass found anywhere. AI-endpoint gating order (auth → rate limit → budget → credit deduction) is correct and checks the budget before the expensive API call in all 4 endpoints.

### §D — IAP server verification  ⚪
Native StoreKit is client-only. Build web `POST /api/iap-verify`: verify Apple receipt server-side → grant credits via the existing `addCredits()` path. Add App Store Server Notifications V2 webhook (parallel to `stripe-webhook`). Record IAP revenue into a table and merge into `admin-stats.ts:fetchRevenue()` so IAP money shows in the dashboard. StoreKit products mirror the 6 Stripe prices. Credit costs (keep client+server in sync) — **corrected 2026-07-01, backend audit**: this previously said `ai_caption=1, ai_suggest=15, ai_chat=2`, which never matched the code. Actual values in `server/creditGate.ts` (and mirrored in `rateLimit.ts`/`dailyBudget.ts`, cost-justified against real Anthropic pricing in code comments): `ai_caption=3`, `ai_suggest=25`, `ai_chat=1`, `ai_label=12` (this last one wasn't documented here at all before).

### §F — AI profile sync never fired post-bootstrap  ✅ (fixed 2026-07-01, `3f64afe`)
Was: `AIProfileSync.scheduleSave(userId:jwt:context:)` (`AIProfileSync.swift:99`) was correctly implemented — 2s debounce, reads live `UserDefaults` at execution time, matches web semantics — but nothing called it. `FileCabinetMenuView`'s `styleProfileEditor` and the AI-rules editor mutated local `@AppStorage` on every edit but never triggered a cloud push; the only path that wrote to Supabase was `syncOnSignIn`'s one-time bootstrap.
Fix applied: added a private `scheduleCloudSync()` (reads `AuthManager.shared.userId/jwt`, no-ops when signed out) called from `onChange(of: styleProfile)` and `writeRules()` in `FileCabinetMenuView.swift`, and from the favorite/ban/delete actions in `CaptionPoolView.swift` (same `AIProfileSync` caption_pool sync path). Also fixed caption delete: was a hard `modelContext.delete(cap)`, which would just reappear on next sign-in sync pulling the still-live cloud copy — now sets `cap.deleted = true` (tombstone), with the `@Query` predicate updated to filter `deleted == false` so it still disappears from the UI. Clean `iphonesimulator` build confirmed.

### §E — Dashboard analytics  ✅ (done 2026-06-22)
`Analytics.swift` inserts rows directly into Supabase `activity_log` (RLS `users_insert_own_activity` permits `auth.uid() = user_id`; no backend endpoint needed). Events + metadata the dashboard reads:
- `session_start` — once per launch/sign-in (DAU). Fired from `DumpsterApp` launch + `AuthManager.handleCallback`.
- `photo_uploaded` `{count}` — `PhotoPoolView.importPickedPhotos`.
- `dump_exported` `{photo_count}` — `DumpCardView.shareDump`.

All native events also carry `metadata.platform = "ios"`. Owner account (`leescott2019@gmail.com` = `77517979-e0c7-4427-8afd-cc006e906df5`) is excluded to match web's `IS_OWNER` rule. **Open:** runtime confirmation (needs an interactive magic-link sign-in, then verify rows in `activity_log`).

---

## Shared rules (apply to native too)

**Security**
- `userId` ALWAYS from the Supabase JWT, never a request body.
- Password auth prohibited — magic link / OAuth / passwordless only.
- EXIF (esp. GPS) never logged or sent to Sentry.
- Server-side Sentry capture in all handler catch blocks.

**Server-side guardrails (already cover native via shared backend)**
- Sliding-window rate limit (Upstash Redis) per user per action.
- `$10/day` daily-budget circuit breaker — all AI endpoints 503 when tripped.

**Observability**
- Sentry DSN (web + native + server): `cac00263ad517cfa1ab22990dff35fc2@o4511424233013248.ingest.us.sentry.io/4511424250576896` · org `dumpster`.

**Items native can still leapfrog (web lacks these)**
- 🔔 Push notifications (APNs) — weekly "unfinished dumps" nudge, post-purchase confirmations.
- 🔋 Battery / network awareness — defer sync on cellular / low battery.

---

_Maintenance: when a feature ships on either platform, update its matrix row + any §spec. Last full audit: 2026-07-01 (later same day) — fixed all 3 §G UI bugs (native commit `da48fa6`, each re-verified live post-fix); ran a full backend security audit (§H) across `api/`+`server/` and fixed the CRITICAL GENIUSS-SQL and SSRF findings, the HIGH upload-validation findings, and most MEDIUM findings (rate-limit/budget gaps, missing Sentry captures, ungated tts.ts, prod-unsafe credit-limit escape hatch, wrong credit-cost docs). Remaining open items: §A lightbox UI, §C Auto-Gen filters, §D IAP server verification, dump-carousel duplicate badge, the 5-view UI re-theme noted in §G, and the handful of lower-severity backend items noted in §H. Earlier same day: merged `feat/native-dashboard-analytics` into native `main`; fixed §F (AI-profile sync dead code path, `3f64afe`); shipped §B (EXIF capture) and duplicate-photo detection (pool-view only). Prior: 2026-06-22 (cloud layer integrated into iOS build, dashboard analytics wired, Instagram hand-off fixed)._
