# DEBA Release & Database Baseline

## Repository source of truth

- Application source: Generalsea/DEBA main.
- Supabase project: DEBA (gkwpjtbrecoesxyoybto).
- Database changes must be introduced through a new migration under supabase/migrations/.
- Existing migration filenames are historical artifacts and must not be renamed or rewritten after deployment.
- The live Supabase migration ledger may contain versions/names created before the current repository migration filenames were normalized; those historical entries are evidence of deployment history, not files to rename retroactively.

## Current release baseline

The current main contains the seller contract, structured media integrity, multi-seller cart checkout/order lifecycle, public RPC hardening, and anonymous catalog access fix.

The release process requires:

1. npm ci from the committed package-lock.json.
2. npm run typecheck.
3. npm run build.
4. Database migrations applied through the Supabase migration workflow.
5. Security/performance advisors reviewed before production releases.

## Database parity rule

A migration may be applied directly to the live Supabase project for an urgent, user-approved fix, but the identical SQL must also be committed to this repository as a new migration file immediately.

Do not use supabase db reset against production data.

## Environment rule

Never commit .env.local, service-role keys, payment secrets, webhook secrets, or other privileged credentials.

## Test strategy

The repository should grow from static contract checks to authenticated integration tests covering:

Seller → Draft → Media → Submit → Moderation → Publish → Catalog → Cart → Checkout → Order → Payment → Fulfillment.
