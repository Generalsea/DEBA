# DEBA — Phase C Core Marketplace Excellence
## Phase C Entry Contract & C1 Milestone Definition

**Date:** 2026-10-04  
**Repository:** Generalsea/DEBA  
**Branch:** feature/phase-c-roadmap-definition-20261004  
**Base:** rc/phase4-5-integrated-20261004

> **Status: C1 DEFINED FOR THE NEXT EXECUTION CYCLE — NO FEATURE CODE IN THIS MILESTONE**

This document resolves the Phase C roadmap-definition gap and defines the first executable Phase C milestone from requirements already present in the authoritative master roadmap and the verified RC architecture.

The master continuity contract declares Phase C as CORE MARKETPLACE EXCELLENCE and requires every phase to contain:

- OBJECTIVE
- DEPENDENCIES
- FEATURES
- SUCCESS METRICS
- RISKS
- EXIT CRITERIA

The authoritative document did not previously name a Phase C child milestone. This document now defines exactly one first child milestone without introducing a new product direction.

---

## 1. Source-of-truth requirements

The Phase C boundary is derived only from requirements already present in the master roadmap.

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

The roadmap also requires failure-first testing, including unauthorized requests, duplicate requests, network/provider/database failure, concurrent actions, malicious input, and bypass attempts.

A task is DONE only when it is implemented, integrated, tested, verified, free of known critical regression, and documented.

---

## 2. Phase C objective

**Objective:** make DEBA's primary marketplace interaction dependable from a real seller-created listing through buyer discovery, save, seller contact, communication, and notification handoff, using the existing application architecture and real Supabase data.

The goal is core-flow integrity and usability, not feature accumulation.

---

## 3. C1 — Critical Marketplace Flow Integrity

### C1 objective

Harden and verify the first end-to-end buyer/seller marketplace path:

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

C1 is the foundational Phase C milestone because every later marketplace improvement depends on this loop being trustworthy.

### C1 priority

**P1 — Major core-function reliability / conversion path**

### C1 dependencies

1. Current integrated RC remains the implementation baseline.
2. Existing seller, listing, media, search, favorite, chat, and notification architecture is reused rather than rebuilt.
3. Existing Supabase schema is inspected before any database change.
4. Existing authentication, RLS, API authorization, and rate limiting remain fail-closed.
5. Existing CI/contract/build foundation is retained.
6. Production activation is not a dependency for repository implementation.
7. Real business metrics are not fabricated; behavioral baselines remain FACT/MEASURED only when supported by actual data.

### C1 scope

#### A. Seller listing path

Verify and harden:

- authenticated seller access;
- category selection;
- required category attributes;
- title/description/price validation;
- media upload validation and limits;
- moderation-aware submission;
- truthful success/failure states;
- retry behavior without accidental duplicate listing creation;
- safe edit/manage behavior where already implemented.

#### B. Buyer discovery path

Verify and harden:

- published + approved inventory visibility;
- search input normalization and accepted filter state;
- category/filter/price/condition/location continuity;
- correct transition from result to listing detail;
- no exposure of unpublished/rejected inventory;
- truthful empty/loading/error states.

#### C. Listing detail path

Verify:

- real product data;
- primary/secondary media;
- seller context;
- price/currency;
- condition;
- location;
- availability;
- action hierarchy;
- favorite state;
- contact action;
- unavailable/deleted/sold/reserved behavior.

#### D. Save/favorite path

Verify:

- authenticated access behavior;
- insert/delete correctness;
- duplicate-safe behavior;
- optimistic UI rollback on failure;
- no cross-user favorite mutation;
- no false success after database rejection.

#### E. Contact seller / room creation

Verify:

- authenticated requirement;
- valid product requirement;
- product availability;
- self-contact rejection;
- correct buyer/seller participant assignment;
- repeated requests do not create unsafe duplicate rooms;
- product context is preserved;
- failure response is truthful and recoverable.

#### F. Messaging path

