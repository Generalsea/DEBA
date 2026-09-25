-- Keep private marketplace conversation media out of the public product-media bucket.
-- Access is granted only to authenticated participants of the target chat room.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'deba-chat-media',
  'deba-chat-media',
  false,
  12582912,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "chat media private insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'deba-chat-media'
  and (storage.foldername(name))[1] = 'chat'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.chat_participants participant
    where participant.room_id::text = (storage.foldername(name))[3]
      and participant.user_id = (select auth.uid())
  )
);

create policy "chat media private read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'deba-chat-media'
  and exists (
    select 1
    from public.chat_participants participant
    where participant.room_id::text = (storage.foldername(name))[3]
      and participant.user_id = (select auth.uid())
  )
);

create policy "chat media private update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'deba-chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.chat_participants participant
    where participant.room_id::text = (storage.foldername(name))[3]
      and participant.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'deba-chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.chat_participants participant
    where participant.room_id::text = (storage.foldername(name))[3]
      and participant.user_id = (select auth.uid())
  )
);

create policy "chat media private delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'deba-chat-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.chat_participants participant
    where participant.room_id::text = (storage.foldername(name))[3]
      and participant.user_id = (select auth.uid())
  )
);

create index if not exists chat_security_events_message_id_idx
  on public.chat_security_events(message_id)
  where message_id is not null;
