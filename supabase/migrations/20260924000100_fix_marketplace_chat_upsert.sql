-- Fix marketplace chat room creation against the existing partial unique index.
-- ON CONFLICT(context_key) cannot infer a partial unique index without a predicate.
-- Handle the conflict generically, then re-select the winning room and always heal participants.

create or replace function private.get_or_create_marketplace_chat(
  p_product_id uuid,
  p_buyer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_product public.products%rowtype;
  v_room public.chat_rooms%rowtype;
  v_context_key text;
  v_seller_id uuid;
begin
  if p_buyer_id is null or p_buyer_id <> (select auth.uid()) then
    raise exception 'Authenticated buyer is required' using errcode='42501';
  end if;

  select *
    into v_product
  from public.products
  where id = p_product_id
    and status = 'published'
    and moderation_status = 'approved'
    and listing_type = 'sale'
    and owner_id is not null;

  if not found then
    raise exception 'Product is not available' using errcode='P0002';
  end if;

  v_seller_id := v_product.owner_id;

  if v_seller_id = p_buyer_id then
    raise exception 'Cannot open chat with yourself' using errcode='42501';
  end if;

  v_context_key :=
    'marketplace:' ||
    p_product_id::text || ':' ||
    least(p_buyer_id::text, v_seller_id::text) || ':' ||
    greatest(p_buyer_id::text, v_seller_id::text);

  select *
    into v_room
  from public.chat_rooms
  where context_key = v_context_key
  limit 1;

  if not found then
    insert into public.chat_rooms(product_id, created_by, room_type, context_key)
    values(p_product_id, p_buyer_id, 'marketplace', v_context_key)
    on conflict do nothing
    returning * into v_room;

    if not found then
      select *
        into v_room
      from public.chat_rooms
      where context_key = v_context_key
      limit 1;
    end if;
  end if;

  if v_room.id is null then
    raise exception 'Unable to create marketplace chat room' using errcode='P0001';
  end if;

  insert into public.chat_participants(room_id, user_id)
  values(v_room.id, p_buyer_id), (v_room.id, v_seller_id)
  on conflict do nothing;

  return jsonb_build_object(
    'room_id', v_room.id,
    'product_id', p_product_id,
    'buyer_id', p_buyer_id,
    'seller_id', v_seller_id,
    'existing', v_room.created_by is distinct from p_buyer_id
  );
end;
$function$;
