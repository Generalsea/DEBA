-- Phase 4: real-time in-app notifications + transactional email webhook.
-- This migration extends the existing notification model; it does not create a
-- parallel event/outbox system.
--
-- Email delivery remains opt-in at deployment time:
--   app.deba_notification_email_webhook_url -> internal Next.js webhook URL
--   Vault secret name                      -> deba_notification_webhook_secret
--
-- Neither the webhook URL nor its secret is stored in source control.

alter table public.notifications enable row level security;

revoke insert, delete on public.notifications from anon, authenticated;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

create or replace function private.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_href text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    return null;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    metadata
  )
  values (
    p_user_id,
    left(coalesce(trim(p_type), 'system.update'), 120),
    left(coalesce(trim(p_title), 'تحديث جديد'), 240),
    left(coalesce(trim(p_body), ''), 2000),
    case
      when p_href is null then null
      else left(trim(p_href), 500)
    end,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function private.create_notification(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function private.notify_offer_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_recipient uuid;
  v_title text;
  v_body text;
  v_type text;
  v_href text;
begin
  if tg_op = 'INSERT' then
    v_recipient := new.seller_id;

    if v_recipient is null then
      select p.owner_id
        into v_recipient
      from public.products p
      where p.id = new.product_id;
    end if;

    if v_recipient is not null and v_recipient <> new.buyer_id then
      perform private.create_notification(
        v_recipient,
        'offer.created',
        'وصل عرض جديد',
        'وصل عرض بقيمة ' || new.amount::text || ' ' || coalesce(new.currency, 'EGP') || '.',
        '/chat',
        jsonb_build_object(
          'entity', 'offer',
          'event', 'created',
          'offer_id', new.id,
          'product_id', new.product_id,
          'room_id', new.room_id
        )
      );
    end if;

    return new;
  end if;

  if old.status is distinct from new.status then
    v_href := '/chat';

    case new.status
      when 'accepted' then
        v_recipient := new.buyer_id;
        v_type := 'offer.accepted';
        v_title := 'تم قبول عرضك';
        v_body := 'تم قبول عرضك بقيمة ' || new.amount::text || ' ' || coalesce(new.currency, 'EGP') || '.';
      when 'rejected' then
        v_recipient := new.buyer_id;
        v_type := 'offer.rejected';
        v_title := 'تم رفض عرضك';
        v_body := 'تم رفض العرض المرتبط بهذا الإعلان.';
      when 'countered' then
        v_recipient := new.buyer_id;
        v_type := 'offer.countered';
        v_title := 'لديك عرض مقابل';
        v_body := 'أرسل البائع عرضاً مقابلاً بقيمة ' || new.amount::text || ' ' || coalesce(new.currency, 'EGP') || '.';
      when 'expired' then
        v_recipient := new.buyer_id;
        v_type := 'offer.expired';
        v_title := 'انتهت صلاحية العرض';
        v_body := 'انتهت صلاحية العرض المرتبط بهذا الإعلان.';
      when 'withdrawn' then
        v_recipient := new.seller_id;
        v_type := 'offer.withdrawn';
        v_title := 'تم سحب العرض';
        v_body := 'قام المشتري بسحب العرض المرتبط بهذا الإعلان.';
      else
        return new;
    end case;

    if v_recipient is not null then
      perform private.create_notification(
        v_recipient,
        v_type,
        v_title,
        v_body,
        v_href,
        jsonb_build_object(
          'entity', 'offer',
          'event', 'status_changed',
          'offer_id', new.id,
          'product_id', new.product_id,
          'room_id', new.room_id,
          'previous_status', old.status,
          'status', new.status
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists offers_notify_lifecycle on public.offers;

create trigger offers_notify_lifecycle
after insert or update of status on public.offers
for each row
execute function private.notify_offer_lifecycle();

create or replace function private.notify_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_type text;
  v_title text;
  v_body text;
  v_href text;
  v_event text;
begin
  if old.status is distinct from new.status then
    v_type := 'order.status_updated';
    v_title := 'تحديث حالة الطلب';
    v_body := case new.status
      when 'pending' then 'الطلب قيد الانتظار.'
      when 'confirmed' then 'تم تأكيد الطلب.'
      when 'processing' then 'بدأ تجهيز الطلب.'
      when 'ready' then 'الطلب جاهز للتسليم.'
      when 'completed' then 'تم إكمال الطلب.'
      when 'cancelled' then 'تم إلغاء الطلب.'
      when 'refunded' then 'تم رد المبلغ.'
      when 'disputed' then 'الطلب قيد النزاع.'
      else 'تم تحديث حالة الطلب.'
    end;
    v_event := 'status_changed';
  elsif old.payment_status is distinct from new.payment_status then
    v_type := 'order.payment_updated';
    v_title := 'تحديث الدفع';
    v_body := case new.payment_status
      when 'unpaid' then 'حالة الدفع: غير مدفوع.'
      when 'pending' then 'حالة الدفع: قيد المعالجة.'
      when 'paid' then 'تم تسجيل الدفع بنجاح.'
      when 'failed' then 'تعذر إتمام الدفع.'
      when 'refunded' then 'تم رد المبلغ.'
      when 'partially_refunded' then 'تم رد جزء من المبلغ.'
      else 'تم تحديث حالة الدفع.'
    end;
    v_event := 'payment_status_changed';
  elsif old.fulfillment_status is distinct from new.fulfillment_status then
    v_type := 'shipment.updated';
    v_title := 'تحديث الشحن';
    v_body := case new.fulfillment_status
      when 'pending' then 'الشحنة قيد الانتظار.'
      when 'preparing' then 'جارٍ تجهيز الشحنة.'
      when 'ready' then 'الشحنة جاهزة.'
      when 'in_transit' then 'الشحنة في الطريق.'
      when 'delivered' then 'تم تسجيل التسليم.'
      when 'confirmed' then 'تم تأكيد الاستلام.'
      when 'cancelled' then 'تم إلغاء الشحنة.'
      else 'تم تحديث حالة الشحن.'
    end;
    v_event := 'fulfillment_status_changed';
  else
    return new;
  end if;

  v_href := '/orders/' || new.id::text;

  if new.buyer_id is not null then
    perform private.create_notification(
      new.buyer_id,
      v_type,
      v_title,
      v_body,
      v_href,
      jsonb_build_object(
        'entity', 'order',
        'event', v_event,
        'order_id', new.id,
        'reference_code', new.reference_code,
        'status', new.status,
        'payment_status', new.payment_status,
        'fulfillment_status', new.fulfillment_status,
        'currency', new.currency
      )
    );
  end if;

  if new.seller_id is not null and new.seller_id is distinct from new.buyer_id then
    perform private.create_notification(
      new.seller_id,
      v_type,
      v_title,
      v_body,
      v_href,
      jsonb_build_object(
        'entity', 'order',
        'event', v_event,
        'order_id', new.id,
        'reference_code', new.reference_code,
        'status', new.status,
        'payment_status', new.payment_status,
        'fulfillment_status', new.fulfillment_status,
        'currency', new.currency
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_notify_lifecycle on public.orders;

create trigger orders_notify_lifecycle
after update of status, payment_status, fulfillment_status on public.orders
for each row
execute function private.notify_order_lifecycle();

create or replace function private.notify_shipment_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_body text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select o.buyer_id, o.seller_id
    into v_buyer_id, v_seller_id
  from public.orders o
  where o.id = new.order_id;

  v_body := case new.status
    when 'pending' then 'حالة الشحنة: قيد الانتظار.'
    when 'ready' then 'الشحنة جاهزة للتسليم.'
    when 'picked_up' then 'تم استلام الشحنة من البائع.'
    when 'in_transit' then 'الشحنة في الطريق.'
    when 'out_for_delivery' then 'الشحنة خرجت للتسليم.'
    when 'delivered' then 'تم تسجيل تسليم الشحنة.'
    when 'cancelled' then 'تم إلغاء الشحنة.'
    else 'تم تحديث حالة الشحنة.'
  end;

  if v_buyer_id is not null then
    perform private.create_notification(
      v_buyer_id,
      'shipment.status_updated',
      'تحديث الشحنة',
      v_body,
      '/orders/' || new.order_id::text,
      jsonb_build_object(
        'entity', 'shipment',
        'event', 'status_changed',
        'shipment_id', new.id,
        'order_id', new.order_id,
        'status', new.status,
        'tracking_number', new.tracking_number
      )
    );
  end if;

  if v_seller_id is not null and v_seller_id is distinct from v_buyer_id then
    perform private.create_notification(
      v_seller_id,
      'shipment.status_updated',
      'تحديث الشحنة',
      v_body,
      '/orders/' || new.order_id::text,
      jsonb_build_object(
        'entity', 'shipment',
        'event', 'status_changed',
        'shipment_id', new.id,
        'order_id', new.order_id,
        'status', new.status,
        'tracking_number', new.tracking_number
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists shipments_notify_lifecycle on public.shipments;

create trigger shipments_notify_lifecycle
after update of status on public.shipments
for each row
execute function private.notify_shipment_lifecycle();

create or replace function private.notify_report_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_product_owner uuid;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.reporter_id is not null then
    perform private.create_notification(
      new.reporter_id,
      'moderation.report_updated',
      'تحديث البلاغ',
      'تم تحديث حالة البلاغ المرتبط بإعلان أو حساب.',
      case
        when new.product_id is not null then '/products/' || new.product_id::text
        else null
      end,
      jsonb_build_object(
        'entity', 'report',
        'event', 'status_changed',
        'report_id', new.id,
        'status', new.status,
        'product_id', new.product_id
      )
    );
  end if;

  if new.reported_user_id is not null then
    v_product_owner := new.reported_user_id;
  elsif new.product_id is not null then
    select p.owner_id into v_product_owner
    from public.products p
    where p.id = new.product_id;
  end if;

  if v_product_owner is not null
     and v_product_owner is distinct from new.reporter_id then
    perform private.create_notification(
      v_product_owner,
      'moderation.report_decision',
      'تحديث إشرافي',
      'تم تحديث الحالة الإشرافية لبلاغ مرتبط بإعلانك أو حسابك.',
      case
        when new.product_id is not null then '/products/' || new.product_id::text
        else null
      end,
      jsonb_build_object(
        'entity', 'report',
        'event', 'status_changed',
        'report_id', new.id,
        'status', new.status,
        'product_id', new.product_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reports_notify_lifecycle on public.reports;

create trigger reports_notify_lifecycle
after update of status on public.reports
for each row
execute function private.notify_report_lifecycle();

create or replace function private.notification_email_enabled(
  p_user_id uuid,
  p_type text
)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select case
    when p_type like 'shipment.%' then coalesce(
      (select np.shipping_updates from public.notification_preferences np where np.user_id = p_user_id),
      true
    )
    when p_type like 'order.payment%' then coalesce(
      (select np.payment_updates from public.notification_preferences np where np.user_id = p_user_id),
      true
    )
    when p_type like 'order.%' or p_type like 'offer.%' then coalesce(
      (select np.order_updates from public.notification_preferences np where np.user_id = p_user_id),
      true
    )
    when p_type like 'moderation.%' then coalesce(
      (select np.security_updates from public.notification_preferences np where np.user_id = p_user_id),
      true
    )
    else true
  end;
$$;

revoke execute on function private.notification_email_enabled(uuid, text)
  from public, anon, authenticated;

create or replace function private.dispatch_notification_email_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp, vault, net
as $$
declare
  v_endpoint text;
  v_secret text;
begin
  if not private.notification_email_enabled(new.user_id, new.type) then
    return new;
  end if;

  v_endpoint := nullif(trim(current_setting('app.deba_notification_email_webhook_url', true)), '');
  if v_endpoint is null then
    return new;
  end if;

  select ds.decrypted_secret
    into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'deba_notification_webhook_secret'
  limit 1;

  if nullif(v_secret, '') is null then
    raise warning 'DEBA notification email webhook secret is not configured';
    return new;
  end if;

  begin
    perform net.http_post(
      url := v_endpoint,
      body := jsonb_build_object(
        'notification', jsonb_build_object(
          'id', new.id,
          'user_id', new.user_id,
          'type', new.type,
          'title', new.title,
          'body', new.body,
          'href', new.href,
          'metadata', new.metadata,
          'created_at', new.created_at
        )
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-deba-notification-secret', v_secret
      ),
      timeout_milliseconds := 2000
    );
  exception
    when others then
      raise warning 'DEBA notification email webhook enqueue failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke execute on function private.dispatch_notification_email_webhook()
  from public, anon, authenticated;

drop trigger if exists notifications_dispatch_email_webhook on public.notifications;

create trigger notifications_dispatch_email_webhook
after insert on public.notifications
for each row
execute function private.dispatch_notification_email_webhook();

grant select, update on public.notifications to authenticated;
