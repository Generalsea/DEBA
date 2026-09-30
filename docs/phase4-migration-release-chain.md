# DEBA Production Migration Release Chain

**Release candidate document — 2026-09-30**

## 1. Canonical release sequence

The production database activation sequence is intentionally linear and fail-closed:

1. **Phase 4.1 — Notifications & transactional email**
   - `20260929224200_phase4_realtime_notifications.sql`
2. **Phase 4.2 — Deal Matching & Smart Price Intelligence**
   - `20260929224300_phase4_2_deal_matching_price_intelligence.sql`
3. **Phase 4.3 — Future Marketplace Engine**
   - `20260929230000_phase4_3_future_engine.sql`
   - `20260929230100_phase4_3_boost_aware_search.sql`
   - `20260929230200_phase4_3_rpc_security_hardening.sql`
   - `20260929230300_phase4_3_placement_storage_correction.sql`
   - `20260929230400_phase4_3_handshake_cryptographic_hardening.sql`
   - `20260929230500_phase4_3_negotiation_constraint_fix.sql`
   - `20260929230600_phase4_3_order_reservation_lifecycle_bridge.sql`
   - `20260929230700_phase4_3_negotiation_eligibility_hardening.sql`
4. **Phase 4.4 — True Semantic Vector / Hybrid Search**
   - `20260930000000_phase4_4_true_vector_search.sql`
5. **Phase 5.1 — AI Deal Broker & Multi-modal Vision**
   - `20260930010000_phase5_ai_broker_vision.sql`

**Approved release set: 12 migrations.**

The release chain is dependency-sensitive and must be applied in exactly the order above. The Phase 5.1 migration must not be activated independently of the preceding Phase 4 chain.

## 2. Phase 4.2 lineage normalization

Phase 4.2 was normalized from `20260929201000` to `20260929224300` because the original timestamp preceded Phase 4.1.

No migration already recorded in Production is renamed, rewritten, or deleted by this normalization. The repository release chain intentionally carries the corrected filename.

## 3. Release preflight

The canonical preflight script is:

```text
scripts/phase4-release-preflight.mjs
```

It fails closed unless:

- the migration directory exists;
- all 12 approved migration filenames exist;
- every required migration has a 14-digit timestamp prefix;
- the approved timestamps are strictly increasing;
- the expected total is exactly 12.

Run from the repository root after the release-candidate integration branch contains the complete Phase 4 + Phase 5.1 set:

```powershell
npm run release:preflight
```

Do **not** treat a passing preflight on a partial feature branch as production authorization. The authoritative execution point is the integrated RC containing PR #31 through PR #36 changes.

## 4. Zero-mutation production policy

Before the first real `supabase db push`:

1. Verify CI is green on the exact RC commit.
2. Run the release preflight and retain its output as release evidence.
3. Review the Supabase Security Advisor and record all remaining findings.
4. Verify production Auth configuration.
5. Verify the Vercel production project, environment variables, domains, and deployment target.
6. Verify all Phase 5.1 provider secrets are configured only in server-side environments.
7. Keep the execution gate isolated from model output. AI/model responses remain advisory; deterministic database policy remains authoritative.

A migration must not be partially applied. If the release process detects an ordering, environment, security, or configuration failure, stop before `db push`.

## 5. Supabase / platform release notes

As of 2026-09-30, Supabase has announced a PostgreSQL 15.19 / 17.11 minor upgrade with possible action for `pgcrypto`, among other extensions. The project uses `pgcrypto` for protected Phase 5.1 policy encryption, so the production release operator should confirm the live database version and verify that existing encrypted data is not relying on legacy ciphers before or during the platform upgrade window.

Supabase also changed Data API exposure defaults for newly created public tables. The Phase 5.1 design therefore keeps explicit grants and RLS policies in the migration instead of relying on default exposure behavior.

## 6. Phase 5.1 server environment

The following variables are documented in `.env.example`:

```text
DEBA_BROKER_API_URL
DEBA_BROKER_API_KEY
DEBA_BROKER_MODEL
DEBA_VISION_API_URL
DEBA_VISION_API_KEY
DEBA_VISION_MODEL
```

All six values are **server-only**. They must never be renamed with a `NEXT_PUBLIC_` prefix and must never be imported into browser/client code.

The Phase 5.1 implementation intentionally does not claim live provider E2E verification unless real provider credentials and endpoints have been configured and exercised in the target environment.

## 7. Release candidate PR set

| PR | Scope | Current release role |
| --- | --- | --- |
| #31 | Phase 4.1 Notifications + transactional email | Required before Phase 4.2 |
| #32 | Phase 4.2 Deal Matching + Smart Price Intelligence | Required before Phase 4.3 |
| #33 | Phase 4.3 Future Marketplace Engine | Required before Phase 4.4 |
| #34 | Phase 4.4 True Semantic Vector Search | Required before Phase 5.1 |
| #35 | Migration release-chain normalization + preflight | Release-chain control plane |
| #36 | Phase 5.1 AI Broker + Vision + execution gate + trust evidence | Final feature migration |

All six PRs are independent GitHub PRs against the protected `main` release line. Do not merge them out of dependency order.

## 8. Current RC gating status

- `main` remains isolated at the established RC baseline `75b26ae6`.
- PR #36 current head is `98620864b95f75658e5b8260b54094db85685b35`; its verify/quality CI was green at the reviewed head.
- Phase 5.1 migration verification was performed atomically with `BEGIN ... ROLLBACK`; no Phase 5.1 schema was intentionally persisted by that verification.
- The Phase 5 provider integrations are server-only and are not represented as live production E2E evidence.
- The Vercel connector currently exposes no teams, so Vercel Production environment verification is **not certified** from this session.
- Supabase Security Advisor still has the previously identified `auth_leaked_password_protection` finding; this is a platform/Auth configuration gate rather than a migration defect.

## 9. Production activation rule

This document defines the release sequence; it does not authorize production activation by itself.

Production `db push` is permitted only from the integrated RC after the complete 12-migration preflight passes and the remaining platform/security gates are explicitly cleared. The preferred operational pattern is:

```text
Merge ordered PRs
  -> verify exact RC commit
  -> run release:preflight
  -> verify Supabase/Auth/Vercel/provider gates
  -> execute db push
  -> verify live schema + Advisors
  -> deploy/promote application
  -> retain evidence bundle
```
