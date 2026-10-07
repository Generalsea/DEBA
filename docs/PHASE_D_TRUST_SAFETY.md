# DEBA — Phase D Trust & Safety

## Current execution scope

This branch implements the phone identity foundation that belongs to the Trust & Safety phase. It does not activate the production database migration and does not claim provider readiness before WhatsApp configuration exists.

## Existing systems reused

- auth.users.phone and phone_confirmed_at are the source of truth for phone ownership.
- public.profile_private.phone remains private and is bound to the authenticated Auth phone.
- public.profiles is extended with a derived phone_verified trust signal.
- Existing api_rate_limits is reused for OTP abuse controls.
- Existing chat_security_events remains the chat risk/audit sink.
- Existing seller verification, moderation, RLS, offers and listing lifecycle remain in place.

## Implemented

### Egyptian phone identity

Accepted forms are normalized to E.164 for Egypt only. Mobile prefixes supported by the application are 010, 011, 012 and 015. Foreign country codes are rejected. Validation is repeated server-side.

### WhatsApp OTP

The primary authentication path is PHONE → SEND WHATSAPP CODE → VERIFY CODE → AUTHENTICATED EXPERIENCE.

The application calls Supabase Phone Auth with the explicit whatsapp delivery channel for OTP.

OTP verification uses Supabase's documented phone verification contract (type: sms) because Supabase uses that verification type for phone OTP even when WhatsApp is the delivery channel.

No local OTP is generated or persisted.

### Abuse controls

OTP send and verification use fail-closed rate limits by phone hash, IP hash and device-material hash. No raw phone/IP is used as the stored rate key.

### Enumeration resistance

The send path uses a generic success/error contract and shouldCreateUser: true, avoiding a user-existence probe through the normal phone flow.

Provider failures are surfaced as generic operational errors.

### Database enforcement

The migration adds:

- profiles.phone_verified
- E.164 Egyptian phone constraint on profile_private
- unique private phone index
- Auth-to-profile phone verification synchronization trigger
- profile-private phone integrity trigger
- phone verification guards for product/chat/message/offer mutations
- defense-in-depth listing RLS
- hourly cleanup of stale auth.users.phone_change attempts

### Marketplace trust boundary

Before these operations the user must have a real confirmed phone:

- listing creation/update
- marketplace chat creation
- message creation
- offer creation
- seller verification submission

The seller UI also blocks listing creation early for an unverified account.

## External dependency

Production WhatsApp OTP still requires the project's real Supabase Phone provider configuration for WhatsApp, with the required Twilio/Twilio Verify/WhatsApp Sender setup.

The code intentionally does not contain provider secrets.

## Legacy account continuity

Pre-phone email/password accounts are not silently duplicated or converted. The login UI exposes a controlled legacy path:

EMAIL/PASSWORD → authenticated legacy session → WhatsApp phone verification → server-side Auth phone binding

The legacy flow:
- requires an authenticated session and a confirmed account email;
- accepts Egyptian mobile numbers only;
- uses Twilio Verify with an explicit `whatsapp` channel;
- does not use `signInWithOtp(phone)`, preventing accidental creation of a second phone-auth account;
- confirms the external verification before calling server-side `updateUserById`;
- synchronizes the private profile phone and fails closed if synchronization cannot complete;
- never grants marketplace trust until `auth.users.phone_confirmed_at` and the Egyptian phone contract are both satisfied.

Twilio Verify can have WhatsApp-to-SMS fallback depending on service configuration. DEBA must use a Verify Service with SMS fallback disabled; otherwise the legacy flow is not release-cleared.

## Runtime status

This branch is CODE READY / NOT PRODUCTION ACTIVATED.

Local tests, build, browser E2E and real WhatsApp delivery must be verified after the repository is available in the development environment and the provider configuration exists.

## Seller trust projection

Listing detail trust is evidence-backed: phone trust comes from `auth.users.phone_confirmed_at` projected to `profiles.phone_verified`; seller verification and ratings come from the existing seller verification/rating summary. No generic trusted-seller badge is shown without corresponding evidence.


## Verification checkpoint

2026-10-07: Phase D verification workflow is configured for branch pushes, pull-request synchronization, and manual dispatch. A new code/configuration change invalidates prior green CI evidence until the current head is verified.


## Realtime presence security

Presence uses per-user private Realtime topics. Authenticated clients may observe presence topics, but publication is restricted by RLS to the topic matching `auth.uid()`. Production activation also requires Realtime private-channel authorization to be enabled at the project level.


## Messaging abuse signals

The existing message pipeline now annotates deterministic advisory signals for unusually rapid bursts and repeated identical content. These signals do not automatically accuse or ban a user; they become evidence for moderation and abuse analysis through the existing chat security event stream.


## Duplicate-listing defense

At listing insertion, DEBA now computes an advisory `possible_duplicate_listing` signal for the same owner/category when a recently created listing has very high normalized-title similarity and a nearby price. It does not auto-block the seller; moderation retains the final decision path.


## 2026-10-07 verification checkpoint

- GitHub Actions now produces a real Push-triggered `verify` run on the Phase D branch. Check Runs confirmed success through dependency installation, release preflight, Phase D contracts, full regression contracts, Playwright collection, typecheck and build.
- A production-safe transaction dry-run of `20261004140000_phase_d_phone_identity.sql` initially exposed a missing `cron.job` relation because `pg_cron` was available but not enabled in the live project. The migration was corrected to enable `pg_cron` before using `cron.job`/`cron.schedule`; the full dry-run then completed successfully and was rolled back, leaving production unchanged.
- The dry-run also exercised the phone-trust boundary against an existing unverified Auth user: the marketplace phone guard rejected the user, `profiles.phone_verified` could not be self-asserted, direct private-phone mutation was rejected, and `start_seller_verification` remained blocked. The entire probe was rolled back.
- The production project still has one legacy private profile phone value outside the new Egyptian E.164 contract, with no corresponding Auth phone. It remains preserved and is not auto-mutated.


## 2026-10-07 legacy continuity implementation checkpoint

The controlled legacy account phone-linking path is implemented on the Phase D branch:
- `src/lib/auth/legacyPhoneVerification.ts`
- `src/app/api/auth/legacy-phone/send/route.ts`
- `src/app/api/auth/legacy-phone/verify/route.ts`
- legacy account UI state within `src/app/(auth)/login/page.tsx`
- contract coverage within `tests/phase-d-phone-whatsapp-auth.test.mjs`

It is intentionally provider-gated. No Twilio secret is present in browser code, and production configuration remains untouched.


## 2026-10-07 Auth phone-change hygiene checkpoint

Production read-only inspection found two unconfirmed `auth.users.phone_change` values with no `phone_change_sent_at`. A rollback-only probe confirmed the Phase D migration's cleanup clause would clear both rows and leave zero matching abandoned attempts.

No persistent production mutation was performed. The Phase D migration now:
- clears abandoned unconfirmed `phone_change` state with no delivery timestamp during activation;
- clears stale unconfirmed phone-change state older than the configured grace period;
- runs the cleanup hourly via `pg_cron`.

This prevents abandoned `phone_change` rows from interfering with later verified-phone linking.
