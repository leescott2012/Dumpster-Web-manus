-- ── Activity log ────────────────────────────────────────────────────────────
-- Run once in Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Stores lightweight behavioural events from the client so the admin
-- dashboard can show DAU, upload counts, and export counts alongside the
-- AI-usage data already in credit_transactions.

create table if not exists public.activity_log (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  event      text        not null,   -- 'session_start' | 'photo_uploaded' | 'dump_exported'
  metadata   jsonb,                  -- e.g. { count: 5 } for photo_uploaded
  created_at timestamptz not null default now()
);

-- Indexes for admin aggregation queries
create index if not exists activity_log_user_id_idx
  on public.activity_log(user_id);

create index if not exists activity_log_event_idx
  on public.activity_log(event);

create index if not exists activity_log_created_at_idx
  on public.activity_log(created_at desc);

-- RLS: users can insert their own rows; no client-side read
-- (admin reads via service_role in the API endpoint)
alter table public.activity_log enable row level security;

drop policy if exists "users_insert_own_activity" on public.activity_log;
create policy "users_insert_own_activity"
  on public.activity_log
  for insert
  with check (auth.uid() = user_id);
