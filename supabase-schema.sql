-- ============================================================
-- Dumpster — Supabase Database Schema
-- Run this in the Supabase SQL Editor (supabase.com/dashboard → SQL)
-- ============================================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'pro')),
  subscription_status text default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  credits integer default 15,
  daily_credits_remaining integer default 15,
  daily_credits_reset_at timestamptz default now(),
  lifetime_purchase boolean default false,
  referral_code text unique,
  referred_by uuid references public.profiles(id),
  api_key_openai text,
  api_key_anthropic text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Credit transaction log
create table if not exists public.credit_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  type text not null,
  description text,
  stripe_payment_id text,
  created_at timestamptz default now()
);

-- 3. Stripe events (idempotency)
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  data jsonb,
  processed_at timestamptz default now()
);

-- 4. Row Level Security
alter table public.profiles enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.stripe_events enable row level security;

-- Users can read/update their own profile
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Users can read their own transactions
create policy "Users read own transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- Stripe events: service role only (no user access)
create policy "No user access to stripe events" on public.stripe_events
  for all using (false);

-- 5. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, credits, daily_credits_remaining, referral_code)
  values (
    new.id,
    new.email,
    15,
    15,
    substr(md5(random()::text), 1, 8)
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Index for fast lookups
create index if not exists idx_credit_transactions_user on public.credit_transactions(user_id);
create index if not exists idx_profiles_stripe_customer on public.profiles(stripe_customer_id);
create index if not exists idx_profiles_stripe_sub on public.profiles(stripe_subscription_id);
create index if not exists idx_profiles_referral on public.profiles(referral_code);
