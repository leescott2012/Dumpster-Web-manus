# Dumpster — Web → Native Parity Tracker

Canonical checklist mapping **every web feature** to its native (SwiftUI / iOS) status. This is the source of truth that drives the iOS porting work — keep it current whenever a feature ships on either side.

**Native app:** `~/Documents/AI/Dumpster/dumpster/ios/DumpsterIOS` (the `dumpster` monorepo). Other Xcode projects on disk (`~/Desktop/DumpsterIOS`, `~/Desktop/photos/DumpsterApp`, `dumpster/ios-v2`) are dead/duplicate stubs; ignore them. The Xcode project uses **explicit file registration** (no synchronized groups), so new `.swift` files must be added to `project.pbxproj` or they won't compile in.

**⚠️ Native `main` is 3 commits behind its own work.** All native work below lives on branch `feat/native-dashboard-analytics`, unmerged into `main`: `3c30440` (Supabase cloud layer + dashboard analytics), `73cfa31` (Instagram URL-scheme fix), `158bc07` (preserve original photo bytes/EXIF on import). Anything shipped from native `main` today does **not** have dashboard analytics, the IG fix, or the EXIF-preserving import — merge the branch before treating those as live.

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
| **Duplicate-photo detection** | ⚪ | no equivalent to web's `photoDupes.ts` — no dup-flag file/logic found on native at all (grepped `ios/DumpsterIOS` for "dup"/"duplicate") |
| Local persistence | ✅ | SwiftData + Documents (vs web localStorage) |
| "Find in Photos" | 🟢 | native has on-device Vision instead (see below) |

### Photo import & processing
| Web feature | Native | Notes |
|---|---|---|
| Photo import | ✅ | `PhotosPicker` → `importPickedPhotos` |
| **EXIF / PhotoMeta capture** (§B) | 🟡 | `DumpPhoto` *declares* all 14 fields + `metaLine()`, but **nothing populates them** — import creates bare records; no `ImageIO`/`PHAsset` extraction |
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
| **AI memory — taste profile + AI rules sync** (§F) | 🛑🐛 | editor writes to local `@AppStorage` only; `AIProfileSync.scheduleSave()` is fully implemented but **never called from any UI** — edits never reach Supabase after the initial sign-in bootstrap. Worse than the web race this was compared against (web loses ~1.2s of edits; native loses everything post-bootstrap, silently) |
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
| Appearance options (dark/light, card size) | ⚪ | web shows "coming soon"; native **(verify)** |
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
Apple-Photos-style metadata card, revealed by **swipe-up** on native (vs web's (i) button). Sections (all conditional on data): day·date·time · filename · camera + format badge · lens/focal/f-stop · resolution + file size · exposure row (ISO, mm, ƒ, shutter) · **map at GPS coords**. Web uses Google Static Maps; **native should use MapKit** (free, no token). Blocked on §B (needs real EXIF first).

### §B — EXIF / PhotoMeta capture  🟡
`DumpPhoto` already has the fields + `metaLine()`; what's missing is **extraction**. In `importPickedPhotos`, before any downscale, read EXIF via `PHAsset` / `ImageIO` (`CGImageSourceCopyPropertiesAtIndex`) and populate `takenAt, lat, lng, camera, lens, iso, focalLength, fStop, shutterSpeed, imageFormat, orientation, pixelWidth/Height, fileSize`. **Order matters: extract before downsample** (downsampling strips EXIF). Feeds AI prompts (`metaLine`) and §A.

### §C — Auto-Gen advanced filters  🟡
Port `applyAutoGenFilters()` from web `AutoGenAdvanced.tsx`: date range (`DatePicker`), time-of-day window (hard — no-metadata photos excluded), category chips (multi-select, OR logic), mix mode (surprise = bypass filters; shuffle = randomize order), vibe note (freeform → AI `userHint`). **Hard rule:** photos already used in any dump are *always* excluded.

### §D — IAP server verification  ⚪
Native StoreKit is client-only. Build web `POST /api/iap-verify`: verify Apple receipt server-side → grant credits via the existing `addCredits()` path. Add App Store Server Notifications V2 webhook (parallel to `stripe-webhook`). Record IAP revenue into a table and merge into `admin-stats.ts:fetchRevenue()` so IAP money shows in the dashboard. StoreKit products mirror the 6 Stripe prices. Credit costs (keep client+server in sync): `ai_caption=1`, `ai_suggest=15`, `ai_chat=2`.

### §F — AI profile sync never fires post-bootstrap  🛑🐛 (found 2026-07-01)
`AIProfileSync.scheduleSave(userId:jwt:context:)` (`AIProfileSync.swift:99`) is correctly implemented — 2s debounce, reads live `UserDefaults` at execution time, matches web semantics. But nothing calls it: `grep -rn "scheduleSave" ios/DumpsterIOS` returns only its own definition. `FileCabinetMenuView`'s `styleProfileEditor` (`@AppStorage("ai_style_profile")`) and the AI-rules editor (`@AppStorage("ai_rules")`) mutate local storage on every keystroke/edit but never trigger a cloud push. The only path that writes to Supabase is `syncOnSignIn`'s one-time bootstrap (new user or app launch). **Fix:** call `AIProfileSync.shared.scheduleSave(userId:jwt:)` from `onChange(of: styleProfile)` and wherever `writeRules()`/rule mutations happen in `FileCabinetMenuView.swift`, guarded on having a signed-in session. Compare to web's `163f5ac` fix (flush-via-refs on unmount) — native doesn't need that specific fix (its debounce reads live values), it just needs to be *wired up* at all.

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

_Maintenance: when a feature ships on either platform, update its matrix row + any §spec. Last full audit: 2026-07-01 — verified web/native are on the same commit for scan-taxonomy alignment (§ AI features); confirmed native `main` still lacks the 3 commits sitting on `feat/native-dashboard-analytics`; found §F (AI-profile sync dead code path) and the missing duplicate-detection feature by reading native source directly, not just grepping symbol presence. Prior: 2026-06-22 (cloud layer integrated into iOS build, dashboard analytics wired, Instagram hand-off fixed)._
