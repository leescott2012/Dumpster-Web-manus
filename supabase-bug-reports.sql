-- ── Bug inventory ───────────────────────────────────────────────────────────
-- Persistent log of every error/bug surfaced in the app. Users can hit "Send
-- to bug log" on the error toast, and the admin sees them all in /admin.
--
-- Also receives auto-captured unhandled JS errors so we don't rely on users
-- noticing + clicking.

create table if not exists public.bug_reports (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete set null,
  email       text,                       -- snapshot at report time (user_id may go null on account delete)

  source      text        not null,       -- e.g. "auto-gen", "orb-stt", "stripe-checkout", "unhandled"
  message     text        not null,       -- short human-readable summary
  error_code  text,                       -- code string if known (e.g. "no-speech", "rate_limit_exceeded", HTTP code)
  stack       text,                       -- JS stack if available

  url         text,                       -- window.location.href
  user_agent  text,
  viewport    text,                       -- "WxH"
  context     jsonb,                      -- free-form extra (request body fragment, state, etc.)

  status      text        not null default 'new',  -- new / seen / fixed / wontfix
  admin_note  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists bug_reports_created_at_idx on public.bug_reports(created_at desc);
create index if not exists bug_reports_status_idx     on public.bug_reports(status);
create index if not exists bug_reports_user_id_idx    on public.bug_reports(user_id);
create index if not exists bug_reports_source_idx     on public.bug_reports(source);

alter table public.bug_reports enable row level security;

-- Authenticated users can insert their own report (anyone signed in can log a bug).
drop policy if exists "users_insert_own_bug" on public.bug_reports;
create policy "users_insert_own_bug"
  on public.bug_reports
  for insert
  with check (auth.uid() = user_id OR user_id IS NULL);

-- Anonymous reports are allowed (for crashes before sign-in). user_id stays null.
drop policy if exists "anon_insert_bug" on public.bug_reports;
create policy "anon_insert_bug"
  on public.bug_reports
  for insert
  to anon
  with check (user_id IS NULL);

-- Reads bypass RLS via service_role (admin API).
