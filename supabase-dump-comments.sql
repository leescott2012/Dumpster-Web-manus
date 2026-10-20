-- Comments on a (public) dump, left by the owner's connections. Applied 2026-10-20.
create table if not exists public.dump_comments (
  id uuid primary key default gen_random_uuid(),
  dump_id uuid not null references public.dumps(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists dump_comments_dump_idx on public.dump_comments(dump_id, created_at);
-- All access goes through /api/dump-comments (service role) which checks owner/connection; no direct client access.
alter table public.dump_comments enable row level security;
