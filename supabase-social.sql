-- ============================================================
-- Social upgrade: messages, notifications v2, dm blocks.
-- Idempotent. Run in the Supabase SQL Editor. Safe to merge the code BEFORE
-- running this: the app falls back to the old columns / hides blocking until it exists.
-- Builds on supabase-mailbox-connections.sql (notifications, connections, dm_messages).
-- ============================================================

-- 1. notifications v2: actor, structured payload, idempotency key.
alter table public.notifications
  add column if not exists actor_id   uuid references auth.users(id) on delete set null,
  add column if not exists data       jsonb not null default '{}'::jsonb,
  add column if not exists dedupe_key text;

-- One row per (user, dedupe_key): daily reminders ('reminder_ig:2026-10-21'),
-- one-shot events ('referral:<invitee>') and rolling rows ('dm:<sender>').
create unique index if not exists notifications_user_dedupe_idx
  on public.notifications(user_id, dedupe_key) where dedupe_key is not null;

-- Users may only flip read_at on their own rows (the old policy allowed editing title/body/link).
revoke update on public.notifications from anon, authenticated;
grant  update (read_at) on public.notifications to authenticated;
-- Inserts stay server-only (service role): there is still NO insert policy.

-- 2. dm_messages: unread lookups + recipients can only mark read (never edit the text).
create index if not exists dm_messages_unread_idx
  on public.dm_messages(recipient_id, sender_id) where read_at is null;
revoke update on public.dm_messages from anon, authenticated;
grant  update (read_at) on public.dm_messages to authenticated;

-- 3. dm_blocks: blocker stops all messages in both directions.
create table if not exists public.dm_blocks (
  blocker_id uuid references auth.users(id) on delete cascade not null,
  blocked_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint dm_blocks_no_self check (blocker_id <> blocked_id)
);
alter table public.dm_blocks enable row level security;
drop policy if exists "users_select_own_blocks" on public.dm_blocks;
create policy "users_select_own_blocks" on public.dm_blocks for select using (auth.uid() = blocker_id);
-- Writes go through the server (service role) only.

-- 4. RLS on sending: accepted friends AND no block in either direction.
-- dm_blocked is security definer: dm_blocks RLS only lets the blocker see their own
-- rows, so an inline check would never see blocks placed AGAINST the sender.
create or replace function public.dm_blocked(a uuid, b uuid) returns boolean
  language sql security definer stable set search_path = public
as $$ select exists (select 1 from public.dm_blocks
  where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)) $$;
revoke all on function public.dm_blocked(uuid, uuid) from public;
grant execute on function public.dm_blocked(uuid, uuid) to authenticated;
drop policy if exists "users_insert_dm_if_connected" on public.dm_messages;
create policy "users_insert_dm_if_connected"
  on public.dm_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and ((c.requester_id = sender_id and c.addressee_id = recipient_id)
          or (c.requester_id = recipient_id and c.addressee_id = sender_id))
    )
    and not public.dm_blocked(sender_id, recipient_id)
  );
-- Length cap in the database too (the API caps at 2000).
alter table public.dm_messages drop constraint if exists dm_messages_body_len;
alter table public.dm_messages add constraint dm_messages_body_len check (char_length(body) between 1 and 4000);
