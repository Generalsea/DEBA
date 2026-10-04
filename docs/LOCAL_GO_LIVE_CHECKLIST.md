# DEBA — Local Go-Live Verification Checklist

## Scope

This is the local-first execution gate for DEBA. Vercel Production remains an external deployment checklist and does not block safe development or local verification.

## Current verified baseline

- Protected main: 75b26ae6ec72a5f69339f5e2145c2be651967b5e
- Verified application/code head: bf117a6ab203f86789cbcad4125a1bc906683de1
- Integrated RC: rc/phase4-5-integrated-20261004
- Current live PostgreSQL: 17.6.1.166
- Live vector extension: not installed
- Live Security Advisor: one external Auth warning remains

## 1. Environment

Run:

    npm ci
    npm run local:preflight
    npm run typecheck
    npm run build
    npm run e2e:list

Strict local environment check:

    npm run local:preflight -- --strict

PASS:
- no FAIL rows;
- strict mode has no missing required local baseline variables;
- secret values never appear in command output.

## 2. Database

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Supabase connectivity | Real database reachable | Real catalog query succeeds |
| Release preflight | Exactly 12 ordered release migrations | PASS |
| Production safety | Local work does not mutate production accidentally | No unintended production rows/schema |
| RLS | Sensitive data protected | Unauthorized access denied |
| Limiter probe | true,true,true,false inside rollback | Zero persisted test row |
| Vector | Only active when intentionally released | No semantic-search claim before activation |

## 3. Auth / authorization

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Anonymous browse | Public market loads | PASS |
| Login | Valid test user authenticates | Session established |
| Protected API without session | Rejected | 401/403 |
| IDOR attempt | Other user's private data denied | PASS |
| Logout/stale session | Protected request denied | PASS |

Owner action remains:
Supabase Auth → Password Security → Enable leaked-password protection → rerun Security Advisor.

## 4. Frontend

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Homepage | Real catalog data | No mock production data |
| Search results | Correct data and count | PASS |
| Product details | Real listing + seller + actions | PASS |
| Empty search | Useful recovery action | PASS |
| Error state | Safe user-facing error | No secret/stack leakage |
| Mobile width | Core actions usable | No blocking overflow |

## 5. Search / discovery

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Arabic lexical search | Relevant results | Correct first page |
| English lexical search | Relevant results | Correct first page |
| Arabic variants | Normalization works | Expected matches |
| Filters | Constraints applied | Correct result set |
| Pagination | Stable navigation | No duplicates/skips |
| Public abuse limit | Excess requests rejected | HTTP 429 |
| Limiter backend failure | Request denied safely | HTTP 503 |
| Hybrid endpoint | Authenticated behavior | Correct auth + response |
| Semantic search | Only after vector + ingestion | Real semantic evidence |

## 6. Listing creation / media

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Create draft | Persists to owner | PASS |
| Invalid fields | Rejected safely | No invalid partial record |
| Media upload | Supported type/size accepted | Linked correctly |
| Unsupported media | Rejected | Safe 4xx |
| Ownership | Non-owner denied | PASS |
| Publish | Seller/moderation rules enforced | Only approved listing public |

## 7. Buyer critical path

    DISCOVER
    → SEARCH
    → FILTER
    → VIEW
    → SAVE
    → CONTACT
    → MESSAGE
    → NEGOTIATE

PASS requires real authenticated data and persistence.

## 8. Seller critical path

    CREATE LISTING
    → IMPROVE
    → PRICE
    → PUBLISH
    → RECEIVE LEAD
    → RESPOND
    → CLOSE

PASS requires real persistence, authorization and usable failure states.

## 9. Favorites / messaging / reporting

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Favorite / unfavorite | Persists after reload | PASS |
| Open chat | Authorized room only | PASS |
| Send text | Persists in room | PASS |
| Send offer | Offer lifecycle respected | PASS |
| Chat rate limit | Excess requests rejected | 429 |
| Create report | Valid report persists | 201 |
| Duplicate report | Safe conflict | 409 |
| Self-report | Rejected | 400 |

## 10. Notifications

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Read own preferences | Own rows only | PASS |
| Update preference | Allowed keys only | PASS |
| Unauthorized update | Denied | 401/403 |
| Notification creation | Correct recipient | No cross-user leak |
| Provider failure | No false success | Retry/failure path |

