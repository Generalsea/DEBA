-- Marketplace chat: one protected Buyer <-> Seller room per product pair.

alter table public.chat_rooms
  add column if not exists context_key text;

create unique index if not exists chat_rooms_context_key_uidx
  on public.chat_rooms(context_key)
  where context_key is not null;

create index if not exists chat_rooms_product_updated_idx
  on public.chat_rooms(product_id,updated_at desc);

create index if not exists chat_participants_room_user_idx
  on public.chat_participants(room_id,user_id);

create index if not exists messages_room_created_idx
  on public.messages(room_id,created_at desc);

create or replace function private.get_or_create_marketplace_chat(
  p_product_id uuid,
  p_buyer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_product public.products%rowtype;
  v_room public.chat_rooms%rowtype;
  v_context_key text;
  v_seller_id uuid;
begin
  if p_buyer_id is null or p_buyer_id<>(select auth.uid()) then
    raise exception 'Authenticated buyer is required' using errcode='42501';
  end if;

  select * into v_product
  from public.products
  where id=p_product_id
    and status='published'
    and moderation_status='approved'
    and listing_type='sale'
    and owner_id is not null;

  if not found then raise exception 'Product is not available' using errcode='P0002'; end if;

  v_seller_id:=v_product.owner_id;

  if v_seller_id=p_buyer_id then
    raise exception 'Cannot open chat with yourself' using errcode='42501';
  end if;

  v_context_key:='marketplace:' ||
    p_product_id::text || ':' ||
    least(p_buyer_id::text,v_seller_id::text) || ':' ||
    greatest(p_buyer_id::text,v_seller_id::text);

  select * into v_room from public.chat_rooms
  where context_key=v_context_key limit 1;

  if not found then
    insert into public.chat_rooms(product_id,created_by,room_type,context_key)
    values(p_product_id,p_buyer_id,'marketplace',v_context_key)
    returning * into v_room;

    insert into public.chat_participants(room_id,user_id)
    values(v_room.id,p_buyer_id),(v_room.id,v_seller_id)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'room_id',v_room.id,'product_id',p_product_id,
    'buyer_id',p_buyer_id,'seller_id',v_seller_id,
    'existing',v_room.created_by is distinct from p_buyer_id
  );
end;
$$;

create or replace function public.get_or_create_marketplace_chat(p_product_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $$
begin
  return private.get_or_create_marketplace_chat(p_product_id,(select auth.uid()));
end;
$$;

revoke execute on function public.get_or_create_marketplace_chat(uuid) from public,anon;
grant execute on function public.get_or_create_marketplace_chat(uuid) to authenticated;

create or replace function public.mark_chat_read(p_room_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path='public','private','pg_temp'
as $$
declare v_count integer;
begin
  update public.chat_participants
  set last_read_at=now()
  where room_id=p_room_id and user_id=(select auth.uid());

  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'Chat room not found' using errcode='P0002'; end if;

  return jsonb_build_object('room_id',p_room_id,'read_at',now());
end;
$$;

revoke execute on function public.mark_chat_read(uuid) from public,anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;
