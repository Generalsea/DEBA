# DEBA — Production Go-Live Readiness Gate

**Assessment date:** 2026-09-25  
**Repository:** `Generalsea/DEBA`  
**Release baseline:** `main` @ `a509d9b6ac34e8fe97e7f813499d0fbcfe5e692f`  
**Supabase project:** `gkwpjtbrecoesxyoybto`  
**Supabase status:** `ACTIVE_HEALTHY`  
**PostgreSQL:** `17.6.1.166`

## Executive decision

**GO-LIVE GATE: BLOCKED**

The Phase 2 application and database hardening is present on `main`, and the live database is healthy. The production launch gate is not yet a clean PASS because three externally observable conditions remain unresolved:

1. Supabase Auth leaked-password protection is still disabled.
2. Critical application rate limiting has coverage; the branch now hardens the shared application helper to fail closed on limiter errors, while public search still has no request-aware abuse limiter.
3. A production Vercel deployment/domain is not accessible through the current environment, so the complete deployed-path walkthrough cannot be independently attested.

No production business data was fabricated or mutated for this gate.

## 1. Security hardening

### 1.1 Supabase Auth — leaked password protection

**Status: PLATFORM_ACTION_REQUIRED**

Live Supabase Security Advisor reports exactly one warning:

- `auth_leaked_password_protection`
- **Leaked Password Protection Disabled**
- Severity: `WARN`
- Findings: `1`

Supabase documents this control as an Auth/password-security setting that rejects passwords known to have appeared in compromised-password datasets.

Remediation:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**Required platform action:** enable leaked-password protection in Supabase **Authentication → Settings / Password Security**. After enabling it, rerun Security Advisor; the expected result for this gate is zero Security Advisor WARN findings. Until then, this item remains `PLATFORM_ACTION_REQUIRED`, not PASS.

The current connected Supabase tooling does not expose an Auth-project-settings mutation operation, so this environmental setting was not changed programmatically during this run.

### 1.2 Database/API authorization

**Status: PASS**

Live privilege checks confirm:

- `anon` can execute `search_marketplace_products`.
- `anon` can execute `get_product_review_feed`.
- `anon` can execute `get_seller_review_feed`.
- `anon` cannot execute `create_review`.
- `anon` cannot execute `admin_update_report_status`.
- `anon` cannot execute `apply_chat_offer_action`.
- `authenticated` can execute `apply_chat_offer_action`.
- `anon` and `authenticated` cannot directly SELECT `public.reviews`.
- `anon` and `authenticated` cannot directly UPDATE `public.reports`.
- `public.api_rate_limits`, `public.reviews`, and `public.reports` have RLS enabled.

This preserves the transaction-bound review model and the protected moderation lifecycle.

### 1.3 Rate-limit storage and primitive

**Status: PARTIAL / RELEASE BLOCKER**

The live database contains the shared `api_rate_limits` table with RLS enabled and no direct read/write access for `anon` or `authenticated`.

The underlying limiter primitive is database-backed and behaves correctly: a transactional probe configured for **3 requests / 60 seconds** returned `false` on the fourth request, and the transaction was rolled back.

Current endpoint coverage:

| Surface | Current limit | Coverage | Gate |
|---|---:|---|---|
| Listing reports | 5 / hour / authenticated user | `src/app/api/reports/route.ts` | **REMEDIATION COMMITTED; merge + CI required** |
| Chat / offer mutations | 30 / minute / authenticated user | `src/app/api/chat/rooms/[id]/messages/route.ts` | **REMEDIATION COMMITTED; merge + CI required** |
| Public search RPC | none at application layer | `search_marketplace_products` | **BLOCKED** |

On `main`, the shared helper returned `allowed: true` when the rate-limit RPC itself errored. A fail-closed remediation was committed on the Phase 3 readiness branch; it must pass CI and merge before this control is considered closed.

The public search path also has no equivalent application-layer limiter. Supabase's documented `db_pre_request` write-counter pattern cannot directly rate-limit GET/HEAD requests; the search path therefore needs an explicit application/edge/WAF control if it is to carry a production abuse ceiling.

Supabase API security reference:
https://supabase.com/docs/guides/api/securing-your-api

## 2. Production performance baseline

**Status: PASS for database execution; HTTP/browser E2E not attested**

Measured against the live production Supabase database using **30 samples per function** and production data:

| RPC | Samples | Mean | p50 | p95 | Max |
|---|---:|---:|---:|---:|---:|
| `search_marketplace_products` | 30 | 6.678 ms | 3.490 ms | 7.614 ms | 86.933 ms |
| `get_product_review_feed` | 30 | 0.319 ms | 0.146 ms | 0.601 ms | 3.245 ms |

These are **database/function execution timings**, not end-to-end HTTP or browser timings.

Live production data at the gate:

