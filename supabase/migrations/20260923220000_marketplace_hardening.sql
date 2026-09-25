-- DEBA marketplace hardening: seller storefront identity + chat safety ledger.
alter table public.profiles add column if not exists seller_store_key text;

create unique index if not exists profiles_seller_store_key_uidx
  on public.profiles(seller_store_key)
  where seller_store_key is not null;

create or replace function private.generate_seller_store_key()
returns text
language plpgsql
security definer
set search_path=''
as $$
declare candidate text;
begin
  loop
    candidate := encode(extensions.gen_random_bytes(16), 'hex');
    exit when not exists (select 1 from public.profiles where seller_store_key = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function private.ensure_seller_store_key()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.account_type = 'seller' and nullif(new.seller_store_key, '') is null then
    new.seller_store_key := private.generate_seller_store_key();
  end if;
  if tg_op = 'UPDATE'
     and new.seller_store_key is distinct from old.seller_store_key
     and current_user in ('authenticated','anon') then
    new.seller_store_key := old.seller_store_key;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_seller_store_key_trg on public.profiles;
create trigger profiles_seller_store_key_trg
before insert or update of account_type, seller_store_key
on public.profiles
for each row execute function private.ensure_seller_store_key();

revoke update (seller_store_key) on public.profiles from anon, authenticated;

update public.profiles
set seller_store_key = private.generate_seller_store_key(), updated_at = now()
where account_type='seller' and seller_store_key is null;

create table if not exists public.chat_security_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ip_address inet,
  mac_address text,
  email_snapshot text,
  phone_snapshot text,
  user_agent text,
  accept_language text,
  metadata jsonb not null default '{}'::jsonb,
  retention_until timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now()
);

create index if not exists chat_security_events_user_created_idx
  on public.chat_security_events(user_id, created_at desc);
create index if not exists chat_security_events_room_created_idx
  on public.chat_security_events(room_id, created_at desc);

alter table public.chat_security_events enable row level security;

drop policy if exists chat_security_events_insert_own on public.chat_security_events;
create policy chat_security_events_insert_own
on public.chat_security_events for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists chat_security_events_select_moderators on public.chat_security_events;
create policy chat_security_events_select_moderators
on public.chat_security_events for select to authenticated
using (exists (
  select 1 from public.user_roles
  where user_id=(select auth.uid())
    and role in ('admin','moderator','support')
));

revoke all on public.chat_security_events from anon;
grant insert on public.chat_security_events to authenticated;
grant select on public.chat_security_events to authenticated;

comment on table public.chat_security_events is
  'Marketplace chat safety ledger. Normal web browsers cannot expose MAC addresses over HTTPS, so mac_address remains null for web sessions.';
