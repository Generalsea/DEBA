# DEBA Phase 4 Migration Release Chain

Canonical order:

1. Phase 4.1 — Notifications
2. Phase 4.2 — Deal Matching & Smart Price Intelligence
3. Phase 4.3 — Future Marketplace Engine (8 migrations)
4. Phase 4.4 — True Semantic Vector Search

Phase 4.2 was normalized from `20260929201000` to `20260929224300` because its original prefix preceded Phase 4.1. No migration already recorded in Production is renamed or rewritten.

Release preflight must fail closed unless all required migration files exist and their 14-digit prefixes are strictly increasing. Production activation remains gated by CI, Security Advisor, Auth configuration, Vercel Production configuration, and the reviewed release manifest.
