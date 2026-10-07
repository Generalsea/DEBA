-- DEBA Phase D — verified Egyptian phone identity foundation.
-- This migration is intentionally NOT applied to production by this PR.

begin;

-- Supabase Cron is backed by pg_cron. Enable it before referencing cron.job/cron.schedule.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

-- phone_verified is derived exclusively from auth.users and cannot be self-asserted by clients.
create or replace function private.sync_profile_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  new.phone_verified := exists (
    select 1
    from auth.users u
    where u.id = new.id
      and u.phone is not null
      and u.phone_confirmed_at is not null
      and u.phone ~ '^\+20(10|11|12|15)[0-9]{8}$'
  );
  return new;
end;
$function$;

revoke execute on function private.sync_profile_phone_verified() from public;

drop trigger if exists trg_sync_profile_phone_verified on public.profiles;
create trigger trg_sync_profile_phone_verified
before insert or update of phone_verified on public.profiles
for each row
execute function private.sync_profile_phone_verified();

alter table public.profile_private
  drop constraint if exists profile_private_phone_egyptian_check;

alter table public.profile_private
  add constraint profile_private_phone_egyptian_check
  check (
    phone is null
    or phone ~ '^\+20(10|11|12|15)[0-9]{8}$'
  ) not valid;

create unique index if not exists profile_private_phone_uidx
  on public.profile_private(phone)
  where phone is not null;

create or replace function private.guard_profile_private_phone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_auth_phone text;
begin
  if v_uid is null then
    return new;
  end if;

  if new.user_id <> v_uid then
    raise exception 'Private profile ownership violation' using errcode = '42501';
  end if;

  select phone
    into v_auth_phone
  from auth.users
  where id = v_uid;

  if new.phone is distinct from v_auth_phone then
    raise exception 'Profile phone must match authenticated phone identity' using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_profile_private_phone on public.profile_private;
create trigger trg_guard_profile_private_phone
before insert or update of phone on public.profile_private
for each row
execute function private.guard_profile_private_phone();

revoke execute on function private.guard_profile_private_phone() from public;

create or replace function private.assert_marketplace_phone_verified()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_phone_confirmed_at timestamptz;
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if v_role in ('service_role', 'supabase_admin') then
    return;
  end if;

  if v_uid is not null and (select private.is_admin()) then
    return;
  end if;

  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select phone, phone_confirmed_at
    into v_phone, v_phone_confirmed_at
  from auth.users
  where id = v_uid;

  if v_phone_confirmed_at is null
     or v_phone is null
     or v_phone !~ '^\+20(10|11|12|15)[0-9]{8}$' then
    raise exception 'Verified Egyptian phone is required for marketplace actions' using errcode = '42501';
  end if;
end;
$function$;

revoke execute on function private.assert_marketplace_phone_verified() from public;

create or replace function private.sync_profile_phone_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_valid_egyptian_phone boolean :=
    new.phone is not null
    and new.phone ~ '^\+20(10|11|12|15)[0-9]{8}$'
    and new.phone_confirmed_at is not null;
begin
  update public.profiles
  set phone_verified = v_valid_egyptian_phone,
      updated_at = now()
  where id = new.id;

  if v_valid_egyptian_phone then
    insert into public.profile_private(user_id, phone, updated_at)
    values (new.id, new.phone, now())
    on conflict (user_id) do update
      set phone = excluded.phone,
          updated_at = now();
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sync_profile_phone_verification on auth.users;
create trigger trg_sync_profile_phone_verification
after insert or update of phone, phone_confirmed_at on auth.users
for each row
execute function private.sync_profile_phone_verification();

update public.profiles p
set phone_verified = exists (
  select 1
  from auth.users u
  where u.id = p.id
    and u.phone is not null
    and u.phone_confirmed_at is not null
    and u.phone ~ '^\+20(10|11|12|15)[0-9]{8}$'
);

-- Realtime Presence:
-- private per-user topics; observers can read presence,
-- but only the authenticated owner can publish their own topic.
drop policy if exists deba_presence_read on realtime.messages;
create policy deba_presence_read
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and realtime.topic() like 'deba:presence:%'
);

drop policy if exists deba_presence_publish_own on realtime.messages;
create policy deba_presence_publish_own
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and realtime.topic() = 'deba:presence:' || (select auth.uid())::text
);

