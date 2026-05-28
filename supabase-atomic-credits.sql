-- ── Atomic credit increment ─────────────────────────────────────────────────
-- Run once in Supabase SQL editor.
-- Replaces the racy SELECT-then-UPDATE pattern in server/supabaseAdmin.ts
-- addCredits(). Now any two concurrent Stripe webhooks adding credits to the
-- same user will serialise at the database level — no double-credit.

create or replace function public.increment_credits(
  p_user_id uuid,
  p_amount  integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id
  returning credits into new_balance;

  return new_balance;
end;
$$;

-- Restrict to service_role only — clients can't grant themselves credits.
revoke all on function public.increment_credits(uuid, integer) from public;
revoke all on function public.increment_credits(uuid, integer) from anon;
revoke all on function public.increment_credits(uuid, integer) from authenticated;
grant  execute on function public.increment_credits(uuid, integer) to service_role;
