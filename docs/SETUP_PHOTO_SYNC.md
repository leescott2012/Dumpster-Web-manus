# Setup: Owner Cross-Device Photo Sync (beta)

**Goal:** Make the **owner account's** photos appear on every device (e.g. your phone), not just the computer they were uploaded on.

**Scope:** Owner only (`IS_OWNER` builds). Regular users stay device-local, so the "photos never leave your device" promise in Privacy/Terms is unchanged for them — no legal edit needed.

**Status:** Client code is built and merged on branch `feat/owner-photo-sync`. It is **dormant until you run the backend setup below** — every cloud call fails safe and falls back to device-local, so nothing breaks in the meantime.

---

## ⚡ Immediate workaround (no setup)
Your *seeded* photos are already on CloudFront. To see them on your phone right now, open the app on the phone once with the owner flag:

```
https://dumpster-web-manus.vercel.app/?owner=1
```

That sets the owner flag on that device. Only *newly uploaded* photos (stored as base64 on the computer) won't follow — that's exactly what the sync below fixes.

---

## Step 1 — Run the database + storage migration
In the Supabase dashboard → **SQL Editor**, paste and run the contents of:

```
supabase/migrations/0001_workspace_photo_sync.sql
```

This creates:
- `public.workspaces` table (one row per user, RLS-scoped to the owner) — holds the dumps/pool layout as JSON.
- `user-photos` Storage bucket (public-read; writes restricted to each user's own `{userId}/…` folder).

> If you use the Supabase CLI instead: `supabase db push` (the file is already under `supabase/migrations/`).

## Step 2 — Verify the bucket exists
Supabase → **Storage** → confirm a bucket named **`user-photos`** is listed and marked **Public**.

## Step 3 — Deploy the client code
The sync logic lives on branch `feat/owner-photo-sync`. Merge it into your deploy branch and let Vercel deploy:

```
git checkout ship/email-update   # or your prod branch
git merge feat/owner-photo-sync
git push
```

(No new env vars are required — it reuses the existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.)

## Step 4 — Test end-to-end
1. On your **computer**, open the app as owner (`?owner=1`), upload a new photo. Wait ~5s (debounced save).
2. Confirm bytes landed: Supabase → Storage → `user-photos` → `{yourUserId}/` should contain a `.jpg`.
3. Confirm layout saved: Supabase → Table editor → `workspaces` → your row's `pool`/`dumps` JSON references the new photo with a `…/user-photos/…` url (NOT a `data:` blob).
4. On your **phone**, open the app as owner (`?owner=1`) and sign into the **same account** → the uploaded photo should appear.

---

## How it works (for reference)
- `client/src/lib/workspaceSync.ts` — owner-gated. On upload it pushes image bytes to Storage at `{userId}/{photoId}.jpg` and stores only the resulting cloud url in the `workspaces` JSON. On sign-in another device pulls the row and rehydrates via the existing `replaceState()`.
- Saves are **debounced 4s** and flushed on tab close.
- **Fail-safe:** if the table/bucket are missing or any call errors, sync silently no-ops and the app behaves exactly as before (device-local).

## Known limitations (beta)
- **Last-write-wins:** editing on two devices at once, the most recent save overwrites. No merge/conflict UI yet.
- **Public bucket:** photo urls are public (unguessable path, but not access-controlled) — same posture as the existing CloudFront photos. Switch to signed urls if you later sync non-owner users.
- **Owner only:** extending to all users requires the privacy/terms update and an opt-in toggle (deferred by design).
- A photo that fails to upload stays device-local and is retried on the next save; it is never written to the DB as base64.

## Checklist
- [ ] Ran `0001_workspace_photo_sync.sql` in Supabase
- [ ] `user-photos` bucket exists and is Public
- [ ] Merged `feat/owner-photo-sync` → prod branch → deployed
- [ ] Uploaded a photo on computer; bytes + JSON row appeared in Supabase
- [ ] Same photo visible on phone (same account, `?owner=1`)
