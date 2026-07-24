-- ============================================================
-- Mailbox, Connections, DM, Usernames, Phone Login
-- Run this in the Supabase SQL Editor (supabase.com/dashboard → SQL)
-- Spec: Geniuss Brain vault, Dumpster/01 In Progress/
--       "(C) Mailbox, Bug-Bin Reply, Usernames & Phone Login - Spec.md"
-- ============================================================

-- 1. profiles: username + phone + icon avatar
alter table public.profiles
  add column if not exists username text,
  add column if not exists phone text,
  add column if not exists avatar_icon text,      -- lucide-react icon name, e.g. 'camera'
  add column if not exists avatar_color text;      -- hex or token, e.g. '#f5c518'

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create unique index if not exists profiles_phone_idx on public.profiles (phone) where phone is not null;
-- NOT NULL on username intentionally deferred until existing rows are backfilled via the
-- app's blocking "choose a username" gate modal — adding it now would break every existing row.

-- 2. bug_reports: single admin reply field (not a thread — see spec for why)
alter table public.bug_reports
  add column if not exists admin_reply text,
  add column if not exists admin_replied_at timestamptz;

-- 3. notifications
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  type        text not null,              -- 'bug_reply' | 'system' | 'admin_broadcast' | 'connection_request' | 'connection_accepted' | 'dm'
  title       text not null,
  body        text,
  link        text,                       -- optional deep link (e.g. back to the bug report / conversation)
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx on public.notifications(user_id) where read_at is null;
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users_select_own_notifications" on public.notifications;
create policy "users_select_own_notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "users_update_own_notifications" on public.notifications;
create policy "users_update_own_notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- No insert policy for authenticated users — only the service role (server handlers) creates
-- notifications, so a user can never forge a notification claiming to be from someone else.

-- 4. connections: request/accept graph
create table if not exists public.connections (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete cascade not null,
  addressee_id uuid references auth.users(id) on delete cascade not null,
  status       text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  constraint connections_no_self_request check (requester_id <> addressee_id)
);
create index if not exists connections_addressee_idx on public.connections(addressee_id, status);
create index if not exists connections_requester_idx on public.connections(requester_id, status);

alter table public.connections enable row level security;

drop policy if exists "users_select_own_connections" on public.connections;
create policy "users_select_own_connections"
  on public.connections for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "users_insert_connection_request" on public.connections;
create policy "users_insert_connection_request"
  on public.connections for insert
  with check (auth.uid() = requester_id);

drop policy if exists "addressee_updates_connection_status" on public.connections;
create policy "addressee_updates_connection_status"
  on public.connections for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);
-- Only the addressee can accept/decline. The requester cannot self-approve.

-- 5. dm_messages: text-only, connection-gated
create table if not exists public.dm_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid references auth.users(id) on delete cascade not null,
  recipient_id  uuid references auth.users(id) on delete cascade not null,
  body          text not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint dm_messages_no_self_send check (sender_id <> recipient_id)
);
create index if not exists dm_messages_thread_idx
  on public.dm_messages(least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);

alter table public.dm_messages enable row level security;

drop policy if exists "users_select_own_dms" on public.dm_messages;
create policy "users_select_own_dms"
  on public.dm_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

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
  );
-- RLS re-checks the connection at insert time — a declined/revoked connection blocks new
-- messages immediately, it doesn't just hide old ones. The API handler re-verifies this same
-- condition before insert too (belt-and-suspenders per the spec's open-risks note), since RLS
-- alone gives a generic constraint-violation error, not a clean "you're not connected" response.

drop policy if exists "users_mark_own_received_dms_read" on public.dm_messages;
create policy "users_mark_own_received_dms_read"
  on public.dm_messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
