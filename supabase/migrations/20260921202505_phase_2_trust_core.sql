-- DEBA Phase 2: Trust Core
-- Verified reviews, buyer disputes, dispute messaging, and support tickets.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete set null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('product','seller')),
  target_id uuid not null,
  product_id uuid references public.products(id) on delete set null,
  seller_id uuid references auth.users(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending'
    check (status in ('pending','published','hidden')),
  verified_purchase boolean not null default true,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reviews_reviewer_order_target_uidx
  on public.reviews(reviewer_id, order_id, target_type, target_id);
create unique index if not exists reviews_reviewer_idempotency_uidx
  on public.reviews(reviewer_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists reviews_product_status_created_idx
  on public.reviews(product_id, status, created_at desc);
create index if not exists reviews_seller_status_created_idx
  on public.reviews(seller_id, status, created_at desc);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  raised_by uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'not_received','not_as_described','damaged','wrong_item',
    'seller_issue','delivery_issue','payment_issue','other'
  )),
  subject text not null,
  description text not null,
  status text not null default 'open'
    check (status in ('open','under_review','resolved_buyer','resolved_seller','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  resolution_code text,
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists disputes_one_active_per_order_uidx
  on public.disputes(order_id)
  where status in ('open','under_review');
create index if not exists disputes_status_priority_created_idx
  on public.disputes(status, priority, created_at desc);

create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dispute_messages_dispute_created_idx
  on public.dispute_messages(dispute_id, created_at asc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  category text not null check (category in ('order','payment','shipping','account','product','security','other')),
  subject text not null,
  description text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','waiting_user','resolved','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_updated_idx
  on public.support_tickets(user_id, updated_at desc);
create index if not exists support_tickets_status_priority_updated_idx
  on public.support_tickets(status, priority, updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_created_idx
  on public.support_messages(ticket_id, created_at asc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at before update on public.reviews
for each row execute function private.touch_updated_at();

drop trigger if exists disputes_touch_updated_at on public.disputes;
create trigger disputes_touch_updated_at before update on public.disputes
for each row execute function private.touch_updated_at();

drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at before update on public.support_tickets
for each row execute function private.touch_updated_at();

alter table public.reviews enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists reviews_published_select on public.reviews;
create policy reviews_published_select on public.reviews
for select to anon, authenticated
using (
  status = 'published'
  or reviewer_id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists disputes_participant_select on public.disputes;
create policy disputes_participant_select on public.disputes
for select to authenticated
using (
  raised_by = (select auth.uid())
  or exists (
    select 1 from public.orders o
    where o.id = disputes.order_id and o.seller_id = (select auth.uid())
  )
  or (select private.is_admin())
);

drop policy if exists dispute_messages_participant_select on public.dispute_messages;
create policy dispute_messages_participant_select on public.dispute_messages
for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.disputes d
    where d.id = dispute_messages.dispute_id
      and (
        d.raised_by = (select auth.uid())
        or exists (
          select 1 from public.orders o
          where o.id = d.order_id and o.seller_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists dispute_messages_participant_insert on public.dispute_messages;
create policy dispute_messages_participant_insert on public.dispute_messages
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and not is_internal
  and (
    (select private.is_admin())
    or exists (
      select 1 from public.disputes d
      where d.id = dispute_messages.dispute_id
        and (
          d.raised_by = (select auth.uid())
          or exists (
            select 1 from public.orders o
            where o.id = d.order_id and o.seller_id = (select auth.uid())
          )
        )
    )
  )
);

drop policy if exists support_tickets_owner_select on public.support_tickets;
create policy support_tickets_owner_select on public.support_tickets
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists support_tickets_owner_insert on public.support_tickets;
create policy support_tickets_owner_insert on public.support_tickets
for insert to authenticated
with check (user_id = (select auth.uid()) and assigned_to is null and status = 'open');

drop policy if exists support_messages_participant_select on public.support_messages;
create policy support_messages_participant_select on public.support_messages
for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.support_tickets t
    where t.id = support_messages.ticket_id and t.user_id = (select auth.uid())
  )
);

drop policy if exists support_messages_owner_insert on public.support_messages;
create policy support_messages_owner_insert on public.support_messages
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    (select private.is_admin())
    or (
      not is_internal
      and exists (
        select 1 from public.support_tickets t
        where t.id = support_messages.ticket_id and t.user_id = (select auth.uid())
      )
    )
  )
);

revoke all on table public.reviews, public.disputes, public.dispute_messages, public.support_tickets, public.support_messages from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant select on public.disputes, public.dispute_messages, public.support_tickets, public.support_messages to authenticated;
grant insert on public.dispute_messages, public.support_messages to authenticated;
grant insert on public.support_tickets to authenticated;
grant all on all tables in schema public to service_role;

create or replace function private.create_review(
  p_reviewer_id uuid,
  p_order_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_rating smallint,
  p_title text,
  p_body text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_existing public.reviews%rowtype;
  v_review public.reviews%rowtype;
  v_seller_id uuid;
  v_item_id uuid;
begin
  if p_reviewer_id is null or p_reviewer_id <> (select auth.uid()) then
    raise exception 'Authenticated reviewer is required' using errcode = '42501';
  end if;
  if p_target_type not in ('product','seller') then
    raise exception 'Invalid review target' using errcode = '22023';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5' using errcode = '22023';
  end if;
  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16
     or length(trim(p_idempotency_key)) > 128 then
    raise exception 'Valid idempotency key is required' using errcode = '22023';
  end if;

  select * into v_existing
  from public.reviews
  where reviewer_id = p_reviewer_id
    and idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    return jsonb_build_object('review_id',v_existing.id,'status',v_existing.status,'idempotent',true);
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and buyer_id = p_reviewer_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.status <> 'completed' then
    raise exception 'Review is available after order completion' using errcode = '42501';
  end if;

  v_seller_id := v_order.seller_id;

  if p_target_type = 'product' then
    select oi.id into v_item_id
    from public.order_items oi
    where oi.order_id = v_order.id and oi.product_id = p_target_id
    limit 1;

    if v_item_id is null then
      raise exception 'Product was not part of this order' using errcode = '42501';
    end if;

    select * into v_product
    from public.products
    where id = p_target_id;

    if not found then
      raise exception 'Product not found' using errcode = 'P0002';
    end if;

    v_seller_id := v_product.owner_id;

    select * into v_existing
    from public.reviews
    where reviewer_id = p_reviewer_id
      and order_id = p_order_id
      and target_type = 'product'
      and target_id = p_target_id
    limit 1;

    if found then
      return jsonb_build_object('review_id',v_existing.id,'status',v_existing.status,'idempotent',true);
    end if;
  else
    if p_target_id <> v_order.seller_id then
      raise exception 'Seller was not part of this order' using errcode = '42501';
    end if;

    select * into v_existing
    from public.reviews
    where reviewer_id = p_reviewer_id
      and order_id = p_order_id
      and target_type = 'seller'
      and target_id = p_target_id
    limit 1;

    if found then
      return jsonb_build_object('review_id',v_existing.id,'status',v_existing.status,'idempotent',true);
    end if;
  end if;

  insert into public.reviews(
    order_id, order_item_id, reviewer_id, target_type, target_id,
    product_id, seller_id, rating, title, body, status,
    verified_purchase, idempotency_key
  )
  values (
    v_order.id, v_item_id, p_reviewer_id, p_target_type, p_target_id,
    case when p_target_type='product' then p_target_id else null end,
    v_seller_id, p_rating,
    nullif(trim(coalesce(p_title,'')), ''),
    nullif(trim(coalesce(p_body,'')), ''),
    'pending', true, trim(p_idempotency_key)
  )
  returning * into v_review;

  insert into public.audit_logs(
    actor_id, action, entity_type, entity_id, after_data, metadata
  )
  values (
    p_reviewer_id,'review.created','review',v_review.id,
    jsonb_build_object(
      'order_id',v_review.order_id,
      'target_type',v_review.target_type,
      'target_id',v_review.target_id,
      'rating',v_review.rating
    ),
    jsonb_build_object('verified_purchase',true)
  );

  insert into public.notifications(user_id,type,title,body,href,metadata)
  values (
    v_seller_id,
    'review.created',
    'تقييم جديد',
    'وصل تقييم جديد مرتبط بأحد الطلبات المكتملة.',
    '/profile?tab=seller-orders',
    jsonb_build_object('review_id',v_review.id,'order_id',v_review.order_id)
  );

  return jsonb_build_object(
    'review_id',v_review.id,'status',v_review.status,'idempotent',false
  );
end;
$$;

create or replace function public.create_review(
  p_order_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_rating smallint,
  p_title text,
  p_body text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public','private','pg_temp'
as $$
begin
  return private.create_review(
    (select auth.uid()),
    p_order_id,p_target_type,p_target_id,p_rating,p_title,p_body,p_idempotency_key
  );
end;
$$;

revoke execute on function public.create_review(uuid,text,uuid,smallint,text,text,text) from public, anon;
grant execute on function public.create_review(uuid,text,uuid,smallint,text,text,text) to authenticated;

create or replace function private.create_dispute(
  p_buyer_id uuid,
  p_order_id uuid,
  p_category text,
  p_subject text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_dispute public.disputes%rowtype;
begin
  if p_buyer_id is null or p_buyer_id <> (select auth.uid()) then
    raise exception 'Authenticated buyer is required' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and buyer_id = p_buyer_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.status in ('cancelled','refunded') then
    raise exception 'This order cannot be disputed' using errcode = '42501';
  end if;

  select * into v_dispute
  from public.disputes
  where order_id = p_order_id
    and status in ('open','under_review')
  limit 1;

  if found then
    return jsonb_build_object(
      'dispute_id',v_dispute.id,'status',v_dispute.status,'existing',true
    );
  end if;

  perform set_config(
    'deba.order_status_idempotency_key',
    'dispute-' || replace(gen_random_uuid()::text,'-',''),
    true
  );

  update public.orders
  set status = 'disputed', status_reason = 'Buyer dispute opened'
  where id = p_order_id;

  insert into public.disputes(
    order_id,raised_by,category,subject,description,status,priority
  )
  values (
    v_order.id,
    p_buyer_id,
    p_category,
    left(trim(p_subject),180),
    left(trim(p_description),4000),
    'open',
    case
      when p_category in ('payment_issue','not_received','delivery_issue')
      then 'high'
      else 'normal'
    end
  )
  returning * into v_dispute;

  insert into public.dispute_messages(dispute_id,author_id,body)
  values (
    v_dispute.id,
    p_buyer_id,
    left(trim(p_description),4000)
  );

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,after_data,metadata
  )
  values (
    p_buyer_id,
    'dispute.created',
    'dispute',
    v_dispute.id,
    jsonb_build_object(
      'order_id',v_order.id,
      'category',v_dispute.category,
      'status','open'
    ),
    jsonb_build_object('source','buyer_protection')
  );

  insert into public.notifications(
    user_id,type,title,body,href,metadata
  )
  values (
    v_order.seller_id,
    'dispute.created',
    'مراجعة طلب',
    'تم فتح مراجعة مرتبطة بأحد طلباتك.',
    '/orders/' || v_order.id,
    jsonb_build_object('dispute_id',v_dispute.id,'order_id',v_order.id)
  );

  return jsonb_build_object(
    'dispute_id',v_dispute.id,'status',v_dispute.status,'existing',false
  );
end;
$$;

create or replace function public.create_dispute(
  p_order_id uuid,
  p_category text,
  p_subject text,
  p_description text
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public','private','pg_temp'
as $$
begin
  return private.create_dispute(
    (select auth.uid()),
    p_order_id,p_category,p_subject,p_description
  );
end;
$$;

revoke execute on function public.create_dispute(uuid,text,text,text) from public, anon;
grant execute on function public.create_dispute(uuid,text,text,text) to authenticated;
