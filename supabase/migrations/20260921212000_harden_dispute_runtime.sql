-- Harden runtime contracts:
-- disputes are only valid after an order reaches a state that permits the disputed transition.

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
    raise exception 'Authenticated buyer is required' using errcode='42501';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id and buyer_id=p_buyer_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode='P0002';
  end if;

  if v_order.status not in ('confirmed','processing','ready','completed') then
    raise exception 'This order cannot be disputed in its current state' using errcode='42501';
  end if;

  select * into v_dispute
  from public.disputes
  where order_id=p_order_id and status in ('open','under_review')
  limit 1;

  if found then
    return jsonb_build_object(
      'dispute_id',v_dispute.id,
      'status',v_dispute.status,
      'existing',true
    );
  end if;

  perform set_config(
    'deba.order_status_idempotency_key',
    'dispute-' || replace(gen_random_uuid()::text,'-',''),
    true
  );

  update public.orders
  set status='disputed',
      status_reason='Buyer dispute opened'
  where id=p_order_id;

  insert into public.disputes(
    order_id,raised_by,category,subject,description,status,priority
  )
  values(
    v_order.id,p_buyer_id,p_category,left(trim(p_subject),180),
    left(trim(p_description),4000),'open',
    case
      when p_category in ('payment_issue','not_received','delivery_issue')
      then 'high'
      else 'normal'
    end
  )
  returning * into v_dispute;

  insert into public.dispute_messages(dispute_id,author_id,body)
  values(
    v_dispute.id,
    p_buyer_id,
    left(trim(p_description),4000)
  );

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,after_data,metadata
  )
  values(
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
  values(
    v_order.seller_id,
    'dispute.created',
    'مراجعة طلب',
    'تم فتح مراجعة مرتبطة بأحد طلباتك.',
    '/orders/' || v_order.id,
    jsonb_build_object(
      'dispute_id',v_dispute.id,
      'order_id',v_order.id
    )
  );

  return jsonb_build_object(
    'dispute_id',v_dispute.id,
    'status',v_dispute.status,
    'existing',false
  );
end;
$$;