Real email delivery is not claimed until a real provider is configured.

## 11. Trust / moderation

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Public review feed | Public-safe projection | Private fields hidden |
| Review creation | Authenticated/policy-bound | Unauthorized denied |
| Report moderation | Admin-only mutation | Non-admin denied |
| Auto-pause | Threshold enforced | Correct state |
| Seller verification | Correct owner/admin boundary | No privilege escalation |
| Malicious URL/content | Rejected/sanitized | No script execution |

## 12. Coins / Boosts / monetization

The RC already contains:
- coin balance and transaction ledger;
- idempotent coin rewards;
- private boost catalog;
- atomic coin deduction;
- active boost uniqueness;
- smart seller floor;
- auto-counter path;
- trade handshake controls.

### Business-flow verification

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| First listing reward | Award exactly once | Idempotent |
| Repeated reward event | No second award | Balance unchanged |
| Boost with sufficient balance | Deduction + entitlement atomic | PASS |
| Insufficient balance | Safe rejection | No negative balance |
| Duplicate active boost | Safe rejection | No duplicate entitlement |
| Concurrent spend | Serialized | No double spend |
| Refund/cancel where implemented | Ledger reconciles | PASS |
| Auditability | Mutations traceable | PASS |

Technical monetization infrastructure is verified in code/contracts; real willingness-to-pay and revenue remain unverified.

## 13. AI / Vision

AI remains advisory:

    MODEL
    → PROPOSAL
    → POLICY
    → ACCEPTED_BY_POLICY
    → SERVICE-ROLE EXECUTION

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Missing provider | Safe failure | No fake success |
| Provider timeout | Safe fallback | No uncontrolled mutation |
| Malformed output | Reject | No state mutation |
| Policy rejection | Reject | No execution |
| Stale proposal | Reject | No stale financial action |
| Vision inconsistency | Conservative evidence | No fabricated trust badge |
| Real provider call | Actual provider response | E2E evidence |

## 14. Analytics

| TEST | EXPECTED RESULT | PASS CRITERIA |
|---|---|---|
| Search telemetry | Non-blocking | Search still works |
| Product views | Safe analytics | No private data leak |
| Seller metrics | Real events only | No fabricated counts |
| Revenue metrics | Facts separated from estimates | PASS |

## 15. Security

Run:

    npm run typecheck
    npm run build
    npm run release:preflight

Then inspect:
- no service-role key in client source/bundle;
- no public secret variable names;
- RLS on exposed tables;
- server-side authorization;
- fail-closed rate limiting;
- bounded media uploads;
- safe URL handling;
- secrets only in environment configuration.

## 16. Performance

Measure actual:
- homepage;
- search;
- product detail;
- messaging;
- boost operation;
- AI call when enabled.

Record browser/network timings separately from DB/RPC timings.

## 17. Browser execution

Start:

    npm run dev

Then:

    npx playwright test

Interactive manual:

    npm run e2e:headed

Use a dedicated non-production E2E account for mutating flows.

## 18. Deployment checklist

Vercel is not a current development blocker.

Keep as owner deployment checklist:
- existing DEBA project access;
- production domain;
- NEXT_PUBLIC_SITE_URL;
- server Supabase credentials;
- CRON_SECRET;
- embedding credentials;
- broker/vision credentials;
- Cron;
- runtime logs;
- deployed walkthrough.

## 19. Business readiness decision framework

The strongest differentiated loop supported by the current architecture is:

    BUYER INTENT
    +
    REAL INVENTORY
    +
    SEARCH / MATCHING
    +
    PRICE CONTEXT
    +
    TRUST EVIDENCE
    +
    NEGOTIATION ASSISTANCE

→ less search effort
→ better decision confidence
→ faster contact
→ better deal readiness
→ repeat discovery
→ seller visibility tools
→ paid seller value

This is a product hypothesis, not measured PMF evidence.

## 20. Phase B exit

Do not claim Phase B production-live until:
- Auth owner action is complete;
- required environment configuration exists;
- the ordered release is intentionally activated;
- live schema is verified;
- vector is activated before semantic-search claims;
- real embeddings are ingested;
- real AI provider E2E succeeds;
- critical deployed/local walkthrough evidence is captured.

LOCAL PASS ≠ PRODUCTION PASS
CI PASS ≠ USER SUCCESS
