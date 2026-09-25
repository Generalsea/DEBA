-- Prevent clients from adding themselves to arbitrary chat rooms.
-- Marketplace room membership is created only by the protected chat RPC.

drop policy if exists "chat_participants_insert_self" on public.chat_participants;
revoke insert on public.chat_participants from anon, authenticated;
