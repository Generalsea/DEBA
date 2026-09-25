insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deba-header-ads',
  'deba-header-ads',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.header_ad_promotions
  add column if not exists media_storage_path text,
  add column if not exists poster_storage_path text;