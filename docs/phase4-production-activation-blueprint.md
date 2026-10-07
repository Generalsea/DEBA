# DEBA Phase 4 Production Activation Blueprint

## Release baseline

Production activation must start only after the target release has been merged/released and the runtime/security gates are green.

Current baseline:
- `main`: `75b26ae6ec72a5f69339f5e2145c2be651967b5e`
- PR #31: Phase 4.1 Notifications
- PR #32: Phase 4.2 Deal Matching + Price Intelligence
- PR #33: Phase 4.3 Future Marketplace Engine
- PR #34: Phase 4.4 True Semantic Vector Search

All four PRs are currently separate draft PRs. Do not treat their UI/API code as production-ready solely because individual migration tests pass.

## Migration manifest

### Phase 4.1 — Notifications / Transactional Email

Source PR: #31  
Source branch: `feature/phase-4-growth-and-notifications`

Migration:
`supabase/migrations/20260929224200_phase4_realtime_notifications.sql`

Activation dependencies:
- Supabase Vault secret/endpoint configured where the migration requires it.
- Server-side Resend configuration present in Vercel Production.
- Notification Realtime publication verified.
- Email provider endpoint tested without exposing secrets to browser code.

### Phase 4.2 — Deal Matching / Smart Price Intelligence

Source PR: #32  
Source branch: `feature/phase-4-2-deal-matching-price-intelligence`

Migration:
`supabase/migrations/20260929201000_phase4_2_deal_matching_price_intelligence.sql`

Activation dependencies:
- Vault / `pg_net` path configured where required.
- Matching remains conservative and must return `insufficient_data` when qualified comparable data is unavailable.
- RLS and owner-scoping verified.

### Phase 4.3 — Future Marketplace Engine

Source PR: #33  
Source branch: `feature/phase-4-3-future-engine`

Migrations, in dependency order:

1. `20260929230000_phase4_3_future_engine.sql`
2. `20260929230100_phase4_3_boost_aware_search.sql`
3. `20260929230200_phase4_3_rpc_security_hardening.sql`
4. `20260929230300_phase4_3_placement_storage_correction.sql`
5. `20260929230400_phase4_3_handshake_cryptographic_hardening.sql`
6. `20260929230500_phase4_3_negotiation_constraint_fix.sql`
7. `20260929230600_phase4_3_order_reservation_lifecycle_bridge.sql`
8. `20260929230700_phase4_3_negotiation_eligibility_hardening.sql`

Required evidence already completed:
- Runtime transaction evidence: 8/8 assertions PASS.
- Post-rollback probe: Phase 4.3 objects absent from live DB.
- No production mutation remains from the evidence harness.

### Phase 4.4 — True Semantic Vector Search

Source PR: #34  
Source branch: `feature/phase-4-4-true-vector-search`

Migration:
`supabase/migrations/20260930000000_phase4_4_true_vector_search.sql`

Required production configuration:
- `DEBA_EMBEDDING_API_URL`
- `DEBA_EMBEDDING_API_KEY`
- `DEBA_EMBEDDING_MODEL`
- Production ingestion must explicitly set `DEBA_PHASE44_PRODUCTION=1`.

Vector contract:
- `extensions.vector(1536)`
- HNSW with `vector_cosine_ops`
- Partial index restricted to `searchable_active = true`
- DB-derived SHA-256 source hash
- stale embeddings automatically removed from searchability when source fields change
- FTS + Arabic normalization + trigram + semantic cosine fused with RRF

## Critical ordering note

The Phase 4.1 migration filename is timestamped after the Phase 4.2 migration filename:

- Phase 4.2: `20260929201000...`
- Phase 4.1: `20260929224200...`

Therefore a single filesystem-driven migration push may order them by timestamp rather than the desired business rollout sequence.

Do not rename historical migration files after they have been referenced by a deployed migration history.

For a strict business activation sequence of 4.1 -> 4.2 -> 4.3 -> 4.4, use one of these controlled approaches:

1. deploy each approved migration set separately from its release artifact and verify before continuing; or
2. create a new, reconciled release migration chain with explicit dependency ordering before any production apply.

The release operator must not assume that the filename order represents the requested business sequence.

## Production gates

### Gate A — GitHub

Required on the exact release Head:
- Typecheck PASS
- Contract tests PASS
- Phase-specific tests PASS
- Next.js Build PASS
- Playwright collection PASS
- No failing required checks

PR #34 currently has verified successful workflow runs on its latest tested head, including:
- verify job: PASS
- quality job: PASS
- Type-check: PASS
- Contract tests: PASS
- Phase 4.4 Vector contract tests: PASS
- Build: PASS
- Playwright collection: PASS

### Gate B — Supabase

Before activation:
- Security Advisor reviewed and documented.
- Any remaining security warnings explicitly accepted or remediated.
- Migration status reconciled with the exact release artifact.
- Backup/restore point verified.
- No unexpected Phase 4.x objects exist from prior experiments.

### Gate C — Vercel Production

Required server-only environment:
- Supabase production URL + server credential
- `CRON_SECRET` for Phase 4.3 cron
- Embedding provider URL/key/model for Phase 4.4
- Phase 4.1 email/Vault/Resend configuration where applicable
- No `NEXT_PUBLIC_` exposure for embedding credentials

## Phase 4.4 Batch Ingestion

Script:
`scripts/ingest-product-embeddings.mjs`

Commands:

### Safe dry run

```powershell
npm run ingest:embeddings
```

### Production apply

```powershell
$env:DEBA_PHASE44_PRODUCTION="1"
npm run ingest:embeddings:apply
Remove-Item Env:DEBA_PHASE44_PRODUCTION
```

Operational behavior:
- scans only published + approved + sale + owned + in-stock + priced listings;
- defaults to a dry run;
- requires an explicit production guard for writes;
- batches requests;
- skips unchanged embeddings by source hash + model;
- rejects non-1536-dimensional provider responses;
- stops on a failed apply rather than silently creating partial embeddings.

The current live database contains 121 products total, but only 9 listings currently satisfy the active searchable-sale predicate. The ingestion script is intentionally dynamic and will process whatever number qualifies at execution time; it does not hard-code 121.

## Post-ingestion verification

Required assertions after ingestion:
- number of eligible active listings = number of embeddings with `searchable_active=true` and current source hash;
- zero stale searchable embeddings;
- zero malformed vector dimensions;
- HNSW index exists and is partial;
- hybrid search returns lexical/trigram/semantic rank fields;
- semantic-only requests return semantic ranks without requiring lexical matches.

## Rollback policy

Use `BEGIN ... ROLLBACK` only as pre-production compatibility/evidence testing.

Do not use ad-hoc production SQL rollback to undo a migration after release. Production rollback must be handled by:
- reverting the application to a compatible version, and/or
- applying a forward corrective migration reviewed as part of the release.

No production migration should be marked "activated" until the release artifact, schema state, application deployment, and provider configuration are mutually compatible.
