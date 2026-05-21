-- Create a table for user workspace state
create table if not exists public.user_workspaces (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  dumps_json jsonb default '[]'::jsonb not null,
  pool_json jsonb default '[]'::jsonb not null,
  
  constraint dumps_is_array check (jsonb_typeof(dumps_json) = 'array'),
  constraint pool_is_array check (jsonb_typeof(pool_json) = 'array')
);

-- Enable RLS
alter table public.user_workspaces enable row level security;

-- Policies: Users can only see and edit their own workspace
do $$ 
begin
  if not exists (select 1 from pg_policies where policyname = 'Users can view own workspace') then
    create policy "Users can view own workspace" on public.user_workspaces
      for select using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'Users can update own workspace') then
    create policy "Users can update own workspace" on public.user_workspaces
      for upsert with check (auth.uid() = id);
  end if;
end $$;
