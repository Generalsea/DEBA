-- Database-backed rate limiting for authenticated mutation endpoints.
-- Kept separate from business tables so it can scale across serverless instances.

create table if not exists public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

revoke all on public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

create index if not exists api_rate_limits_updated_at_idx
  on public.api_rate_limits(updated_at);

create or replace function private.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started timestamptz;
  v_count integer;
begin
  if p_rate_key is null or btrim(p_rate_key) = '' then
    raise exception 'Rate-limit key is required';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception 'Invalid rate-limit limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;

  insert into public.api_rate_limits(rate_key, window_started_at, request_count, updated_at)
  values (p_rate_key, v_now, 1, v_now)
  on conflict (rate_key) do update
  set
    window_started_at = case
      when public.api_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning window_started_at, request_count
  into v_window_started, v_count;

  return v_count <= p_limit;
end;
$function$;

create or replace function public.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.consume_api_rate_limit(
    p_rate_key,
    p_limit,
    p_window_seconds
  );
$function$;

revoke execute on function public.consume_api_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to authenticated;