Verify:

- participant authorization;
- message persistence;
- message length/type validation;
- retry/duplicate behavior;
- realtime receive path where configured;
- product-linked context;
- media/message controls where already implemented;
- no cross-room or cross-user data exposure;
- provider/database failure handling.

#### G. Notification handoff

Verify the existing notification integration for the critical contact/message path:

- notification event is generated or queued as designed;
- recipient is correct;
- duplicate event behavior is safe;
- failure does not create false success;
- user-facing unread state remains truthful.

### C1 explicit non-scope

The following remain outside C1:

- new semantic/vector-search capabilities;
- advanced hybrid ranking or matching;
- new trust/fraud systems;
- new coin/boost/monetization products;
- professional seller/SMB systems;
- new AI product capabilities;
- internationalization expansion;
- Vercel production deployment;
- production vector activation;
- PostgreSQL upgrade;
- unrelated visual redesign;
- speculative features not tied to the critical path.

Existing features in these areas may be regression-tested where the C1 flow touches them, but C1 does not expand their product scope.

---

## 4. C1 implementation rule

**Inspect first. Modify only verified gaps.**

C1 must not be implemented as a rewrite.

For each failure discovered:

1. Prefer the smallest safe correction inside the existing architecture.
2. Preserve route contracts.
3. Preserve database contracts.
4. Preserve public behavior unless the behavior is demonstrably incorrect or unsafe.
5. Add regression coverage before declaring the correction complete.
6. Avoid schema changes unless the existing contract cannot satisfy the verified requirement.
7. For any required schema change: inspect dependencies, RLS, grants, constraints, transaction behavior, idempotency, rollback strategy, and advisors before commit.

---

## 5. C1 verification matrix

### Functional

- seller can create a valid listing;
- invalid listing is rejected with actionable validation;
- valid media is accepted;
- invalid/oversized media is rejected safely;
- submitted listing follows moderation state correctly;
- approved published listing appears in discovery;
- search/filter reaches the correct listing;
- listing detail loads its own real data;
- buyer can save/unsave the listing;
- buyer can open seller contact;
- buyer can send a message;
- recipient can receive the message;
- notification handoff is correct.

### Authorization / security

- unauthenticated listing mutation is denied;
- unauthenticated favorite mutation is denied;
- unauthenticated contact is denied;
- non-participant chat read/write is denied;
- seller cannot mutate another seller's listing;
- buyer cannot alter another user's favorite;
- cross-room message access is denied;
- product visibility respects published + approved rules;
- no secret/service-role value reaches client code;
- rate limiting remains effective on relevant abuse surfaces.

### Failure-first

Test at minimum:

- duplicate favorite;
- repeated contact request;
- repeated message submission where applicable;
- self-contact;
- unavailable listing;
- deleted/unpublished listing;
- unauthorized request;
- expired/invalid session;
- media upload failure;
- database failure;
- realtime failure;
- notification failure;
- malformed/malicious input;
- concurrent action on the same marketplace object.

### Regression

Existing:

- Phase 4.1 notifications;
- Phase 4.2 matching;
- Phase 4.3 future-engine contracts;
- Phase 4.4 vector-search contracts;
- Phase 5.1 AI contracts;
- public-search abuse control;
- release preflight;
- typecheck;
- build;
- Playwright collection

must not regress as a result of C1 changes.

---

## 6. C1 success metrics

C1 uses two classes of metrics.

### A. Engineering gate metrics

These are verifiable release metrics:

- critical-path automated checks PASS;
- relevant API/database/auth/RLS tests PASS;
- failure-path tests PASS;
- local Playwright critical-path verification PASS;
- no known P0/P1 regression introduced;
- build/typecheck/contracts remain PASS;
- no unintentional schema drift;
- no unauthorized data exposure observed.

### B. Business baseline metrics

These must be measured from real usage after exposure to real users:

