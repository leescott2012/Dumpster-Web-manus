-- Referral rewards. NOT applied — Lee reviews first.
-- profiles.referral_code and profiles.referred_by already exist (verified live 2026-10-21).
-- This only adds the claim table (one reward per invited account, enforced by unique(invitee_id)).
create table if not exists public.referral_rewards (
  id         uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null unique references public.profiles(id) on delete cascade,
  amount     integer not null default 10,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id)
);
create index if not exists idx_referral_rewards_inviter on public.referral_rewards(inviter_id);
alter table public.referral_rewards enable row level security;
-- No policies on purpose: only the server (service role) reads/writes it.
