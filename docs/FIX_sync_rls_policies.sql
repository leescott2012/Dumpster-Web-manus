-- FIX: let logged-in users READ their own photos/dumps so cross-device sync works.
-- Verified 2026-06-07: as the authenticated owner, photos/dumps/dump_photos all
-- return 0 rows because RLS is enabled with no SELECT policy. This adds them.
-- Paste into Supabase → SQL Editor → Run. Read-only access; safe.

-- Photos: a user can read their own photo rows.
alter table public.photos enable row level security;
drop policy if exists photos_select_own on public.photos;
create policy photos_select_own on public.photos
  for select using (auth.uid() = user_id);

-- Dumps: a user can read their own dumps.
alter table public.dumps enable row level security;
drop policy if exists dumps_select_own on public.dumps;
create policy dumps_select_own on public.dumps
  for select using (auth.uid() = user_id);

-- Dump↔photo links: readable when the parent dump belongs to the user
-- (dump_photos has no user_id of its own, so scope through the dump).
alter table public.dump_photos enable row level security;
drop policy if exists dump_photos_select_own on public.dump_photos;
create policy dump_photos_select_own on public.dump_photos
  for select using (
    exists (
      select 1 from public.dumps d
      where d.id = dump_photos.dump_id and d.user_id = auth.uid()
    )
  );
