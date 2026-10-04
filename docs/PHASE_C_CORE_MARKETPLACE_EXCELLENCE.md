# DEBA — Phase C Core Marketplace Excellence
## Phase C Entry Contract & Scope Boundary

**Date:** 2026-10-04  
**Repository:** Generalsea/DEBA  
**Branch:** `feature/phase-c-roadmap-definition-20261004`  
**Base:** `rc/phase4-5-integrated-20261004`

> **Status: ROADMAP GAP RECORDED — NOT A FEATURE AUTHORIZATION**

This document resolves a roadmap-definition gap without inventing an implementation milestone.
The master continuity contract declares:

- PHASE C — CORE MARKETPLACE EXCELLENCE
- every phase must contain OBJECTIVE, DEPENDENCIES, FEATURES, SUCCESS METRICS, RISKS, EXIT CRITERIA

However, the authoritative roadmap currently gives Phase C only its name and does not define a numbered or named child milestone.

Therefore this document establishes the **Phase C entry contract and scope boundary** only. It does **not** authorize an invented "C1" implementation milestone.

---

## 1. Source-of-truth requirements

The Phase C boundary is derived only from requirements already present in the master roadmap:

### Marketplace North Star
DEBA must become excellent at four fundamentals:

1. Help people find what they want.
2. Help people list what they have.
3. Help people trust each other.
4. Help both sides complete a deal.

### Buyer journey
DISCOVER → SEARCH → FILTER → COMPARE → UNDERSTAND → TRUST → CONTACT → NEGOTIATE → COMPLETE → RETURN

### Seller journey
CREATE LISTING → IMPROVE LISTING → PRICE INTELLIGENTLY → PUBLISH → DISCOVERABILITY → RECEIVE LEADS → RESPOND → CLOSE DEAL → MEASURE RESULTS → REPEAT

### Critical marketplace flow
REGISTER → LOGIN → CREATE LISTING → UPLOAD MEDIA → PUBLISH → SEARCH → FILTER → VIEW → SAVE → CONTACT SELLER → MESSAGE → RECEIVE NOTIFICATION

### Engineering completion rules
A task is DONE only when it is implemented, integrated, tested, verified, free of known critical regression, and documented.

The testing standard requires the appropriate unit, integration, API, database, authentication, authorization, E2E, security, performance, regression, edge-case, and failure-path coverage.

---

## 2. Phase C objective

**Objective:** establish an excellent, dependable core marketplace experience for the primary buyer/seller loop using the existing DEBA architecture and real persisted data.

The Phase C outcome is not "more features". It is a core marketplace that is materially easier to:

- discover listings;
- create and publish listings;
- understand a listing;
- save a listing;
- contact the seller;
- communicate in listing context;
- complete the core interaction without false success, data corruption, or authorization leakage.

---

## 3. Dependencies

### Required baseline

- Release Candidate architecture remains intact.
- Protected `main` remains untouched by Phase C work.
- Existing Supabase schema is inspected before any migration.
- Existing authentication and authorization boundaries remain fail-closed.
- Existing media/storage path remains intact.
- Existing public-search abuse control remains enabled.
- Existing CI/contract/build foundations remain green for the exact implementation head before merge.

### Important distinction

Production activation is a separate platform gate. Phase C repository work must not be coupled to Vercel access, production vector activation, or real AI provider credentials.

The current external state remains:

- Supabase leaked-password protection: **OWNER ACTION REQUIRED**
- Vercel production access: **EXTERNAL ACCESS BLOCKER**
- Production vector activation: **NOT ACTIVATED**
- Real AI provider E2E: **NOT VERIFIED**

These are not reasons to fabricate Phase C functionality, nor reasons to alter production unsafely.

---

## 4. Phase C scope

The scope below is a **derived phase boundary**, not a pre-authorized child-milestone list.

### In scope

**Core listing lifecycle**
- seller access and listing creation;
- category-driven required attributes;
- media upload;
- validation and submission;
- moderation-aware publication;
- safe edit/manage behavior where already supported.

**Core discovery**
- real inventory browse;
- basic search/filter interaction already supported by the current application;
- listing detail access;
- result relevance and state correctness at the core UX level.

**Core listing understanding**
- title, price, condition, location, category, media;
- seller context;
- clear availability/status;
- clear action hierarchy;
- truthful loading, empty, unavailable and error states.

**Save / contact / communication**
- favorites/save behavior;
- contact seller entry point;
- product-linked conversation context;
- message send/receive behavior;
- notification handoff where implemented;
- duplicate/retry/unauthorized failure handling.

**Core observability and reliability**
- meaningful server-side error handling;
- no false-success UI;
- idempotent behavior where mutations require it;
- authorization at the server/database boundary;
- regression coverage for the critical marketplace path.

