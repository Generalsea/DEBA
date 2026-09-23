-- The wrapper validates auth.uid() == p_buyer_id before calling this security-definer function.
grant execute on function private.get_or_create_marketplace_chat(uuid,uuid)
to authenticated;
