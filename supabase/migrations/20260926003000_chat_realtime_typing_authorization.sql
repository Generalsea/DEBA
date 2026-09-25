-- DEBA Realtime typing authorization
--
-- Typing indicators are transient Broadcast events on a private room channel.
-- Access is limited to authenticated members of the corresponding chat room.

drop policy if exists "deba chat participants can receive broadcast" on realtime.messages;

create policy "deba chat participants can receive broadcast"
on realtime.messages
for select
to authenticated
using (
  extension = 'broadcast'
  and case
    when realtime.topic() ~ '^deba-chat:[0-9a-fA-F-]{36}$'
      then private.is_chat_participant(substring(realtime.topic() from 11)::uuid)
    else false
  end
);

drop policy if exists "deba chat participants can send broadcast" on realtime.messages;

create policy "deba chat participants can send broadcast"
on realtime.messages
for insert
to authenticated
with check (
  extension = 'broadcast'
  and case
    when realtime.topic() ~ '^deba-chat:[0-9a-fA-F-]{36}$'
      then private.is_chat_participant(substring(realtime.topic() from 11)::uuid)
    else false
  end
);
