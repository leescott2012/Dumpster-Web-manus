-- Workspace + photo cloud sync (owner beta)
-- Run in Supabase SQL editor (or `supabase db push`).
-- Safe to run once. See docs/SETUP_PHOTO_SYNC.md for the full guide.

-- 1) Workspace layout: one row per user, dumps/pool as JSON (cloud urls only).
create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  dumps      jsonb not null default '[]'::jsonb,
  pool       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- Each user can read/write ONLY their own row.
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own" on public.workspaces
  for select using (auth.uid() = user_id);

drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own" on public.workspaces
  for insert with check (auth.uid() = user_id);

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own" on public.workspaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Storage bucket for image bytes. Public-read (consistent with the owner's
--    existing public CloudFront photos); writes are restricted by policy below.
insert into storage.buckets (id, name, public)
values ('user-photos', 'user-photos', true)
on conflict (id) do nothing;

-- Authenticated users may write/update/delete ONLY inside their own
-- `{auth.uid()}/...` folder. Path's first segment must equal their user id.
drop policy if exists "user_photos_insert_own" on storage.objects;
create policy "user_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "user_photos_update_own" on storage.objects;
create policy "user_photos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "user_photos_delete_own" on storage.objects;
create policy "user_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public read for the bucket (the bucket is public, but make the policy explicit).
drop policy if exists "user_photos_public_read" on storage.objects;
create policy "user_photos_public_read" on storage.objects
  for select using (bucket_id = 'user-photos');
