-- ============================================================================
-- AI personalization sync — survives device-switching and cache-clearing.
--
-- Stores the user's accumulated AI memory:
--   - taste_profile:  free-text aesthetic description (user-written + auto-
--                     appended observations from DumpChat's taste_update actions)
--   - ai_rules:       strict do's/don'ts the user has set
--   - caption_pool:   full caption library with favorited/banned flags;
--                     the top 8 favorited + top 8 banned feed every AI call
--
-- Photos and dumps stay LOCAL by design. Only the user-level AI knowledge
-- crosses devices. Total payload even for a power user: < 200 KB.
--
-- Run this once in the Supabase SQL editor for the production project.
-- ============================================================================

create table if not exists public.user_ai_profile (
  user_id          uuid references auth.users not null primary key,
  taste_profile    text not null default '',
  ai_rules         text not null default '',
  caption_pool     jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),

  constraint caption_pool_is_array check (jsonb_typeof(caption_pool) = 'array')
);

alter table public.user_ai_profile enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_ai_profile'
      and policyname = 'Users can view own AI profile'
  ) then
    create policy "Users can view own AI profile" on public.user_ai_profile
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_ai_profile'
      and policyname = 'Users can insert own AI profile'
  ) then
    create policy "Users can insert own AI profile" on public.user_ai_profile
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_ai_profile'
      and policyname = 'Users can update own AI profile'
  ) then
    create policy "Users can update own AI profile" on public.user_ai_profile
      for update using (auth.uid() = user_id);
  end if;
end $$;