### Explicitly outside Phase C unless separately promoted by an approved roadmap milestone

- advanced semantic/hybrid search and matching work belonging to Phase E;
- trust-and-safety expansion belonging to Phase D;
- new monetization products belonging to Phase F;
- professional seller engine belonging to Phase G;
- AI differentiation belonging to Phase I;
- international expansion belonging to Phase J;
- production deployment activation;
- unrelated visual rewrites;
- speculative features without measured user/business value.

---

## 5. Current repository inventory relevant to Phase C

The existing RC already contains real implementations for major portions of the core surface:

- `src/app/page.tsx` — real published/approved listing discovery, filtering and homepage marketplace surface.
- `src/app/sell/page.tsx` — seller-gated listing entry and real category/attribute loading.
- `src/app/sell/ProductListingForm.tsx` — listing creation form and validation path.
- `src/app/products/[slug]/page.tsx` — real listing detail, seller context, favorites, product actions and related marketplace context.
- `src/app/chat/page.tsx` — authenticated chat surface using `ChatCommsExact`.
- `src/components/FavoriteButton.tsx` — existing save/favorite interaction.
- `src/components/ChatCommsExact.tsx` — current listing-context communication UI.
- `proxy.ts` + `src/utils/publicSearchRateLimit.ts` — request-boundary public-search abuse control.

This inventory is an implementation map, not proof that every flow is runtime-verified end-to-end.

---

## 6. Success metrics

Phase C metrics must be measured from real user behavior, never fabricated.

### Buyer funnel

VISIT → SEARCH → VIEW → SAVE → CONTACT → RESPONSE → DEAL SIGNAL → REPEAT

### Seller funnel

SIGNUP → LISTING → PUBLISH → FIRST LEAD → FIRST PAID ACTION → REPEAT PAID ACTION → RETAINED SELLER

### Core operational metrics to baseline

- listing creation completion rate;
- publish success rate;
- search/filter completion and result usefulness;
- listing view rate;
- save rate;
- contact rate;
- seller response rate;
- time to first seller response where measurable;
- repeat usage.

No target percentage is asserted here until a real baseline exists.

---

## 7. Risks

### Product risk
Overbuilding secondary features before the core listing-to-contact loop is reliable.

### Engineering risk
Changing shared marketplace components without regression coverage.

### Data risk
Introducing schema changes without dependency analysis, RLS verification, transaction safety, or rollback planning.

### Security risk
Client-side authorization assumptions, IDOR, abuse of listing/contact endpoints, upload abuse, spam, and rate-limit bypass.

### UX risk
Adding visual complexity that increases friction in discovery, listing creation, or contact.

### Measurement risk
Calling an implementation "successful" without real runtime evidence or inventing conversion/revenue claims.

---

## 8. Phase C exit criteria

Phase C can be considered complete only when the relevant core marketplace scope is:

- implemented in the existing architecture;
- integrated with real Supabase data;
- covered by appropriate automated tests;
- exercised through real user-flow verification;
- authorization/RLS verified;
- failure paths verified;
- duplicate/concurrent/retry behavior safe where applicable;
- no known critical regression;
- performance impact measured and acceptable;
- mobile/browser states verified;
- documented with evidence.

The critical path must work truthfully:

REGISTER
→ LOGIN
→ CREATE LISTING
→ UPLOAD MEDIA
→ PUBLISH
→ SEARCH
→ FILTER
→ VIEW
→ SAVE
→ CONTACT SELLER
→ MESSAGE
→ RECEIVE NOTIFICATION

Both happy-path and failure-path behavior are required.

---

## 9. Child-milestone status

**No authoritative Phase C child milestone currently exists in the master roadmap.**

Accordingly:

- No "C1" name is invented here.
- No application feature is authorized by this document alone.
- No database migration is created by this document.
- No production state is changed.
- The next implementation cycle requires an explicitly named Phase C child milestone in the living roadmap.

Once a child milestone is explicitly defined, the execution protocol remains:

INSPECT → PLAN → EXECUTE → TEST → FIX → RETEST → VERIFY → CLOSE

and only one milestone may be executed in a cycle.

---

## 10. Decision

**Phase C readiness state: NOT BLOCKED BY TECHNOLOGY — BLOCKED BY MISSING ROADMAP GRANULARITY.**

The repository is sufficiently mature to enter Phase C work, but the governance contract is incomplete because the first executable child milestone is undefined.

The safe engineering decision is therefore:

**DO NOT INVENT C1.**

Preserve the RC, keep production fail-closed, and require the roadmap to identify the first Phase C implementation unit before feature work begins.
