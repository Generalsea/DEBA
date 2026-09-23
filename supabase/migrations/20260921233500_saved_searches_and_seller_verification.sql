-- Saved searches and seller verification foundations.

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  query text,
  filters jsonb not null default '{}'::jsonb,
  search_hash text not null,
  alert_frequency text not null default 'off'
    check (alert_frequency in ('off','instant','daily')),
  last_notified_at timestamptz,
  last_match_count integer not null default 0 check (last_match_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,search_hash)
);

create index if not exists saved_searches_user_updated_idx
  on public.saved_searches(user_id,updated_at desc);

create index if not exists saved_searches_alert_idx
  on public.saved_searches(alert_frequency,last_notified_at)
  where alert_frequency <> 'off';

alter table public.saved_searches enable row level security;

drop policy if exists saved_searches_owner_select on public.saved_searches;
create policy saved_searches_owner_select on public.saved_searches
for select to authenticated using(user_id=(select auth.uid()));

drop policy if exists saved_searches_owner_insert on public.saved_searches;
create policy saved_searches_owner_insert on public.saved_searches
for insert to authenticated with check(user_id=(select auth.uid()));

drop policy if exists saved_searches_owner_update on public.saved_searches;
create policy saved_searches_owner_update on public.saved_searches
for update to authenticated
using(user_id=(select auth.uid()))
with check(user_id=(select auth.uid()));

drop policy if exists saved_searches_owner_delete on public.saved_searches;
create policy saved_searches_owner_delete on public.saved_searches
for delete to authenticated using(user_id=(select auth.uid()));

revoke all on public.saved_searches from anon,authenticated;
grant select,insert,update,delete on public.saved_searches to authenticated;

create table if not exists public.seller_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started','pending','verified','rejected','needs_changes','suspended')),
  verification_level text not null default 'basic'
    check (verification_level in ('basic','identity','business')),
  legal_name text,
  taxpayer_number text,
  document_type text,
  document_country text default 'EG',
  document_last4 text,
  document_storage_path text,
  selfie_storage_path text,
  provider text not null default 'manual',
  provider_reference text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seller_verifications_provider_ref_uidx
  on public.seller_verifications(provider,provider_reference)
  where provider_reference is not null;

create index if not exists seller_verifications_status_idx
  on public.seller_verifications(status,created_at desc);

create index if not exists seller_verifications_reviewed_by_idx
  on public.seller_verifications(reviewed_by);

alter table public.seller_verifications enable row level security;

drop policy if exists seller_verifications_owner_select on public.seller_verifications;
create policy seller_verifications_owner_select on public.seller_verifications
for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_admin()));

drop policy if exists seller_verifications_owner_insert on public.seller_verifications;
create policy seller_verifications_owner_insert on public.seller_verifications
for insert to authenticated with check(user_id=(select auth.uid()));

drop policy if exists seller_verifications_owner_update on public.seller_verifications;
create policy seller_verifications_owner_update on public.seller_verifications
for update to authenticated
using(user_id=(select auth.uid()) or (select private.is_admin()))
with check(user_id=(select auth.uid()) or (select private.is_admin()));

revoke all on public.seller_verifications from anon,authenticated;
grant select,insert,update on public.seller_verifications to authenticated;

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
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then
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
    (select auth.uid()),p_verification_level,'pending',
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
      reviewed_at=null,reviewed_by=null,review_note=null
  returning id into v_id;

  return jsonb_build_object('verification_id',v_id,'status','pending');
end;
$$;

revoke execute on function public.start_seller_verification(text,text,text,text,text)
from public,anon;
grant execute on function public.start_seller_verification(text,text,text,text,text)
to authenticated;

create or replace function public.admin_review_seller_verification(
  p_verification_id uuid,p_status text,p_note text
)
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $$
declare v_user_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required' using errcode='42501';
  end if;

  if p_status not in ('verified','rejected','needs_changes','suspended') then
    raise exception 'Invalid verification status' using errcode='22023';
  end if;

  update public.seller_verifications
  set status=p_status,reviewed_at=now(),reviewed_by=(select auth.uid()),
      review_note=nullif(trim(coalesce(p_note,'')),'')
  where id=p_verification_id
  returning user_id into v_user_id;

  if v_user_id is null then
    raise exception 'Verification not found' using errcode='P0002';
  end if;

  if p_status='verified' then
    update public.profiles set account_type='seller' where id=v_user_id;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data)
  values(
    (select auth.uid()),'seller_verification.reviewed','seller_verification',
    p_verification_id,
    jsonb_build_object('status',p_status,'user_id',v_user_id,'note',p_note)
  );

  return jsonb_build_object(
    'verification_id',p_verification_id,'user_id',v_user_id,'status',p_status
  );
end;
$$;

revoke execute on function public.admin_review_seller_verification(uuid,text,text)
from public,anon;
grant execute on function public.admin_review_seller_verification(uuid,text,text)
to authenticated;
