-- Security advisor cleanup: sensitive operational tables remain service-role only.
-- Policies document the intended admin-only access model while table grants stay revoked.

drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select
on public.audit_logs
for select to authenticated
using ((select private.is_admin()));

drop policy if exists payment_webhooks_admin_select on public.payment_webhooks;
create policy payment_webhooks_admin_select
on public.payment_webhooks
for select to authenticated
using ((select private.is_admin()));

revoke all on table public.audit_logs, public.payment_webhooks from anon, authenticated;
