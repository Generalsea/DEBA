-- DEBA Transaction Core
-- Atomic fixed-price orders, lifecycle history, payment domain, shipping domain,
-- notifications, and audit logging.

alter table public.orders
  add column if not exists reference_code text,
  add column if not exists idempotency_key text,
  add column if not exists status_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists version integer not null default 1;

update public.orders
set reference_code = coalesce(
  reference_code,
  'DB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
)
where reference_code is null;

alter table public.orders alter column reference_code set not null;

create unique index if not exists orders_reference_code_uidx
  on public.orders(reference_code);

create unique index if not exists orders_buyer_idempotency_uidx
  on public.orders(buyer_id, idempotency_key)
  where idempotency_key is not null;

alter table public.orders drop constraint if exists orders_total_components_check;
alter table public.orders add constraint orders_total_components_check
  check (total = subtotal + shipping_fee + platform_fee);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists order_status_history_idempotency_uidx
  on public.order_status_history(order_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists order_status_history_order_created_idx
  on public.order_status_history(order_id, created_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  status text not null default 'pending'
    check (status in ('pending','requires_action','processing','paid','failed','cancelled','refunded','partially_refunded')),
  amount numeric not null check (amount > 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  provider_payment_id text,
  provider_order_id text,
  client_secret text,
  checkout_url text,
  idempotency_key text,
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_created_idx
  on public.payments(order_id, created_at desc);

create unique index if not exists payments_provider_payment_uidx
  on public.payments(provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists payments_order_idempotency_uidx
  on public.payments(order_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  provider text not null,
  status text not null default 'created'
    check (status in ('created','processing','succeeded','failed','cancelled')),
  idempotency_key text,
  provider_request_id text,
  provider_transaction_id text,
  failure_code text,
  failure_message text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_attempts_payment_created_idx
  on public.payment_attempts(payment_id, created_at desc);

create unique index if not exists payment_attempts_provider_idempotency_uidx
  on public.payment_attempts(provider, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','ignored','failed')),
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

create index if not exists payment_webhooks_status_created_idx
  on public.payment_webhooks(processing_status, created_at desc);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric not null check (amount > 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending','processing','succeeded','failed','cancelled')),
  provider_ref text,
  reason text,
  idempotency_key text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists refunds_payment_idempotency_uidx
  on public.refunds(payment_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text,
  service_level text,
  status text not null default 'pending'
    check (status in ('pending','label_created','ready','picked_up','in_transit','out_for_delivery','delivered','failed','cancelled','returned')),
  tracking_number text,
  external_shipment_id text,
  shipping_fee numeric not null default 0 check (shipping_fee >= 0),
  delivery_address_snapshot jsonb not null default '{}'::jsonb,
  estimated_delivery_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shipments_order_uidx on public.shipments(order_id);

create unique index if not exists shipments_provider_external_uidx
  on public.shipments(provider, external_shipment_id)
  where provider is not null and external_shipment_id is not null;

create index if not exists shipments_status_updated_idx
  on public.shipments(status, updated_at desc);

create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  event_code text not null,
  status text,
  description text,
  location text,
  occurred_at timestamptz not null default now(),
  provider_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists shipment_events_provider_uidx
  on public.shipment_events(shipment_id, provider_event_id)
  where provider_event_id is not null;

create index if not exists shipment_events_shipment_occurred_idx
  on public.shipment_events(shipment_id, occurred_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  order_updates boolean not null default true,
  payment_updates boolean not null default true,
  shipping_updates boolean not null default true,
  security_updates boolean not null default true,
  marketing_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_created_idx
  on public.audit_logs(entity_type, entity_id, created_at desc);

create index if not exists audit_logs_actor_created_idx
  on public.audit_logs(actor_id, created_at desc);

alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_webhooks enable row level security;
alter table public.refunds enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists order_status_history_participant_select on public.order_status_history;
create policy order_status_history_participant_select on public.order_status_history
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

drop policy if exists payments_participant_select on public.payments;
create policy payments_participant_select on public.payments
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

drop policy if exists payment_attempts_participant_select on public.payment_attempts;
create policy payment_attempts_participant_select on public.payment_attempts
for select to authenticated using (
  exists (
    select 1
    from public.payments p
    join public.orders o on o.id = p.order_id
    where p.id = payment_attempts.payment_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

drop policy if exists refunds_participant_select on public.refunds;
create policy refunds_participant_select on public.refunds
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = refunds.order_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

drop policy if exists shipments_participant_select on public.shipments;
create policy shipments_participant_select on public.shipments
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = shipments.order_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

drop policy if exists shipment_events_participant_select on public.shipment_events;
create policy shipment_events_participant_select on public.shipment_events
for select to authenticated using (
  exists (
    select 1 from public.shipments s
    join public.orders o on o.id = s.order_id
    where s.id = shipment_events.shipment_id
      and (
        o.buyer_id = (select auth.uid())
        or o.seller_id = (select auth.uid())
        or (select private.is_admin())
      )
  )
);

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_owner_select on public.notification_preferences;
create policy notification_preferences_owner_select on public.notification_preferences
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_owner_insert on public.notification_preferences;
create policy notification_preferences_owner_insert on public.notification_preferences
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_owner_update on public.notification_preferences;
create policy notification_preferences_owner_update on public.notification_preferences
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.enforce_order_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('confirmed','cancelled'))
      or (old.status = 'confirmed' and new.status in ('processing','cancelled','disputed'))
      or (old.status = 'processing' and new.status in ('ready','cancelled','disputed'))
      or (old.status = 'ready' and new.status in ('completed','disputed'))
      or (old.status = 'completed' and new.status in ('refunded','disputed'))
      or (old.status = 'disputed' and new.status in ('completed','refunded','cancelled'))
    ) then
      raise exception 'Invalid order status transition: % -> %', old.status, new.status;
    end if;
    new.version := old.version + 1;
    if new.status = 'confirmed' then new.confirmed_at := now(); end if;
    if new.status = 'completed' then new.completed_at := now(); end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_validate_status_transition on public.orders;
create trigger orders_validate_status_transition
before update of status on public.orders
for each row execute function private.enforce_order_status_transition();

create or replace function private.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history(
      order_id, from_status, to_status, actor_id, reason, metadata, idempotency_key
    )
    values (
      new.id, old.status, new.status, auth.uid(), new.status_reason,
      jsonb_build_object('source','order_transition'),
      nullif(current_setting('deba.order_status_idempotency_key', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status_change on public.orders;
create trigger orders_log_status_change
after update of status on public.orders
for each row execute function private.log_order_status_change();

create or replace function private.transition_order_status(
  p_order_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_status_history%rowtype;
  v_is_admin boolean;
  v_item_quantity integer;
begin
  if p_actor_id is null or p_actor_id <> (select auth.uid()) then
    raise exception 'Authenticated actor is required' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'Valid idempotency key is required' using errcode = '22023';
  end if;

  select * into v_existing
  from public.order_status_history
  where order_id = p_order_id and idempotency_key = trim(p_idempotency_key)
  order by created_at desc limit 1;

  if found then
    return jsonb_build_object('order_id', p_order_id, 'status', v_existing.to_status, 'idempotent', true);
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  v_is_admin := (select private.is_admin());

  if not v_is_admin and p_actor_id <> v_order.buyer_id and p_actor_id <> v_order.seller_id then
    raise exception 'Not allowed to update this order' using errcode = '42501';
  end if;

  if p_new_status = 'cancelled' and v_order.payment_status in ('paid','partially_refunded') then
    raise exception 'Paid orders require a refund workflow before cancellation' using errcode = '42501';
  end if;

  if not v_is_admin then
    if p_actor_id = v_order.seller_id then
      if not (
        (v_order.status = 'pending' and p_new_status = 'confirmed')
        or (v_order.status = 'confirmed' and p_new_status = 'processing')
        or (v_order.status = 'processing' and p_new_status = 'ready')
      ) then
        raise exception 'Seller cannot make this status transition' using errcode = '42501';
      end if;
    else
      if not (
        (v_order.status = 'pending' and p_new_status = 'cancelled')
        or (v_order.status = 'ready' and p_new_status = 'completed')
      ) then
        raise exception 'Buyer cannot make this status transition' using errcode = '42501';
      end if;
    end if;
  end if;

  perform set_config('deba.order_status_idempotency_key', trim(p_idempotency_key), true);
  perform set_config('deba.internal_operation','order_create',true);

  if p_new_status = 'cancelled' and v_order.status <> 'cancelled' then
    select coalesce(sum(quantity),0)::integer into v_item_quantity
    from public.order_items where order_id = v_order.id;

    update public.products
    set quantity = quantity + v_item_quantity, status = 'published'
    where id = v_order.product_id;
  end if;

  if p_new_status = 'completed' and v_order.product_id is not null then
    update public.products
    set status = case when quantity = 0 then 'sold' else status end,
        sold_at = case when quantity = 0 then coalesce(sold_at, now()) else sold_at end
    where id = v_order.product_id;
  end if;

  update public.orders
  set status = p_new_status,
      status_reason = nullif(trim(coalesce(p_reason,'')), '')
  where id = p_order_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values (
    p_actor_id, 'order.status_changed', 'order', p_order_id,
    jsonb_build_object('status',v_order.status,'payment_status',v_order.payment_status),
    jsonb_build_object('status',p_new_status,'payment_status',v_order.payment_status),
    jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')), ''))
  );

  insert into public.notifications(user_id, type, title, body, href, metadata)
  values (
    case when p_actor_id = v_order.buyer_id then v_order.seller_id else v_order.buyer_id end,
    'order.updated', 'تحديث حالة الطلب', 'تم تحديث حالة أحد طلبات DEBA.',
    '/orders/' || p_order_id,
    jsonb_build_object('order_id',p_order_id,'status',p_new_status)
  );

  return jsonb_build_object('order_id', p_order_id, 'status', p_new_status, 'idempotent', false);
end;
$$;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_new_status text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public','private','pg_temp'
as $$
begin
  return private.transition_order_status(
    p_order_id,
    p_new_status,
    (select auth.uid()),
    p_reason,
    p_idempotency_key
  );
end;
$$;

revoke execute on function public.transition_order_status(uuid,text,text,text) from public, anon;
grant execute on function public.transition_order_status(uuid,text,text,text) to authenticated;

create or replace function private.set_payment_state(
  p_payment_id uuid,
  p_status text,
  p_provider_payment_id text,
  p_provider_order_id text,
  p_provider_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;

  update public.payments
  set status = p_status,
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      provider_order_id = coalesce(p_provider_order_id, provider_order_id),
      provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
      paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
      failed_at = case when p_status = 'failed' then coalesce(failed_at, now()) else failed_at end,
      cancelled_at = case when p_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end
  where id = v_payment.id;

  update public.orders
  set payment_status = case
    when p_status = 'paid' then 'paid'
    when p_status = 'failed' then 'failed'
    when p_status = 'refunded' then 'refunded'
    when p_status = 'partially_refunded' then 'partially_refunded'
    when p_status in ('processing','pending','requires_action') then 'pending'
    when p_status = 'cancelled' then 'failed'
    else payment_status
  end
  where id = v_order.id;

  if p_status = 'paid' and v_order.status = 'pending' then
    update public.orders
    set status = 'confirmed', status_reason = 'Payment confirmed'
    where id = v_order.id;
  elsif p_status = 'refunded' and v_order.status in ('completed','disputed') then
    perform set_config('deba.order_status_idempotency_key','payment-refund',true);
    update public.orders
    set status = 'refunded', status_reason = 'Payment refunded'
    where id = v_order.id;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data, metadata)
  values (
    null,
    'payment.state_changed',
    'payment',
    v_payment.id,
    jsonb_build_object('status',p_status,'order_id',v_order.id),
    jsonb_build_object('provider_payment_id',p_provider_payment_id)
  );

  insert into public.notifications(user_id, type, title, body, href, metadata)
  values (
    v_order.buyer_id,
    'payment.updated',
    'تحديث الدفع',
    case
      when p_status = 'paid' then 'تم تأكيد الدفع بنجاح.'
      when p_status = 'refunded' then 'تم تأكيد استرداد المبلغ.'
      when p_status = 'partially_refunded' then 'تم تسجيل استرداد جزئي للمبلغ.'
      else 'تم تحديث حالة الدفع الخاصة بطلبك.'
    end,
    '/orders/' || v_order.id,
    jsonb_build_object('payment_id',v_payment.id,'order_id',v_order.id,'status',p_status)
  );

  return jsonb_build_object(
    'payment_id',v_payment.id,'order_id',v_order.id,'status',p_status
  );
end;
$$;

create or replace function public.apply_payment_state(
  p_payment_id uuid,
  p_status text,
  p_provider_payment_id text,
  p_provider_order_id text,
  p_provider_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public','private','pg_temp'
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  return private.set_payment_state(
    p_payment_id,p_status,p_provider_payment_id,p_provider_order_id,p_provider_payload
  );
end;
$$;

revoke execute on function public.apply_payment_state(uuid,text,text,text,jsonb)
  from public, anon, authenticated;

grant execute on function public.apply_payment_state(uuid,text,text,text,jsonb)
  to service_role;

create or replace function private.set_payment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
for each row execute function private.set_payment_updated_at();

drop trigger if exists refunds_set_updated_at on public.refunds;
create trigger refunds_set_updated_at before update on public.refunds
for each row execute function private.set_payment_updated_at();

drop trigger if exists shipments_set_updated_at on public.shipments;
create trigger shipments_set_updated_at before update on public.shipments
for each row execute function private.set_payment_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function private.set_payment_updated_at();


create or replace function private.transition_shipment_status(
  p_shipment_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_order public.orders%rowtype;
  v_is_admin boolean;
  v_event_id uuid;
begin
  if p_actor_id is null or p_actor_id <> (select auth.uid()) then
    raise exception 'Authenticated actor is required' using errcode = '42501';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'Valid idempotency key is required' using errcode = '22023';
  end if;

  select s.* into v_shipment from public.shipments s where s.id = p_shipment_id for update;
  if not found then raise exception 'Shipment not found' using errcode = 'P0002'; end if;

  select o.* into v_order from public.orders o where o.id = v_shipment.order_id for update;

  v_is_admin := (select private.is_admin());
  if not v_is_admin and p_actor_id <> v_order.seller_id then
    raise exception 'Not allowed to update this shipment' using errcode = '42501';
  end if;

  if not (
    (v_shipment.status = 'pending' and p_new_status in ('label_created','ready','cancelled'))
    or (v_shipment.status = 'label_created' and p_new_status in ('ready','cancelled'))
    or (v_shipment.status = 'ready' and p_new_status in ('picked_up','cancelled'))
    or (v_shipment.status = 'picked_up' and p_new_status in ('in_transit','failed','cancelled'))
    or (v_shipment.status = 'in_transit' and p_new_status in ('out_for_delivery','delivered','failed','returned'))
    or (v_shipment.status = 'out_for_delivery' and p_new_status in ('delivered','failed','returned'))
    or (v_shipment.status = 'failed' and p_new_status in ('in_transit','cancelled'))
    or (v_shipment.status = 'cancelled' and p_new_status = 'pending')
  ) then
    raise exception 'Invalid shipment status transition: % -> %', v_shipment.status, p_new_status;
  end if;

  update public.shipments
  set status = p_new_status,
      shipped_at = case when p_new_status in ('picked_up','in_transit','out_for_delivery') then coalesce(shipped_at, now()) else shipped_at end,
      delivered_at = case when p_new_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end
  where id = p_shipment_id;

  insert into public.shipment_events(
    shipment_id, event_code, status, description, occurred_at, payload
  )
  values (
    p_shipment_id, 'status_changed', p_new_status,
    nullif(trim(coalesce(p_reason,'')), ''), now(),
    jsonb_build_object('source','deba','actor_id',p_actor_id)
  )
  returning id into v_event_id;

  update public.orders
  set fulfillment_status = case
    when p_new_status in ('label_created','ready') then 'ready'
    when p_new_status in ('picked_up','in_transit','out_for_delivery') then 'in_transit'
    when p_new_status = 'delivered' then 'delivered'
    when p_new_status in ('cancelled','returned') then 'cancelled'
    else fulfillment_status
  end
  where id = v_order.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values (
    p_actor_id, 'shipment.status_changed', 'shipment', p_shipment_id,
    jsonb_build_object('status',v_shipment.status),
    jsonb_build_object('status',p_new_status),
    jsonb_build_object('order_id',v_order.id,'event_id',v_event_id)
  );

  insert into public.notifications(user_id, type, title, body, href, metadata)
  values (
    v_order.buyer_id, 'shipment.updated', 'تحديث الشحنة',
    'تم تحديث حالة شحنتك.',
    '/orders/' || v_order.id,
    jsonb_build_object('shipment_id',p_shipment_id,'order_id',v_order.id,'status',p_new_status)
  );

  return jsonb_build_object(
    'shipment_id',p_shipment_id,'order_id',v_order.id,'status',p_new_status,'event_id',v_event_id
  );
end;
$$;

create or replace function public.transition_shipment_status(
  p_shipment_id uuid,
  p_new_status text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = 'public','private','pg_temp'
as $$
begin
  return private.transition_shipment_status(
    p_shipment_id, p_new_status, (select auth.uid()), p_reason, p_idempotency_key
  );
end;
$$;

revoke execute on function public.transition_shipment_status(uuid,text,text,text) from public, anon;
grant execute on function public.transition_shipment_status(uuid,text,text,text) to authenticated;


revoke all on table public.order_status_history from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.payment_attempts from anon, authenticated;
revoke all on table public.payment_webhooks from anon, authenticated;
revoke all on table public.refunds from anon, authenticated;
revoke all on table public.shipments from anon, authenticated;
revoke all on table public.shipment_events from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select on public.order_status_history to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_attempts to authenticated;
grant select on public.refunds to authenticated;
grant select on public.shipments to authenticated;
grant select on public.shipment_events to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant all on all tables in schema public to service_role;
