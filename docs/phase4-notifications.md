# DEBA Phase 4 — Notification infrastructure

This branch adds the first Phase 4 growth layer without changing main.

## Event flow

1. Guarded writes change offers, orders, shipments, or reports.
2. PostgreSQL triggers create owner-scoped rows in public.notifications.
3. public.notifications is added to the supabase_realtime publication.
4. The client hook subscribes only to the authenticated user's notification rows.
5. A notification INSERT can enqueue an asynchronous pg_net request to the internal email route.
6. The Next.js route authenticates the webhook, reads the canonical notification and user email, checks preferences, then calls Resend.

## Activation after release

Store these two values in Supabase Vault:

- deba_notification_webhook_url = the HTTPS URL of /api/internal/notifications/email
- deba_notification_webhook_secret = a high-entropy random shared secret

Set the same shared secret in the server-only environment variable DEBA_NOTIFICATION_WEBHOOK_SECRET.
Also set RESEND_API_KEY and RESEND_FROM_EMAIL.
The Resend sender must be a verified sender/domain.

Do not place these values in NEXT_PUBLIC_* variables or source control.

## Verification

npm run typecheck

npm test

npm run test:phase4-notifications

The live database migration should be applied only after branch review and the email endpoint is deployed.