create or replace function private.cleanup_stale_phone_change(
  p_max_age interval default interval '24 hours'
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_count integer;
begin
  update auth.users
  set phone_change = null,
      phone_change_token = null,
      phone_change_sent_at = null
  where phone_change is not null
    and phone_confirmed_at is null
    and phone_change_sent_at is not null
    and phone_change_sent_at < now() - p_max_age;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke execute on function private.cleanup_stale_phone_change(interval) from public;

do $cron$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'deba-auth-cleanup-stale-phone-change'
  ) then
    perform cron.schedule(
      'deba-auth-cleanup-stale-phone-change',
      '0 * * * *',
      $command$select private.cleanup_stale_phone_change();$command$
    );
  end if;
end;
$cron$;

-- Direct RPC callers must satisfy the same phone-trust boundary as HTTP routes.
create or replace function public.start_seller_verification(
  p_verification_level text,
  p_legal_name text,
  p_taxpayer_number text,
  p_document_type text,
  p_document_country text
)
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  perform private.assert_marketplace_phone_verified();

  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_verification_level not in ('basic','identity','business') then
    raise exception 'Invalid verification level' using errcode='22023';
  end if;

  insert into public.seller_verifications(
    user_id,verification_level,status,legal_name,taxpayer_number,
    document_type,document_country,submitted_at
  )
  values(
    v_uid,p_verification_level,'pending',
    nullif(trim(p_legal_name),''),nullif(trim(p_taxpayer_number),''),
    nullif(trim(p_document_type),''),coalesce(nullif(trim(p_document_country),''),'EG'),
    now()
  )
  on conflict(user_id) do update
  set verification_level=excluded.verification_level,
      status='pending',
      legal_name=excluded.legal_name,
      taxpayer_number=excluded.taxpayer_number,
      document_type=excluded.document_type,
      document_country=excluded.document_country,
      submitted_at=now(),
      reviewed_at=null,
      reviewed_by=null,
      review_note=null
  returning id into v_id;

  return jsonb_build_object('verification_id',v_id,'status','pending');
end;
$function$;

drop policy if exists products_insert_seller on public.products;
create policy products_insert_seller
on public.products
for insert
to authenticated
with check (
  (select private.is_admin())
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'seller'
    )
    and exists (
      select 1
      from auth.users u
      where u.id = (select auth.uid())
        and u.phone is not null
        and u.phone_confirmed_at is not null
        and u.phone ~ '^\+20(10|11|12|15)[0-9]{8}$'
    )
    and status = 'draft'
    and moderation_status = 'pending'
  )
);

drop policy if exists products_delete_seller on public.products;
create policy products_delete_seller
on public.products
for delete
to authenticated
using (
  (select private.is_admin())
  or (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.account_type = 'seller'
    )
    and exists (
      select 1
      from auth.users u
      where u.id = (select auth.uid())
        and u.phone is not null
        and u.phone_confirmed_at is not null
        and u.phone ~ '^\+20(10|11|12|15)[0-9]{8}$'
    )
    and status = 'draft'
    and moderation_status in ('pending', 'rejected', 'needs_changes')
    and not exists (
      select 1 from public.orders o where o.product_id = products.id
    )
    and not exists (
      select 1 from public.offers o where o.product_id = products.id
    )
  )
);

create or replace function private.guard_marketplace_phone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  perform private.assert_marketplace_phone_verified();
  return new;
end;
$function$;

revoke execute on function private.guard_marketplace_phone() from public;

create or replace function private.annotate_listing_risk_signals()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, pg_catalog
as $function$
declare
  v_normalized_title text;
  v_duplicate_count integer;
  v_risk_flags jsonb;
