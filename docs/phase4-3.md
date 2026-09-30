# DEBA Phase 4.3 — Future Marketplace Engine

## Delivered
This branch provides the first production-oriented vertical slice of the future marketplace engine:
- Coins ledger with idempotent lifecycle rewards.
- Atomic advertiser boosts: Super Boost, Stealth Pin, Auto-Refresh.
- Private seller smart floor with automatic counter-offer logic.
- Live auction state with Realtime-ready offer updates and polling fallback.
- Negotiated orders linked through \`source_offer_id\` without violating the existing \`orders.offer_id\` invariant.
- Six-digit trade handshake stored only as a SHA-256 digest; negotiated completion is blocked until seller verification.
- Peak-hour Auto-Refresh derived from observed \`product_views\`.
- Authenticated Vercel Cron endpoint for the hourly ad engine.
- Predictive lexical suggestions with price intelligence and active-seller density.

## Vector boundary
The live Supabase project currently has \`pg_trgm\` and does not have \`pgvector\`. This branch therefore does not fabricate embeddings or label trigram/FTS as semantic vector search. A later vector tranche should approve the extension, choose an embedding model, backfill vectors, add a vector index, and fuse semantic distance into the ranking contract.

## Initial Coin configuration
These are product configuration values, not external-market claims:
- first listing: 100 Coins
- completed verified sale: 50 Coins
- published verified 5-star review: 10 Coins
- Super Boost: 100 Coins / 24h
- Stealth Pin: 150 Coins / 72h
- Auto-Refresh: 100 Coins / 7d

## Activation
The migration is intentionally not applied to the production Supabase database by this branch. Production Cron execution also requires \`CRON_SECRET\` and a Vercel plan that supports hourly schedules.
