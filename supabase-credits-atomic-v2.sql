-- ── Atomic credit deduct + bucket-exact refund (v2) ─────────────────────────
-- Run once in the Supabase SQL editor. Safe to re-run (create or replace).
-- Builds on supabase-atomic-credits.sql (increment_credits, unchanged).
--
-- deduct_credits: locks the profile row, applies the rolling-24h daily reset
-- (pro 200 / free 15 — same rule as server/supabaseAdmin.ts), then deducts
-- daily first, then purchased, in ONE transaction. Two parallel AI calls can
-- no longer both spend the same balance. Returns which bucket(s) were charged
-- so a refund can put credits back exactly where they came from.
--
-- refund_credits: gives back daily and purchased amounts separately. Daily is
-- capped at the tier's daily amount, so a refund that lands after a daily
-- reset can't push the daily bucket above its normal maximum.
--
-- Until this is applied the server falls back to a compare-and-swap update
-- through supabase-js (see server/supabaseAdmin.ts), so code can ship first.

create or replace function public.deduct_credits(
  p_user_id uuid,
  p_cost    integer
)
returns table(ok boolean, from_daily integer, from_purchased integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_daily   integer;
  v_reset   timestamptz;
  v_tier    text;
  v_from_daily integer;
  v_from_purchased integer;
begin
  if p_cost is null or p_cost <= 0 then
    raise exception 'deduct_credits: cost must be > 0';
  end if;

  select coalesce(p.credits, 0), coalesce(p.daily_credits_remaining, 0),
         p.daily_credits_reset_at, p.subscription_tier
    into v_credits, v_daily, v_reset, v_tier
    from public.profiles p
   where p.id = p_user_id
   for update;                       -- row lock: parallel calls queue here

  if not found then
    return query select false, 0, 0, 0;
    return;
  end if;

  if v_reset is null or now() - v_reset > interval '24 hours' then
    v_daily := case when v_tier = 'pro' then 200 else 15 end;
    v_reset := now();
  end if;

  if v_credits + v_daily < p_cost then
    -- Persist a pending daily reset even when the user can't afford this call.
    update public.profiles
       set daily_credits_remaining = v_daily, daily_credits_reset_at = v_reset
     where id = p_user_id;
    return query select false, 0, 0, v_credits + v_daily;
    return;
  end if;

  v_from_daily     := least(p_cost, v_daily);
  v_from_purchased := p_cost - v_from_daily;

  update public.profiles
     set credits                 = v_credits - v_from_purchased,
         daily_credits_remaining = v_daily - v_from_daily,
         daily_credits_reset_at  = v_reset
   where id = p_user_id;

  return query select true, v_from_daily, v_from_purchased, v_credits + v_daily - p_cost;
end;
$$;

create or replace function public.refund_credits(
  p_user_id        uuid,
  p_from_daily     integer,
  p_from_purchased integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if coalesce(p_from_daily, 0) < 0 or coalesce(p_from_purchased, 0) < 0 then
    raise exception 'refund_credits: amounts must be >= 0';
  end if;

  update public.profiles
     set credits = coalesce(credits, 0) + coalesce(p_from_purchased, 0),
         daily_credits_remaining = least(
           coalesce(daily_credits_remaining, 0) + coalesce(p_from_daily, 0),
           case when subscription_tier = 'pro' then 200 else 15 end
         )
   where id = p_user_id
   returning coalesce(credits, 0) + coalesce(daily_credits_remaining, 0) into v_total;

  return v_total;  -- null if the user doesn't exist
end;
$$;

-- Service role only — clients must never be able to call these directly.
revoke all on function public.deduct_credits(uuid, integer) from public;
revoke all on function public.deduct_credits(uuid, integer) from anon;
revoke all on function public.deduct_credits(uuid, integer) from authenticated;
grant  execute on function public.deduct_credits(uuid, integer) to service_role;

revoke all on function public.refund_credits(uuid, integer, integer) from public;
revoke all on function public.refund_credits(uuid, integer, integer) from anon;
revoke all on function public.refund_credits(uuid, integer, integer) from authenticated;
grant  execute on function public.refund_credits(uuid, integer, integer) to service_role;
