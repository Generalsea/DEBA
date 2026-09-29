-- Allow the server-only public-search boundary to consume the shared limiter.
-- Runtime access is restricted to service_role; anon/public access remains denied.

grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
revoke execute on function public.consume_api_rate_limit(text, integer, integer) from public, anon;
