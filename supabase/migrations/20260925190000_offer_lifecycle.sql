-- DEBA offer lifecycle: bind offers to chat messages and enforce atomic transitions.
-- Existing offers are preserved; client-side direct writes are revoked so lifecycle changes
-- can only pass through the authenticated RPC below.

alter table public.offers
  add column if not exists room_id uuid references public.chat_rooms(id) on delete cascade,
  add column if not exists message_id uuid references public.messages(id) on delete cascade,
  add column if not exists seller_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists responded_at timestamptz null,
  add column if not exists last_action_by uuid references auth.users(id) on delete set null;

create unique index if not exists offers_message_id_uidx
  on public.offers(message_id)
  where message_id is not null;

create index if not exists offers_room_status_idx
  on public.offers(room_id, status, created_at desc);

create index if not exists offers_room_message_idx
  on public.offers(room_id, message_id);

create or replace function private.send_chat_message(
  p_room_id uuid,
  p_message_type text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_message public.messages;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_kind text := v_metadata ->> 'kind';
  v_storage_path text := v_metadata ->> 'storagePath';
  v_amount numeric;
  v_currency text := coalesce(v_metadata ->> 'currency', 'EGP');
  v_note text := coalesce(btrim(v_metadata ->> 'note'), '');
  v_parent_offer_message_id uuid;
  v_parent_offer public.offers;
  v_product public.products%rowtype;
  v_seller_id uuid;
  v_buyer_id uuid;
  v_offer public.offers;
  v_lat numeric;
  v_lng numeric;
  v_accuracy numeric;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.chat_participants participant
    where participant.room_id = p_room_id
      and participant.user_id = v_uid
  ) then
    raise exception 'You are not a participant in this chat room' using errcode = '42501';
  end if;

  if p_message_type not in ('text', 'image', 'offer', 'system') then
    raise exception 'Unsupported message type';
  end if;

  if p_message_type in ('text', 'offer')
     and char_length(coalesce(p_body, '')) > 4000 then
    raise exception 'Message body is too long';
  end if;

  if p_message_type = 'text' then
    if char_length(btrim(coalesce(p_body, ''))) = 0 then
      raise exception 'Message body is required';
    end if;

    v_metadata := jsonb_build_object(
      'kind', 'text',
      'risk_flags',
        to_jsonb(array_remove(array[
          case when coalesce(p_body, '') ~ '(?:01|\+?20)[0-9][0-9\s-]{8,}' then 'phone' end,
          case when coalesce(p_body, '') ~ '[[:alnum:]._%+-]+@[[:alnum:]-]+\.[[:alpha:].-]+' then 'email' end,
          case when coalesce(p_body, '') ~* 'https?://' then 'url' end
        ]::text[], null))
    );

  elsif p_message_type = 'image' then
    if v_kind <> 'image'
       or v_storage_path !~ ('^chat/' || v_uid::text || '/' || p_room_id::text || '/')
       or not exists (
          select 1
          from storage.objects object_row
          where object_row.bucket_id = 'deba-chat-media'
            and object_row.name = v_storage_path
       ) then
      raise exception 'Invalid chat image storage reference';
    end if;

    v_metadata := jsonb_build_object(
      'kind', 'image',
      'storagePath', v_storage_path,
      'fileName', left(coalesce(v_metadata ->> 'fileName', ''), 255),
      'mimeType', coalesce(v_metadata ->> 'mimeType', ''),
      'size', greatest(0, coalesce((v_metadata ->> 'size')::numeric, 0))
    );

  elsif p_message_type = 'offer' then
    if v_metadata ->> 'amount' !~ '^[0-9]+(?:\.[0-9]+)?$' then
      raise exception 'Invalid offer amount';
    end if;

    v_amount := (v_metadata ->> 'amount')::numeric;

    if v_amount <= 0 or v_amount > 1000000000 then
      raise exception 'Invalid offer amount';
    end if;

    if v_currency !~ '^[A-Z]{3}$' then
      raise exception 'Invalid offer currency';
    end if;

    if char_length(v_note) > 1000 then
      raise exception 'Offer note is too long';
    end if;

    select p.*
      into v_product
    from public.chat_rooms room
    join public.products p on p.id = room.product_id
    where room.id = p_room_id
      and p.status = 'published'
      and p.moderation_status = 'approved'
      and p.listing_type = 'sale'
      and p.owner_id is not null
    for share of p;

    if not found then
      raise exception 'Product is not available for offers' using errcode = 'P0002';
    end if;

    v_seller_id := v_product.owner_id;

    if nullif(v_metadata ->> 'parentOfferMessageId', '') is not null then
      begin
        v_parent_offer_message_id := (v_metadata ->> 'parentOfferMessageId')::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid parent offer message id';
      end;

      select offer.*
        into v_parent_offer
      from public.offers offer
      where offer.message_id = v_parent_offer_message_id
        and offer.room_id = p_room_id
        and offer.product_id = v_product.id
      for update;

      if not found then
        raise exception 'Parent offer not found' using errcode = 'P0002';
      end if;

      if v_parent_offer.status <> 'pending' then
        raise exception 'Only pending offers can be countered';
      end if;

      if v_parent_offer.expires_at is not null and v_parent_offer.expires_at <= now() then
        update public.offers
        set status = 'expired', updated_at = now()
        where id = v_parent_offer.id;
        raise exception 'Offer has expired';
      end if;

      if v_uid = v_parent_offer.created_by then
        raise exception 'The counter offer must be created by the other party' using errcode = '42501';
      end if;

      if v_uid <> v_seller_id and v_uid <> v_parent_offer.buyer_id then
        raise exception 'You are not a party to this offer' using errcode = '42501';
      end if;

      update public.offers
      set status = 'countered',
          responded_at = now(),
          last_action_by = v_uid,
          updated_at = now()
      where id = v_parent_offer.id;

      v_buyer_id := v_parent_offer.buyer_id;
    else
      if v_uid = v_seller_id then
        raise exception 'Initial offer must be created by the buyer' using errcode = '42501';
      end if;
      v_buyer_id := v_uid;
    end if;

    if v_buyer_id = v_seller_id then
      raise exception 'Invalid buyer/seller pair' using errcode = '42501';
    end if;

    v_metadata := jsonb_build_object(
      'kind', 'offer',
      'amount', v_amount,
      'currency', v_currency,
      'note', coalesce(nullif(v_note, ''), 'عرض سعر مرتبط بالمحادثة'),
      'title', case when v_parent_offer.id is null then 'عرض سعر' else 'عرض سعر مقابل' end,
      'parentOfferMessageId', v_parent_offer_message_id
    );

  elsif p_message_type = 'system' and v_kind = 'location' then
    if not (v_metadata ? 'location') then
      raise exception 'Location data is required';
    end if;

    if (v_metadata -> 'location' ->> 'lat') !~ '^-?[0-9]+(?:\.[0-9]+)?$'
       or (v_metadata -> 'location' ->> 'lng') !~ '^-?[0-9]+(?:\.[0-9]+)?$'
       or (v_metadata -> 'location' ->> 'accuracy') !~ '^[0-9]+(?:\.[0-9]+)?$' then
      raise exception 'Invalid location';
    end if;

    v_lat := (v_metadata -> 'location' ->> 'lat')::numeric;
    v_lng := (v_metadata -> 'location' ->> 'lng')::numeric;
    v_accuracy := (v_metadata -> 'location' ->> 'accuracy')::numeric;

    if v_lat < -90 or v_lat > 90 or v_lng < -180 or v_lng > 180
       or v_accuracy < 0 or v_accuracy > 100000 then
      raise exception 'Invalid location';
    end if;

    v_metadata := jsonb_build_object(
      'kind', 'location',
      'location', jsonb_build_object(
        'lat', v_lat, 'lng', v_lng, 'accuracy', v_accuracy
      )
    );

  elsif p_message_type = 'system' and v_kind = 'offer_action' then
    raise exception 'Offer actions must use the offer lifecycle RPC' using errcode = '42501';

  elsif p_message_type = 'system' and v_kind = 'file' then
    if v_storage_path !~ ('^chat/' || v_uid::text || '/' || p_room_id::text || '/')
       or not exists (
          select 1 from storage.objects object_row
          where object_row.bucket_id = 'deba-chat-media'
            and object_row.name = v_storage_path
       ) then
      raise exception 'Invalid chat file storage reference';
    end if;

    v_metadata := jsonb_build_object(
      'kind', 'file',
      'storagePath', v_storage_path,
      'fileName', left(coalesce(v_metadata ->> 'fileName', ''), 255),
      'mimeType', coalesce(v_metadata ->> 'mimeType', ''),
      'size', greatest(0, coalesce((v_metadata ->> 'size')::numeric, 0))
    );

  else
    raise exception 'Unsupported system message';
  end if;

  insert into public.messages (room_id, sender_id, message_type, body, metadata)
  values (p_room_id, v_uid, p_message_type, p_body, v_metadata)
  returning * into v_message;

  if p_message_type = 'offer' then
    insert into public.offers (
      product_id, buyer_id, parent_offer_id, amount, currency, status,
      expires_at, message, room_id, message_id, seller_id, created_by, updated_at
    )
    values (
      v_product.id, v_buyer_id, v_parent_offer.id, v_amount, v_currency, 'pending',
      null, nullif(v_note, ''), p_room_id, v_message.id, v_seller_id, v_uid, now()
    )
    returning * into v_offer;

    update public.messages
    set metadata = v_metadata || jsonb_build_object('offerId', v_offer.id)
    where id = v_message.id
    returning * into v_message;
  end if;

  update public.chat_rooms set updated_at = now() where id = p_room_id;

  return v_message;
