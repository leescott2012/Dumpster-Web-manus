-- Per-account limit on sign-in / verification codes (3 per hour, 30s apart).
-- Counted per hashed phone/email on the server, so clearing a browser or using another device doesn't reset it.
create table if not exists public.otp_sends (
  id bigint generated always as identity primary key,
  identifier_hash text not null,
  sent_at timestamptz not null default now()
);
create index if not exists otp_sends_lookup on public.otp_sends (identifier_hash, sent_at desc);
alter table public.otp_sends enable row level security;  -- no policies: only the service role (our API) can read/write

-- Returns 0 and records the send if allowed; otherwise the number of seconds to wait.
create or replace function public.otp_try_send(p_hash text, p_max int, p_window_secs int, p_cooldown_secs int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  oldest timestamptz;
  newest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_hash));  -- two simultaneous requests can't both slip through
  select count(*), min(sent_at), max(sent_at) into n, oldest, newest
    from otp_sends
   where identifier_hash = p_hash and sent_at > now() - make_interval(secs => p_window_secs);
  if n >= p_max then
    return greatest(1, ceil(extract(epoch from (oldest + make_interval(secs => p_window_secs) - now())))::int);
  end if;
  if newest is not null and newest > now() - make_interval(secs => p_cooldown_secs) then
    return greatest(1, ceil(extract(epoch from (newest + make_interval(secs => p_cooldown_secs) - now())))::int);
  end if;
  insert into otp_sends (identifier_hash) values (p_hash);
  delete from otp_sends where sent_at < now() - interval '1 day';
  return 0;
end;
$$;
revoke all on function public.otp_try_send(text, int, int, int) from public, anon, authenticated;
grant execute on function public.otp_try_send(text, int, int, int) to service_role;
