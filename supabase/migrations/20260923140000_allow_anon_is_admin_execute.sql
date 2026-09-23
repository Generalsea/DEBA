-- Public product/catalog RLS policies call private.is_admin().
-- Anonymous visitors must be allowed to execute the security-definer helper;
-- the function itself only returns whether the current auth.uid() has an
-- admin/moderator role and therefore returns false for anonymous visitors.

grant execute on function private.is_admin() to anon;
