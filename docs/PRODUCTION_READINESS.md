# DEBA Production Readiness Register

## Current release candidate

- Integrated RC: `rc/phase4-5-integrated-20261004`
- Verification PR: #43 (Draft / Open / Mergeable)
- Current RC head: `bf117a6ab203f86789cbcad4125a1bc906683de1`
- Protected `main`: `75b26ae6ec72a5f69339f5e2145c2be651967b5e`
- Exact-head GitHub CI: verify PASS; quality PASS

## Current security / platform state

### Supabase Auth — leaked password protection

**Status: EXTERNAL ACTION REQUIRED**

Live Supabase Security Advisor reports exactly one WARN:

`auth_leaked_password_protection`

The setting is controlled by the Supabase Auth/project environment and is not exposed as a mutation through the currently connected Supabase tool surface.

Required action:
- Enable leaked-password protection in Supabase Auth password-security settings.
- Re-run Security Advisor.
- Expected release result: zero remaining Security Advisor WARN findings.

This is not waived as a PASS.

### Public search abuse protection

**Status: PASS — repository implementation verified**

The current RC protects public search requests at `proxy.ts` using `src/utils/publicSearchRateLimit.ts`.

Properties verified in the dedicated contract/integration test:
- GET/HEAD requests to the public search surface are intercepted.
- Client IP is obtained from platform forwarding headers.
- The rate-limit key is HMAC-SHA256 hashed with a server-only secret.
- The limiter uses `consume_api_rate_limit` through the server-only Supabase admin client.
- Production configuration failures fail closed with HTTP 503.
- Exceeded limits return HTTP 429.
- Default limit is 60 requests per 60 seconds per hashed client IP.
- The public `anon` role is denied direct execution of `consume_api_rate_limit`; service-role execution remains available.

This closes the previously identified public-search abuse-control blocker at the repository/runtime boundary. Target production verification still depends on the real deployment having `SUPABASE_SERVICE_ROLE_KEY` configured server-side.

### RLS / database authorization

**Status: PASS — live read-only verification**

All current `public` base tables were found with RLS enabled.

Read privileges for `anon` remain absent from sensitive objects including:
- `orders`
- `payment_attempts`
- `payments`
- `reviews`
- `notification_preferences`
- `notifications`
- `reports`
- `audit_logs`
- `api_rate_limits`

The live database also confirms `anon` cannot execute `consume_api_rate_limit`, while `authenticated` and `service_role` can.

### Database release state

**Status: NOT ACTIVATED**

The live migration ledger contains no Phase 4.1–5.1 release migrations from the current 12-migration chain.

The production database remains:
- PostgreSQL `17.6.1.166`
- `vector` extension not installed
- no intentional Phase 4.3 / 4.4 / 5.1 schema persisted by the RC verification work

## Environment / deployment

### Vercel

**Status: EXTERNAL ACCESS BLOCKER**

The connected Vercel account currently exposes:
- teams: 0
- projects matching DEBA: 0

Therefore production deployment, domains, environment variables, Cron, and server-only provider configuration cannot be independently certified from this session.

No replacement Vercel project is to be created as a workaround.

### AI provider E2E

**Status: NOT VERIFIED — dependent on Vercel/target environment**

Repository contracts for broker/vision are green. Real provider E2E requires real server-only credentials/endpoints in the target environment and is not claimed from contract tests alone.

## Evidence policy

A readiness item is PASS only with direct repository or live-environment evidence.

External configuration limitations are recorded as EXTERNAL ACTION REQUIRED / EXTERNAL ACCESS BLOCKER, not converted into PASS or waived silently.

## Current activation sequence

```
platform/auth clearance
  →
exact integrated RC verification
  →
12-migration preflight
  →
ordered production migration
  →
live schema + Advisor verification
  →
vector activation + real embedding ingestion
  →
AI provider E2E
  →
Vercel production verification
  →
Go-Live evidence
```

Production activation remains fail-closed until the external platform gates are cleared.
