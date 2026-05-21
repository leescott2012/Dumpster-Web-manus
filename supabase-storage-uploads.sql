-- ============================================================================
-- Supabase Storage bucket for user photo/video uploads.
-- Run this ONCE in the Supabase SQL editor for the production project.
--
-- Bucket layout:  <userId>/<photoId>.<ext>
-- RLS:            users can read/write only their own folder.
-- Public reads:   yes — public URLs are embedded in the workspace JSON so
--                 the client can render them without a signed-URL round trip.
--                 Path is unguessable (nanoid photoId), and writes are still
--                 RLS-gated.
-- ============================================================================

-- Create the bucket (idempotent — uses on conflict do nothing)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-uploads',
  'workspace-uploads',
  true,                    -- public reads
  20971520,                -- 20 MB per file
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do nothing;

-- Policies on storage.objects (folder = userId)
do $$
begin
  -- Read: anyone with the URL can read (bucket is public). No policy needed.

  -- Insert: only into your own folder
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can upload own workspace files'
  ) then
    create policy "Users can upload own workspace files"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'workspace-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Update: only your own files (rare, but covers re-uploads)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can update own workspace files'
  ) then
    create policy "Users can update own workspace files"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'workspace-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Delete: only your own files (for future cleanup)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can delete own workspace files'
  ) then
    create policy "Users can delete own workspace files"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'workspace-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
