-- ── Exactly-once credit grants ───────────────────────────────────────────────
-- Applied 2026-10-28 (launch security audit). addCredits() used to
-- SELECT-for-dupe → increment → log as three separate calls, and the unique
-- index its comments relied on never existed in production. Two concurrent
-- deliveries of the same purchase could both grant, and a failed log after
-- the increment let a retry grant again.
--
-- grant_credits_once inserts the ledger row and bumps the balance in ONE
-- transaction; the unique index makes the insert the claim. Returns false
-- (no-op) when the payment key was already granted.

create unique index if not exists credit_transactions_stripe_payment_id_key
  on public.credit_transactions (stripe_payment_id)
  where stripe_payment_id is not null;

create or replace function public.grant_credits_once(
  p_user_id     uuid,
  p_amount      integer,
  p_type        text,
  p_description text,
  p_payment_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.credit_transactions (user_id, amount, type, description, stripe_payment_id)
  values (p_user_id, p_amount, p_type, p_description, p_payment_key)
  on conflict (stripe_payment_id) where stripe_payment_id is not null do nothing;
  if not found then
    return false;
  end if;

  update public.profiles set credits = credits + p_amount where id = p_user_id;
  if not found then
    raise exception 'grant_credits_once: no profile %', p_user_id;
  end if;
  return true;
end;
$$;

revoke all on function public.grant_credits_once(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.grant_credits_once(uuid, integer, text, text, text) to service_role;
