-- ── Apple Server Notifications V2 dedupe ────────────────────────────────────
-- Run once in Supabase SQL editor.
-- Mirrors stripe_events: an atomic-insert idempotency guard so a retried
-- Apple notification delivery can't apply the same renewal/refund/revoke
-- twice. See server/handlers/apple-webhook.ts.

create table if not exists public.apple_notifications (
  id text primary key,
  type text not null,
  data jsonb,
  processed_at timestamptz default now()
);
alter table public.apple_notifications enable row level security; -- server-only (service role bypasses RLS)
