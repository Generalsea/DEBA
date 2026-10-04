# DEBA — Production Go-Live Readiness Gate

**Assessment refresh:** 2026-10-04
**Repository:** `Generalsea/DEBA`
**Integrated RC:** `rc/phase4-5-integrated-20261004`
**Verification PR:** #43
**Protected main baseline:** `75b26ae6ec72a5f69339f5e2145c2be651967b5e`
**Current RC head:** `19a0eb7f6c14660724f444595202e7573f0938ff`
**Supabase project:** `gkwpjtbrecoesxyoybto`

## Executive decision

**RELEASE CANDIDATE — VERIFIED / PRODUCTION ACTIVATION NOT YET CLEARED**

The integrated RC has green exact-head CI and a passing 12-migration release preflight. Main remains isolated.

Production activation is still blocked by external platform gates:
1. Supabase Auth leaked-password protection.
2. Vercel team/project access and production environment verification.
3. Real Phase 5.1 provider configuration and E2E.
4. The Supabase PostgreSQL minor upgrade is still a dashboard-side platform operation.

These are environment gates, not unresolved repository defects.

## 1. Repository / CI

Exact RC head was verified through GitHub Actions:

- `verify` → PASS
- `quality` → PASS
- Typecheck → PASS
- Contract tests → PASS
- Phase 4.1 → PASS
- Phase 4.2 → PASS
- Phase 4.3 → PASS
- Phase 4.4 → PASS
- Phase 5.1 → PASS
- Playwright collection → PASS
- Release migration preflight → PASS
- Production build → PASS

## 2. Supabase security and authorization

### Auth leaked-password protection

**Status: EXTERNAL ACTION REQUIRED**

Live Security Advisor has one WARN:
`auth_leaked_password_protection`.

Required platform action:
- Enable leaked-password protection in Auth password-security settings.
- Re-run Security Advisor.
- Release target: zero remaining Security Advisor WARN findings.

### RLS

**Status: PASS**

Every current base table in the `public` schema was verified with RLS enabled.

Sensitive tables such as `reviews`, `reports`, `orders`, `payments`, `notifications`, `audit_logs`, and `api_rate_limits` are not directly readable by `anon`.

The live privilege check also confirms:
- `anon` cannot execute `consume_api_rate_limit`.
- `authenticated` and `service_role` can execute the limiter wrapper.

## 3. Public-search abuse control

**Status: PASS — implementation verified**

The current RC enforces the public-search ceiling at the request boundary through `proxy.ts` and `src/utils/publicSearchRateLimit.ts`.

Control:
- GET/HEAD search requests on `/`.
- HMAC-SHA256 client-IP key using a server-only secret.
- 60 requests per 60 seconds per hashed IP.
- Missing production secret → HTTP 503, fail closed.
- Limiter backend error → HTTP 503, fail closed.
- Exceeded window → HTTP 429.

The dedicated `tests/public-search-rate-limit.test.mjs` covers the wiring and the underlying limiter primitive.

## 4. Live database release state

**Status: NOT ACTIVATED**

Production PostgreSQL is `17.6.1.166`.

The production migration ledger does not contain the current Phase 4.1 → 5.1 release set.

`vector` is not installed in Production.

No Phase 4.3 / 4.4 / 5.1 production schema has been persisted by the RC verification work.

## 5. PostgreSQL platform compatibility

**Status: CLEAR FOR DASHBOARD UPGRADE**

Read-only checks found no instances of the examined PostgreSQL 17.11 caveat classes:
- no ltree indexes because ltree is not installed;
- no btree_gist float indexes;
- no user-defined PGP encrypt/decrypt functions;
- no problematic custom operators with non-catalog selectivity estimators.

The platform upgrade itself remains a Supabase Dashboard operation.

## 6. Vercel production

**Status: EXTERNAL ACCESS BLOCKER**

The connected Vercel account currently exposes:
- 0 teams
- 0 DEBA projects

Therefore this session cannot certify:
- Production deployment;
- canonical domain;
- `NEXT_PUBLIC_SITE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `CRON_SECRET`;
- embedding provider credentials;
- broker / vision credentials;
- Cron;
- deployed browser walkthrough.

No replacement project is to be created as a workaround.

## 7. AI / vector production

**Phase 4.4:** repository contracts PASS; production vector remains unactivated and no real embedding corpus is claimed.

**Phase 5.1:** broker/vision code and contract tests PASS; real provider E2E is not claimed until server-only credentials/endpoints exist in the target environment.

## 8. Activation sequence

```
External Auth / platform clearance
  →
exact integrated RC verification
  →
12-migration preflight
  →
ordered production migration
  →
live schema + Security Advisor verification
  →
vector activation
  →
real embedding ingestion
  →
AI provider E2E
  →
Vercel production verification
  →
critical-path deployed walkthrough
  →
Go-Live evidence
```

## 9. Final gate state

| Gate | State |
|---|---|
| Integrated RC | PASS |
| Exact-head CI | PASS |
| 12-migration preflight | PASS |
| RLS / grants | PASS |
| Public-search abuse control | PASS |
| PostgreSQL compatibility checks | PASS |
| Supabase Auth | EXTERNAL ACTION REQUIRED |
| PostgreSQL dashboard upgrade | EXTERNAL PLATFORM ACTION |
| Vector production activation | WAITING |
| Vercel access | EXTERNAL ACCESS BLOCKER |
| AI provider E2E | NOT VERIFIED |

**Production activation remains fail-closed.**

The RC itself is not the blocker. The remaining blockers are platform/environment actions that cannot be honestly executed through the currently connected external tool surfaces.
