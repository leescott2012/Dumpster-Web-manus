-- NOT APPLIED. Lee must approve. New users start with 30 purchased + 15 daily = 45
-- credits (was 15 + 15 = 30): 3 Auto Gen dumps at 8 = 24, leaving 21 for Valet/captions.
-- Existing users are untouched.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, credits, daily_credits_remaining, referral_code)
  values (new.id, new.email, 30, 15, substr(md5(random()::text), 1, 8));
  return new;
end;
$$ language plpgsql security definer;
alter table public.profiles alter column credits set default 30;