- listing creation completion rate;
- publish success rate;
- search-to-view rate;
- save rate;
- contact rate;
- seller response rate;
- time to first seller response;
- repeat usage.

**No target business percentage is invented in C1.**

---

## 7. C1 risks

### Product risk
Treating technical completion as proof of marketplace success.

**Control:** separate engineering PASS from measured business outcomes.

### Engineering risk
Changing shared components that support multiple routes.

**Control:** targeted regression matrix + exact-head verification.

### Data risk
Unsafe duplicate mutations or partial failure.

**Control:** idempotency checks, transaction review, concurrency tests, and rollback-safe changes.

### Security risk
IDOR/BOLA in favorites, listings, rooms, or messages.

**Control:** server/database authorization tests and RLS inspection.

### UX risk
Overloading the core flow with unnecessary complexity.

**Control:** optimize only the steps directly affecting discoverability, understanding, save, contact, and communication.

---

## 8. C1 exit criteria

C1 is **PASS** only when all applicable gates below are satisfied:

- [ ] Required implementation gaps are corrected.
- [ ] Existing core functionality remains intact.
- [ ] Critical buyer/seller path is exercised end-to-end.
- [ ] Happy-path tests pass.
- [ ] Failure-path tests pass.
- [ ] Auth/authz/RLS behavior is verified.
- [ ] Duplicate/retry/concurrency safety is verified where applicable.
- [ ] Database integrity is preserved.
- [ ] Integration with existing notification/chat infrastructure is verified.
- [ ] Regression suite remains green.
- [ ] Typecheck passes.
- [ ] Production build passes.
- [ ] Playwright critical-path evidence is captured locally.
- [ ] Performance impact is evaluated from evidence rather than guesswork.
- [ ] Mobile/browser critical states are inspected.
- [ ] No known critical issue remains.
- [ ] Documentation/evidence is updated.

Only after these conditions can the C1 milestone be closed as PASS.

---

## 9. Current architecture readiness

The RC already contains substantial implementations relevant to C1:

- src/app/page.tsx — real published/approved discovery and filtering;
- src/app/sell/page.tsx — seller-gated listing entry;
- src/app/sell/ProductListingForm.tsx — listing form/validation;
- src/app/products/[slug]/page.tsx — real listing detail and seller context;
- src/components/FavoriteButton.tsx — save/favorite interaction;
- src/components/ChatCommsExact.tsx — listing-context communications;
- src/app/api/chat/rooms/route.ts — protected product chat-room creation;
- src/app/api/chat/rooms/[id]/messages/route.ts — protected message handling;
- proxy.ts + src/utils/publicSearchRateLimit.ts — public-search abuse protection.

Therefore C1 is a hardening + verification milestone, not a greenfield build.

---

## 10. Environment and production boundary

C1 does not require:

- production migrations;
- enabling vector in production;
- production embeddings;
- real AI provider credentials;
- Vercel deployment;
- PostgreSQL version upgrade.

Current live Supabase state remains independent of the RC release chain. The only current Security Advisor WARN is the external leaked-password-protection setting, which remains OWNER ACTION REQUIRED. The vector extension is available but not installed in the live database.

These platform states are recorded, not bypassed.

---

## 11. Next execution protocol

The next implementation cycle is exactly:

**PHASE C → C1 — CRITICAL MARKETPLACE FLOW INTEGRITY**

Execution:

INSPECT
→ PLAN
→ EXECUTE
→ TEST
→ FIX
→ RETEST
→ VERIFY
→ CLOSE

No second Phase C milestone is to be started in the same cycle.

---

## 12. Decision

**C1 is now formally defined and ready for execution.**

This is the first Phase C milestone because it strengthens the marketplace's central liquidity loop before adding more sophisticated intelligence, trust, or monetization layers.

The next cycle may modify application code and, only when proven necessary, database/schema code under the existing safety gates.

**Phase C C1 = DEFINED / READY FOR EXECUTION**


---

## 13. C1 implementation evidence — 2026-10-04

