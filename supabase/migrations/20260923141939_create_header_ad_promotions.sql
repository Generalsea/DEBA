create table if not exists public.header_ad_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,
  poster_url text,
  target_url text not null,
  cta_label text not null default 'اكتشف الآن',
  alt_text text not null default 'إعلان DEBA',
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint header_ad_promotions_schedule_ck
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists idx_header_ad_promotions_active_order
  on public.header_ad_promotions (is_active, sort_order, starts_at, ends_at);

alter table public.header_ad_promotions enable row level security;

drop policy if exists "Public can read active header ads" on public.header_ad_promotions;

create policy "Public can read active header ads"
on public.header_ad_promotions
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

comment on table public.header_ad_promotions is
  'Dynamic DEBA header promotional media. Public read is limited to active scheduled rows; writes are server/admin controlled.';

comment on column public.header_ad_promotions.media_url is
  'Absolute URL or same-origin public media URL. Expected visual aspect ratio is 9:16 for reel/short-form header creatives.';

comment on column public.header_ad_promotions.target_url is
  'Destination URL opened when a visitor activates the promotional creative.';