begin
  if new.owner_id is null
     or new.category_id is null
     or new.title is null
     or btrim(new.title) = '' then
    return new;
  end if;

  v_normalized_title := lower(
    regexp_replace(
      private.deba_normalize_arabic(btrim(new.title)),
      '[[:space:][:punct:]]',
      '',
      'g'
    )
  );

  select count(*)
    into v_duplicate_count
  from public.products p
  where p.owner_id = new.owner_id
    and p.category_id = new.category_id
    and p.id is distinct from new.id
    and p.created_at >= now() - interval '30 days'
    and p.status in ('draft', 'published', 'paused', 'reserved')
    and similarity(
      lower(
        regexp_replace(
          private.deba_normalize_arabic(btrim(p.title)),
          '[[:space:][:punct:]]',
          '',
          'g'
        )
      ),
      v_normalized_title
    ) >= 0.92
    and (
      new.price is null
      or p.price is null
      or p.currency is distinct from new.currency
      or abs(p.price - new.price) <= greatest(1, abs(new.price) * 0.05)
    );

  if v_duplicate_count = 0 then
    return new;
  end if;

  v_risk_flags := coalesce(
    new.metadata -> 'system_risk_flags',
    '[]'::jsonb
  );

  if jsonb_typeof(v_risk_flags) <> 'array' then
    v_risk_flags := '[]'::jsonb;
  end if;

  if not (v_risk_flags ? 'possible_duplicate_listing') then
    v_risk_flags := v_risk_flags || to_jsonb(array['possible_duplicate_listing']);
  end if;

  new.metadata := jsonb_set(
    coalesce(new.metadata, '{}'::jsonb),
    '{system_risk_flags}',
    v_risk_flags,
    true
  );

  return new;
end;
$function$;

drop trigger if exists trg_annotate_listing_risk_signals on public.products;
create trigger trg_annotate_listing_risk_signals
before insert on public.products
for each row
execute function private.annotate_listing_risk_signals();

create or replace function private.annotate_chat_abuse_signals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_normalized text;
  v_recent_count integer;
  v_repeat_count integer;
  v_risk_flags text[] :=
    coalesce(
      array(
        select jsonb_array_elements_text(
          case
            when jsonb_typeof(coalesce(new.metadata -> 'risk_flags', '[]'::jsonb)) = 'array'
              then coalesce(new.metadata -> 'risk_flags', '[]'::jsonb)
            else '[]'::jsonb
          end
        )
      ),
      '{}'::text[]
    );
begin
  if new.body is null or btrim(new.body) = '' then
    return new;
  end if;

  v_normalized := lower(
    regexp_replace(
      private.deba_normalize_arabic(btrim(new.body)),
      '[[:space:][:punct:]]',
      '',
      'g'
    )
  );

  select count(*)
    into v_recent_count
  from public.messages m
  where m.room_id = new.room_id
    and m.sender_id = new.sender_id
    and m.created_at >= now() - interval '2 minutes';

  if v_recent_count >= 10 and not ('rapid_messages' = any(v_risk_flags)) then
    v_risk_flags := array_append(v_risk_flags, 'rapid_messages');
  end if;

  if length(v_normalized) >= 12 then
    select count(*)
      into v_repeat_count
    from public.messages m
    where m.room_id = new.room_id
      and m.sender_id = new.sender_id
      and m.created_at >= now() - interval '10 minutes'
      and lower(
        regexp_replace(
          private.deba_normalize_arabic(coalesce(m.body, '')),
          '[[:space:][:punct:]]',
          '',
          'g'
        )
      ) = v_normalized;

    if v_repeat_count >= 2 and not ('repeated_content' = any(v_risk_flags)) then
      v_risk_flags := array_append(v_risk_flags, 'repeated_content');
    end if;
  end if;

  new.metadata := jsonb_set(
    coalesce(new.metadata, '{}'::jsonb),
    '{risk_flags}',
    to_jsonb(v_risk_flags),
    true
  );

  return new;
end;
$function$;

drop trigger if exists trg_annotate_chat_abuse_signals on public.messages;
create trigger trg_annotate_chat_abuse_signals
before insert on public.messages
for each row
execute function private.annotate_chat_abuse_signals();

drop trigger if exists trg_products_phone_verified on public.products;
create trigger trg_products_phone_verified
before insert or update on public.products
for each row
execute function private.guard_marketplace_phone();

drop trigger if exists trg_marketplace_chat_phone_verified on public.chat_rooms;
create trigger trg_marketplace_chat_phone_verified
before insert on public.chat_rooms
for each row
execute function private.guard_marketplace_phone();

drop trigger if exists trg_marketplace_messages_phone_verified on public.messages;
create trigger trg_marketplace_messages_phone_verified
before insert on public.messages
for each row
execute function private.guard_marketplace_phone();

drop trigger if exists trg_marketplace_offers_phone_verified on public.offers;
create trigger trg_marketplace_offers_phone_verified
before insert on public.offers
for each row
execute function private.guard_marketplace_phone();

commit;
