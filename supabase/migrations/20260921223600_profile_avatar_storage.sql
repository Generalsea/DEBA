-- DEBA profile avatar storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deba-profile-media',
  'deba-profile-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists deba_profile_media_insert on storage.objects;
create policy deba_profile_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'deba-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists deba_profile_media_update on storage.objects;
create policy deba_profile_media_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'deba-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'deba-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists deba_profile_media_delete on storage.objects;
create policy deba_profile_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'deba-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
