# Owner Cross-Device Photo Sync (beta)

**Goal:** Your (owner) photos + dumps appear on every device, including your phone.

## Key discovery
The sync backend **already exists and is seeded**. In Supabase you have:
- `photos` table — your 30 photos (CloudFront urls), columns `id, user_id, url, category, order`.
- `dumps` table — your 3 dumps (`title, subtitle, description`).
- `dump_photos` junction — 15 ordered links (which photos sit in which dump).
- `workspace-uploads` Storage bucket (public, image/video, 20 MB limit).

The app was just never wired to **read** from these tables — it stayed device-local. That's what this change fixes.

## What I changed (branch `feat/owner-photo-sync`)
- `client/src/lib/workspaceSync.ts` — **read path** against the existing schema. On owner sign-in it loads dumps + photos + junction, assembles the workspace (pool = photos not in any dump), and hydrates the app via `replaceState()`. Fully fail-safe: RLS block / empty / error → returns null → app keeps device-local state.
- `client/src/pages/Home.tsx` — loads the workspace once per owner sign-in.

## Scope: Phase 1 = read-only (safe)
- **Loads** your already-seeded dumps/photos on any device → they show on your phone. ✅
- **Does NOT yet write** local edits back (new uploads, reorders) to the DB — that's Phase 2. So a *brand-new* photo added on the computer won't appear on the phone until Phase 2; everything already in the tables will.
- Read-only cannot corrupt the seeded data.

## To make it live
1. **Merge + deploy:**
   ```
   git checkout ship/email-update
   git merge feat/owner-photo-sync
   git push
   ```
2. **Confirm RLS allows authenticated reads** (the one thing unverifiable without your login): each of `photos`, `dumps`, `dump_photos` needs a SELECT policy like `auth.uid() = user_id` (for `dump_photos`, allow when the parent dump belongs to the user). If reads come back empty when you're logged in, add those policies in Supabase → Authentication → Policies.
3. **Test:** on your phone, open `https://dumpster-web-manus.vercel.app/?owner=1`, sign in as `leescott2019@gmail.com` → your 3 dumps + 30 photos should load.

## Phase 2 (deferred) — write-back
To sync *new* edits across devices: on local change, upsert into `photos`/`dumps`/`dump_photos` and upload new photo bytes to the `workspace-uploads` bucket (needs a signed-upload-url or storage write policy). Stubs (`scheduleWorkspaceSave` / `flushWorkspaceSave`) are in place as no-ops so wiring is ready.

## Note
The earlier `workspaces` JSON-blob table + `user-photos` bucket idea was scrapped — it duplicated this existing normalized schema. No new tables/buckets are needed.
