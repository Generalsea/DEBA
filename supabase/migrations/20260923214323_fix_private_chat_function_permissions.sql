revoke execute on function private.get_or_create_marketplace_chat(uuid, uuid) from public;

grant usage on schema private to authenticated;
grant execute on function private.get_or_create_marketplace_chat(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
