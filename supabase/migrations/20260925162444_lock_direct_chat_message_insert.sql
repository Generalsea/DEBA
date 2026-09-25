-- Canonicalize chat message writes behind a database-enforced RPC.
-- Direct INSERT access is revoked from client roles so API-level rules cannot be bypassed.

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
  v_action text := v_metadata ->> 'action';
  v_offer_message_id uuid;
  v_lat numeric;
  v_lng numeric;
  v_accuracy numeric;
begin
  if v_uid is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (
    select 1
    from public.chat_participants participant
    where participant.room_id = p_room_id
      and participant.user_id = v_uid
  ) then
    raise exception 'You are not a participant in this chat room';
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

    v_metadata := jsonb_build_object(
      'kind', 'offer',
      'amount', v_amount,
      'currency', v_currency,
      'note', coalesce(nullif(v_note, ''), 'عرض سعر مرتبط بالمحادثة'),
      'title', 'عرض سعر من البائع'
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
        'lat', v_lat,
        'lng', v_lng,
        'accuracy', v_accuracy
      )
    );

  elsif p_message_type = 'system' and v_kind = 'offer_action' then
    if v_action not in ('accept', 'counter', 'decline') then
      raise exception 'Invalid offer action';
    end if;

    if nullif(v_metadata ->> 'offerMessageId', '') is not null then
      begin
        v_offer_message_id := (v_metadata ->> 'offerMessageId')::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid offer message id';
      end;

      if not exists (
        select 1
        from public.messages offer_message
        where offer_message.id = v_offer_message_id
          and offer_message.room_id = p_room_id
          and offer_message.message_type = 'offer'
      ) then
        raise exception 'Offer message not found';
      end if;
    end if;

    v_metadata := jsonb_build_object(
      'kind', 'offer_action',
      'action', v_action,
      'offerMessageId', v_offer_message_id
    );

  elsif p_message_type = 'system' and v_kind = 'file' then
    if v_storage_path !~ ('^chat/' || v_uid::text || '/' || p_room_id::text || '/')
       or not exists (
          select 1
          from storage.objects object_row
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

  insert into public.messages (
    room_id,
    sender_id,
    message_type,
    body,
    metadata
  )
  values (
    p_room_id,
    v_uid,
    p_message_type,
    p_body,
    v_metadata
  )
  returning * into v_message;

  update public.chat_rooms
  set updated_at = now()
  where id = p_room_id;

  return v_message;
end;
$function$;

create or replace function public.send_chat_message(
  p_room_id uuid,
  p_message_type text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.messages
language sql
security invoker
set search_path = ''
as $function$
  select * from private.send_chat_message(
    p_room_id,
    p_message_type,
    p_body,
    p_metadata
  );
$function$;

revoke execute on function public.send_chat_message(uuid, text, text, jsonb) from public, anon;
grant execute on function public.send_chat_message(uuid, text, text, jsonb) to authenticated;

revoke insert on public.messages from anon, authenticated;