end;
$function$;

create or replace function private.apply_chat_offer_action(
  p_room_id uuid,
  p_offer_message_id uuid,
  p_action text,
  p_amount numeric default null,
  p_note text default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_offer public.offers;
  v_product public.products%rowtype;
  v_seller_id uuid;
  v_new_offer public.offers;
  v_message public.messages;
  v_note text := coalesce(btrim(p_note), '');
  v_currency text;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.chat_participants
    where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'You are not a participant in this chat room' using errcode = '42501';
  end if;

  if p_action not in ('accept', 'counter', 'decline') then
    raise exception 'Invalid offer action';
  end if;

  if p_offer_message_id is null then
    raise exception 'Offer message is required';
  end if;

  select p.*
    into v_product
  from public.chat_rooms room
  join public.products p on p.id = room.product_id
  where room.id = p_room_id
    and p.owner_id is not null
  for share of p;

  if not found then
    raise exception 'Offer room is not linked to a product' using errcode = 'P0002';
  end if;

  v_seller_id := v_product.owner_id;

  select offer.*
    into v_offer
  from public.offers offer
  where offer.message_id = p_offer_message_id
    and offer.room_id = p_room_id
    and offer.product_id = v_product.id
  for update;

  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;

  if v_offer.status <> 'pending' then
    raise exception 'Only pending offers can be acted on';
  end if;

  if v_offer.expires_at is not null and v_offer.expires_at <= now() then
    update public.offers
    set status = 'expired', updated_at = now()
    where id = v_offer.id;
    raise exception 'Offer has expired';
  end if;

  if v_uid <> v_seller_id and v_uid <> v_offer.buyer_id then
    raise exception 'You are not a party to this offer' using errcode = '42501';
  end if;

  if p_action in ('accept', 'decline') then
    if v_uid = v_offer.created_by then
      raise exception 'The offer creator cannot accept or decline their own offer' using errcode = '42501';
    end if;

    update public.offers
    set status = case when p_action = 'accept' then 'accepted' else 'rejected' end,
        responded_at = now(),
        last_action_by = v_uid,
        updated_at = now()
    where id = v_offer.id;

    if p_action = 'accept' then
      update public.offers
      set status = 'rejected',
          responded_at = now(),
          last_action_by = v_uid,
          updated_at = now()
      where room_id = p_room_id
        and product_id = v_product.id
        and status = 'pending'
        and id <> v_offer.id;
    end if;

    insert into public.messages (room_id, sender_id, message_type, body, metadata)
    values (
      p_room_id,
      v_uid,
      'system',
      case when p_action = 'accept' then '✅ تم قبول عرض السعر' else '❌ تم رفض عرض السعر' end,
      jsonb_build_object(
        'kind', 'offer_action',
        'action', p_action,
        'offerMessageId', p_offer_message_id,
        'offerId', v_offer.id
      )
    )
    returning * into v_message;

  else
    if v_uid = v_offer.created_by then
      raise exception 'The counter offer must be created by the other party' using errcode = '42501';
    end if;

    if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then
      raise exception 'Invalid counter offer amount';
    end if;

    if char_length(v_note) > 1000 then
      raise exception 'Offer note is too long';
    end if;

    v_currency := coalesce(v_offer.currency, v_product.currency, 'EGP');

    update public.offers
    set status = 'countered',
        responded_at = now(),
        last_action_by = v_uid,
        updated_at = now()
    where id = v_offer.id;

    insert into public.messages (room_id, sender_id, message_type, body, metadata)
    values (
      p_room_id,
      v_uid,
      'offer',
      coalesce(nullif(v_note, ''), 'عرض مقابل بقيمة جديدة'),
      jsonb_build_object(
        'kind', 'offer',
        'amount', p_amount,
        'currency', v_currency,
        'note', coalesce(nullif(v_note, ''), 'عرض مقابل بقيمة جديدة'),
        'title', 'عرض سعر مقابل',
        'parentOfferMessageId', p_offer_message_id
      )
    )
    returning * into v_message;

    insert into public.offers (
      product_id, buyer_id, parent_offer_id, amount, currency, status,
      expires_at, message, room_id, message_id, seller_id, created_by, updated_at
    )
    values (
      v_product.id, v_offer.buyer_id, v_offer.id, p_amount, v_currency, 'pending',
      null, nullif(v_note, ''), p_room_id, v_message.id, v_seller_id, v_uid, now()
    )
    returning * into v_new_offer;

    update public.messages
    set metadata = metadata || jsonb_build_object('offerId', v_new_offer.id)
    where id = v_message.id
    returning * into v_message;
  end if;

  update public.chat_rooms set updated_at = now() where id = p_room_id;

  return v_message;
end;
$function$;

create or replace function public.apply_chat_offer_action(
  p_room_id uuid,
  p_offer_message_id uuid,
  p_action text,
  p_amount numeric default null,
  p_note text default null
)
returns public.messages
language sql
security invoker
set search_path = ''
as $function$
  select * from private.apply_chat_offer_action(
    p_room_id, p_offer_message_id, p_action, p_amount, p_note
  );
$function$;

revoke insert, update, delete on public.offers from anon, authenticated;
revoke execute on function public.apply_chat_offer_action(uuid, uuid, text, numeric, text) from public, anon;
grant execute on function public.apply_chat_offer_action(uuid, uuid, text, numeric, text) to authenticated;
