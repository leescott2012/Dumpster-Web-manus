-- ── Apple subscription tracking ─────────────────────────────────────────────
-- Run once in Supabase SQL editor.
-- Mirrors stripe_subscription_id: lets server/handlers/iap-verify.ts record
-- which Apple subscription (if any) backs a "pro" tier grant, for future
-- lookup by an App Store Server Notifications V2 webhook (cancellations,
-- refunds, renewals) the same way stripe-webhook.ts looks up by
-- stripe_subscription_id today.

alter table public.profiles
  add column if not exists apple_original_transaction_id text;

create index if not exists idx_profiles_apple_original_tx
  on public.profiles(apple_original_transaction_id);
