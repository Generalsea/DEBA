-- DEBA account onboarding
-- account_type is a user preference/capability marker, not an authorization claim.

alter table public.profiles
  add column if not exists account_type text;

update public.profiles
set account_type = coalesce(account_type, 'buyer')
where account_type is null;

alter table public.profiles
  alter column account_type set default 'buyer';

alter table public.profiles
  alter column account_type set not null;

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('buyer', 'seller'));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_display_name text;
    v_avatar_url text;
    v_account_type text;
begin
    v_display_name := coalesce(
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'name',
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'DEBA User'
    );

    v_avatar_url := coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
    );

    v_account_type := case
        when new.raw_user_meta_data ->> 'account_type' = 'seller' then 'seller'
        else 'buyer'
    end;

    insert into public.profiles (id, display_name, avatar_url, account_type)
    values (new.id, v_display_name, v_avatar_url, v_account_type)
    on conflict (id) do update
      set display_name = coalesce(public.profiles.display_name, excluded.display_name),
          avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
          account_type = coalesce(public.profiles.account_type, excluded.account_type);

    insert into public.profile_private (user_id, phone)
    values (new.id, new.phone)
    on conflict (user_id) do nothing;

    return new;
end;
$function$;

update public.profiles
set account_type = 'seller',
    updated_at = now()
where id = '9552d26a-2ce4-459a-b45e-c1b0c06f17b6';
