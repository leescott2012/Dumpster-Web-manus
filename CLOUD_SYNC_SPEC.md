# Technical Spec: Dumpster Cloud Sync Implementation

## Overview
Currently, Dumpster saves all user data (dumps and photo pools) to `localStorage`. While this is fast, it means users lose their work if they clear their cache or switch devices. We need to implement a **Cloud Sync** layer using Supabase to ensure data persistence across sessions and devices for authenticated users.

## Why We Need This
1.  **Cross-Device Access**: Users can start a dump on their iPhone and finish it on their Mac.
2.  **Data Safety**: Prevents data loss if the browser cache is cleared.
3.  **Pro Feature Value**: Cloud sync is a core "Pro" expectation, making the subscription more valuable.

---

## 1. Database Schema (`supabase-cloud-sync.sql`)
We need a new table to store the serialized state of a user's workspace.

```sql
-- Create a table for user workspace state
create table public.user_workspaces (
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
create policy "Users can view own workspace" on public.user_workspaces
  for select using (auth.uid() = id);

create policy "Users can update own workspace" on public.user_workspaces
  for upsert with check (auth.uid() = id);
```

---

## 2. Sync Library (`client/src/lib/cloudSync.ts`)
This library will handle the communication between the app state and Supabase.

**Key Requirements:**
- **Debounced Saves**: Don't hit the database on every single drag-and-drop; wait for a 2-second pause in activity.
- **Conflict Resolution**: Simple "last-write-wins" is sufficient for now, but we should check `updated_at` to avoid overwriting newer cloud data with older local data.
- **Initial Load**: When a user logs in, fetch the cloud data. If local data exists and is newer, ask the user or merge (prefer cloud for simplicity in v1).

---

## 3. Integration Plan (`useCarouselState.ts`)
Update the existing hook to bridge the gap:

1.  **On Mount/Login**: 
    - If `user` exists, fetch from `user_workspaces`.
    - Update `dumps` and `pool` states with the fetched data.
2.  **On State Change**:
    - If `user` exists, trigger the debounced `saveToCloud` function from `cloudSync.ts`.
3.  **Owner Mode**:
    - **Crucial**: Ensure `IS_OWNER` data is *never* synced to the public cloud tables to keep the owner's personal photos private and separate.

---

## Implementation Notes for Claude
- Use the existing `supabase` client from `@/lib/supabase`.
- Ensure the `jsonb` columns correctly store the `Dump[]` and `Photo[]` types.
- Keep the `localStorage` as a fallback/cache so the app still feels "instant" even on slow connections.
