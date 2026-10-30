-- NOT APPLIED. Lee must approve. Applies the 2026-10-30 pricing decision:
-- no daily free credits. New accounts get 30 starter credits once (unchanged);
-- Pro gets a monthly pool (shared/pricing.ts), not a daily refill. A credit costs
-- us ~1¢, so 15/day free and 200/day Pro could cost more than they earn.
-- Existing users keep whatever daily credits they hold today; it just stops refilling.
-- refund_credits is deliberately unchanged: its clamp only limits refunds, never grants.

create or replace function public.deduct_credits(p_user_id uuid, p_cost integer)
returns table(ok boolean, from_daily integer, from_purchased integer, remaining integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_credits integer;
  v_daily   integer;
  v_reset   timestamptz;
  v_from_daily integer;
  v_from_purchased integer;
begin
  if p_cost is null or p_cost <= 0 then
    raise exception 'deduct_credits: cost must be > 0';
  end if;

  select coalesce(p.credits, 0), coalesce(p.daily_credits_remaining, 0), p.daily_credits_reset_at
    into v_credits, v_daily, v_reset
    from public.profiles p
   where p.id = p_user_id
   for update;

  if not found then
    return query select false, 0, 0, 0;
    return;
  end if;

  if v_reset is null or now() - v_reset > interval '24 hours' then
    v_daily := 0;            -- was: 200 for pro, 15 for everyone else
    v_reset := now();
  end if;

  if v_credits + v_daily < p_cost then
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
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$begin
  insert into public.profiles (id, email, credits, daily_credits_remaining, referral_code)
  values (new.id, new.email, 30, 0, substr(md5(random()::text), 1, 8));   -- daily was 15
  return new;
end;$function$;

alter table public.profiles alter column daily_credits_remaining set default 0;
