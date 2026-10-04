# DEBA Platform Clearance — 2026-10-04

## RC state

- Integration branch: `rc/phase4-5-integrated-20261004`
- Verification PR: #43 (Draft, base `main`)
- Main baseline: `75b26ae6ec72a5f69339f5e2145c2be651967b5e`
- RC head at this refreshed checkpoint: `7442895a8cc2311e35956c249b9a7c839b903bad`
- Main has not been merged or directly modified by this RC work.
- GitHub Actions on the verified code head were PASS (verify `37190735181`, quality `37190735186`). The subsequent evidence refresh commits were confirmed by Git diff to be documentation-only.

## Evidence gates

- Integrated GitHub CI: PASS
- Release preflight: PASS
- Typecheck: PASS
- Base contract tests: PASS
- Phase 4.1 notification contracts: PASS
- Phase 4.2 deal matching contracts: PASS
- Phase 4.3 future marketplace contracts: PASS
- Phase 4.4 true-vector contracts: PASS
- Phase 5.1 AI broker/vision contracts: PASS
- Playwright collection: PASS
- Production build: PASS

## Live Supabase state

Production schema does not contain the Phase 4/5 feature tables from the RC.
The `vector` extension is not installed in Production.

Supabase Security Advisor has one remaining WARN:
`auth_leaked_password_protection`.

Production PostgreSQL is 17.6.1.166.

## PostgreSQL 17.11 compatibility check

The live database is UTF-8 with ICU collation.
Read-only checks found:
- ltree extension: not installed; ltree index count = 0
- btree_gist float index count = 0
- user-defined functions using pgcrypto PGP encryption/decryption: none found
- operators with non-catalog selectivity estimators: 0

Therefore none of the documented 17.11 caveat classes were detected in this database.

Supabase still requires dashboard-side execution of the minor upgrade; do not treat this document as upgrade authorization.

## External clearance actions

1. Supabase Auth
   - Enable leaked-password protection in Auth password-security settings.
   - Re-run Security Advisor and retain a zero-WARN security result if that is the release policy.

2. Supabase PostgreSQL
   - Review the dashboard Upgrade Project action.
   - Upgrade from 17.6 to the currently available 17.11 minor.
   - Re-run advisors and smoke checks after the platform window.

3. Supabase vector
   - During the ordered database release, enable the `vector` extension.
   - Apply the Phase 4.4 migration only as part of the full 12-migration release chain.
   - Run real embedding ingestion before claiming semantic search is live.

4. Vercel
   - Grant the connected Vercel integration access to the DEBA project/team.
   - Verify Production deployment, domains, environment variables, Cron configuration, and server-only secrets.
   - Do not create a replacement project as a workaround.

5. Phase 5.1 providers
   - Configure real server-only broker and vision credentials/endpoints.
   - Exercise provider E2E in the target environment.
   - Do not claim provider E2E from contract tests alone.

## Production activation rule

No `supabase db push`, production migration activation, or Vercel promotion is authorized by this checklist.
The final activation sequence remains:

integrated RC
-> platform/auth clearance
-> exact 12-migration preflight
-> ordered production migration
-> live schema/advisor verification
-> provider E2E
-> Vercel deployment verification
-> evidence bundle