### Verified code fixes

1. Chat location payload is normalized to the database RPC contract: `lat`, `lng`, and optional `accuracy`.
2. Chat room cards no longer claim universal online presence or seller verification. Until a real presence/verification source is integrated, both signals remain false.
3. Chat participant lookup/database/RPC failures are mapped to truthful HTTP classes:
   - `42501` → 403
   - `P0002` → 404
   - `P0001` → 400
   - unexpected backend failures → 500
4. Chat media storage failures return 500 instead of incorrectly returning 403.
5. Offer-action RPC errors use the same truthful status classifier.
6. Normal text/image/file/location messages create recipient-scoped in-app notifications through the server-only admin client, excluding offer messages because offer lifecycle already owns their notifications.
7. Muted chat participants are excluded from the message notification recipient set.
8. Message writes remain behind the database-enforced `send_chat_message` RPC.

### Live Supabase verification

Read-only production inspection confirmed:

- current database PostgreSQL version is 17.6.1.166;
- current production migration ledger does not contain the Phase 4.1–5.1 RC release chain;
- `vector` is available but not installed;
- one Security Advisor warning remains: `auth_leaked_password_protection`;
- current RLS policies scope chat rooms, chat participants, messages, favorites, notifications, and products as expected for their current access model.

A temporary live RPC probe executed against an existing published/approved product confirmed that the real `public.send_chat_message` function accepts the normalized location payload and persists `lat/lng/accuracy` inside the message metadata. The probe was removed after verification; post-check showed zero remaining probe rooms, participants, or messages.

A second temporary probe confirmed repeated marketplace chat-room acquisition returns the same room for the same product/buyer pair, while direct client-role message insertion is rejected by the existing database privilege model. That probe was explicitly cleaned after the tool's statement-session behavior was detected; post-check showed zero remaining probe objects.

### Automated contract evidence

The C1 contract suite is wired into `npm test` and also exposed as:

`npm run test:phase-c1`

Static contract execution against the exact branch sources passed all six C1 contract groups:

- location payload ↔ RPC contract;
- truthful presence/verification state;
- truthful chat error classification;
- recipient-scoped message notification contract;
- RPC-only message writes;
- npm test wiring.

### Remaining runtime verification

**NOT VERIFIED IN THIS SESSION:**

- actual user-machine `npm ci`;
- actual user-machine `npm test`;
- actual typecheck/build;
- actual local Playwright critical-path walkthrough;
- two-user notification receipt in a running browser session.

GitHub official CI was not observable through the connected workflow/status surfaces for this draft PR, so no CI PASS claim is made.

C1 therefore remains **IMPLEMENTED + STATICALLY VERIFIED + LIVE RPC VERIFIED / LOCAL E2E NOT YET VERIFIED** until the local runtime gate is executed.


### Classified-first detail semantics added during C1

The listing detail surface now reflects DEBA's actual business model:

- Fixed-price buyers see a primary **"تواصل مع البائع"** action rather than Buy Now, Cart, or Checkout.
- The detail page no longer builds a cart payload or exposes the legacy checkout route.
- The former Future Engine panel is suppressed for buyers when the listing is fixed-price.
- Buyer-facing secret-floor terminology is removed completely; the floor is only exposed to the listing owner on offer-enabled listings and is described as **"الحد الأدنى الذي تقبله للعروض"**.
- The detail/security copy now says the visible amount is the seller's asking price and that agreement/delivery are handled through DEBA communication.
- The data banner now uses **"أحدث بيانات متاحة"** instead of demotivating "بيانات قديمة".
- Price Insight language is decision-oriented while retaining its evidence-based states.

The existing Phase 4.2 price intelligence is a real, explainable comparison engine in RC: it first seeks strict peers by currency/category/condition/title similarity, falls back to broader comparable peers when needed, computes median and quartile ranges, derives price delta, and exposes a confidence value. It must not be described as live production intelligence until its RC migration is activated in the target database.
