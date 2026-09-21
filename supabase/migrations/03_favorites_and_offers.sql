-- DEBA Marketplace: favorites and offers hardening
-- Idempotent and aligned with the existing DEBA schema.

create extension if not exists pgcrypto;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, product_id)
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  parent_offer_id uuid null references public.offers(id) on delete set null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'countered', 'withdrawn', 'expired')),
  expires_at timestamptz null,
  message text null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.favorites enable row level security;
alter table public.offers enable row level security;

create index if not exists favorites_product_id_idx
  on public.favorites (product_id);

create index if not exists offers_product_id_status_created_at_idx
  on public.offers (product_id, status, created_at desc);

create index if not exists offers_buyer_id_created_at_idx
  on public.offers (buyer_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'favorites'
      and policyname = 'favorites_select_own'
  ) then
    create policy favorites_select_own
      on public.favorites
      for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'favorites'
      and policyname = 'favorites_insert_own'
  ) then
    create policy favorites_insert_own
      on public.favorites
      for insert
      to authenticated
      with check (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'favorites'
      and policyname = 'favorites_delete_own'
  ) then
    create policy favorites_delete_own
      on public.favorites
      for delete
      to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'offers'
      and policyname = 'offers_insert_own'
  ) then
    create policy offers_insert_own
      on public.offers
      for insert
      to authenticated
      with check (
        buyer_id = (select auth.uid())
        or (select private.is_admin())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'offers'
      and policyname = 'offers_participant_select'
  ) then
    create policy offers_participant_select
      on public.offers
      for select
      to authenticated
      using (
        buyer_id = (select auth.uid())
        or exists (
          select 1
          from public.products p
          where p.id = offers.product_id
            and p.owner_id = (select auth.uid())
        )
        or (select private.is_admin())
      );
  end if;
end
$$;