- Published + approved products: 9
- Reviews: 0
- Reports: 0
- Rate-limit rows: 0

The benchmark used an existing published product and a real search query. No synthetic records were persisted.

## 3. Trust, privacy and moderation verification

**Status: PASS**

Verified live:

- Public review feeds are callable through safe RPC projections.
- Raw review-table SELECT is denied to public API roles.
- Transaction-bound review creation remains behind the authenticated RPC.
- Direct report UPDATE is denied to public API roles.
- Anonymous report moderation execution is denied.
- Moderation lifecycle remains database-enforced.
- The automatic report-threshold pause trigger exists.
- Search RPC is `SECURITY INVOKER`.
- Public review feed wrappers are `SECURITY INVOKER`; private helpers use pinned `search_path = ''` as SECURITY DEFINER where RLS bypass is intentional.

## 4. Application route walkthrough

**Status: BLOCKED — production endpoint unavailable in current environment**

Target flow:

`Homepage → Search → Product Details → Seller Store → DEBA Comms / Chat → Offers → Reports`

Repository inspection confirms the relevant application paths exist, including:

- Home/search experience.
- Product detail with reports and review feed.
- Seller store and public member profile surfaces.
- DEBA Comms/chat and offer action path.
- Report submission and moderation lifecycle.
- Authenticated Playwright coverage and production build scripts.

A complete **deployed** walkthrough could not be independently completed because no Vercel team/project is exposed to the current connected environment. The production deployment must set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS application origin and the value must match the URL used by Auth callbacks/redirects and production verification.

### POST-DEPLOYMENT VERIFICATION STEP

After the first production deployment, set the Vercel production environment variable:

`NEXT_PUBLIC_SITE_URL=https://<canonical-production-domain>`

Then redeploy if the deployment does not automatically pick up the environment change. Verify from the deployed app that the canonical origin is used consistently for production links and Auth callback/redirect configuration. Run the authenticated Playwright suite against that exact HTTPS origin using the dedicated non-production E2E account.

The following candidate Vercel URLs were also not resolvable through the connected deployment access:

- `https://deba.vercel.app`
- `https://deba-marketplace.vercel.app`
- `https://deba-marketplace-git-main-generalsea.vercel.app`

This is an environment/access limitation, not evidence that the application routes are broken.

## 5. CI / repository release evidence

**Status: PASS by prior PR evidence; current post-merge push status not independently exposed**

PR #17 was merged into `main` at:

`a509d9b6ac34e8fe97e7f813499d0fbcfe5e692f`

Prior PR validation recorded:

- Typecheck: PASS
- Contract tests: PASS
- Playwright collection: PASS
- Production build: PASS

The current connected GitHub status endpoint exposes no status entries for the merge commit itself, and its workflow-run lookup is limited to pull-request-triggered runs. Therefore this gate does not represent the absence of CI; it records that the current connector cannot independently restate a fresh post-merge workflow status.

## 6. Launch gate checklist

| Gate | Result |
|---|---|
| Phase 2 main release present | PASS |
| Supabase project healthy | PASS |
| RLS / public grants reviewed | PASS |
| Safe public review feeds | PASS |
| Transaction-bound reviews | PASS |
| Moderation lifecycle | PASS |
| Auto-pause trigger | PASS |
| DB performance baseline | PASS |
| Auth leaked-password protection | **PLATFORM_ACTION_REQUIRED** |
| Reports rate limiting fail-closed | **REMEDIATION IN BRANCH; CI PENDING** |
| Offer mutation rate limiting fail-closed | **REMEDIATION IN BRANCH; CI PENDING** |
| Public search abuse-rate control | **BLOCKER** |
| Deployed Vercel route walkthrough | **BLOCKED / environment access** |
| No fabricated production test data | PASS |

## 7. Required release actions

Before declaring the official public launch:

1. Enable Supabase leaked-password protection and rerun Security Advisor.
2. Change the shared rate-limit helper to fail closed on limiter errors.
3. Add an enforceable production abuse limit for public search (application/edge/WAF or an equivalent request-aware control).
4. Run the authenticated Playwright suite against the real deployed production/staging URL using a dedicated non-production test account.
5. Re-run the complete launch checklist and capture the resulting production URL and HTTP/browser timings.

## Final attestation

At **2026-09-25**, DEBA remains **not yet cleared for an official Go-Live announcement** under an evidence-first production gate. The fail-closed limiter remediation is committed on PR #18 but is not considered closed until CI returns Green and the change is merged to `main`.

The database trust/privacy controls and database performance baseline are healthy. The remaining blockers are explicit and actionable: one Supabase environment security setting, production-grade fail-closed rate limiting, a public-search abuse ceiling, and independent verification of the deployed application URL.

Supabase security guidance:
https://supabase.com/docs/guides/api/securing-your-api

Supabase password-security guidance:
https://supabase.com/docs/guides/auth/password-security
