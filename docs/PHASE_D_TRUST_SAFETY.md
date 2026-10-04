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

## Safety limitation

Existing legacy accounts were created before phone identity became mandatory. They are not silently duplicated or converted by this branch. A controlled account migration/linking procedure is required for those accounts.

## Runtime status

This branch is CODE READY / NOT PRODUCTION ACTIVATED.

Local tests, build, browser E2E and real WhatsApp delivery must be verified after the repository is available in the development environment and the provider configuration exists.

## Seller trust projection

Listing detail trust is evidence-backed: phone trust comes from `auth.users.phone_confirmed_at` projected to `profiles.phone_verified`; seller verification and ratings come from the existing seller verification/rating summary. No generic trusted-seller badge is shown without corresponding evidence.


## Verification checkpoint

2026-10-04: Phase D workflow is configured for branch pushes and pull requests; GitHub run visibility remains an external verification gate until a run is observed.


## Realtime presence security

Presence uses per-user private Realtime topics. Authenticated clients may observe presence topics, but publication is restricted by RLS to the topic matching `auth.uid()`. Production activation also requires Realtime private-channel authorization to be enabled at the project level.


## Messaging abuse signals

The existing message pipeline now annotates deterministic advisory signals for unusually rapid bursts and repeated identical content. These signals do not automatically accuse or ban a user; they become evidence for moderation and abuse analysis through the existing chat security event stream.


## Duplicate-listing defense

At listing insertion, DEBA now computes an advisory `possible_duplicate_listing` signal for the same owner/category when a recently created listing has very high normalized-title similarity and a nearby price. It does not auto-block the seller; moderation retains the final decision path.
