-- Protect seller verification review fields from owner-side mutation.
-- Sellers may submit/update their request payload, but administrative outcome
-- fields remain server-controlled.

drop policy if exists seller_verifications_owner_update on public.seller_verifications;

create policy seller_verifications_owner_update
on public.seller_verifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
)
with check (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create or replace function private.secure_seller_verification_write()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (select private.is_admin()) then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Changing verification ownership is not allowed';
  end if;

  if new.status is distinct from old.status
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.review_note is distinct from old.review_note
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Verification review fields are server controlled';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_secure_seller_verification_write
on public.seller_verifications;

create trigger trg_secure_seller_verification_write
before update on public.seller_verifications
for each row
execute function private.secure_seller_verification_write();
