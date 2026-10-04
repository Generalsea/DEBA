-- DEBA Phase D — phone identity foundation.
-- Not applied to production by this change. Auth provider configuration is an external gate.

begin;

alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

create index if not exists profiles_phone_verified_idx
  on public.profiles(id)
  where phone_verified = true;

alter table public.profile_private
  drop constraint if exists profile_private_phone_egyptian_check;

alter table public.profile_private
  add constraint profile_private_phone_egyptian_check
  check (
    phone is null
    or phone ~ '^\+20(10|11|12|15)[0-9]{8}$'
  );

create unique index if not exists profile_private_phone_uidx
  on public.profile_private(phone)
  where phone is not null;

create or replace function private.sync_profile_phone_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  update public.profiles
  set phone_verified = (new.phone is not null and new.phone_confirmed_at is not null),
      updated_at = now()
  where id = new.id;

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
);

create or replace function private.assert_marketplace_phone_verified()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_phone_confirmed_at timestamptz;
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if v_role in ('service_role', 'supabase_admin') then
    return;
  end if;

  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select phone_confirmed_at
    into v_phone_confirmed_at
  from auth.users
  where id = v_uid;

  if v_phone_confirmed_at is null then
    raise exception 'Verified Egyptian phone is required for marketplace actions' using errcode = '42501';
  end if;
end;
$function$;

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

revoke execute on function private.assert_marketplace_phone_verified() from public;
revoke execute on function private.sync_profile_phone_verification() from public;
revoke execute on function private.guard_marketplace_phone() from public;

commit;
