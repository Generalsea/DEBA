-- Keep the private chat implementation inaccessible to clients.
-- The public wrapper is SECURITY DEFINER and validates auth.uid() first.
create or replace function public.get_or_create_marketplace_chat(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  return private.get_or_create_marketplace_chat(
    p_product_id,
    (select auth.uid())
  );
end;
$$;

revoke execute on function private.get_or_create_marketplace_chat(uuid,uuid)
from authenticated;

grant execute on function public.get_or_create_marketplace_chat(uuid)
to authenticated;
