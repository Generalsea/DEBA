# DEBA Phase D — Local Runtime & Browser Verification Runbook

## Preconditions
Run from the real repository root: G:\Deba

Required:
- Node 22.x (repository requires >=22.14.0)
- npm 10.x
- Supabase environment variables configured in .env.local
- A real Egyptian +20 mobile number
- Real WhatsApp delivery configured in the Supabase project
- A second authenticated account for two-user chat/presence testing when available

Do not print OTPs, access tokens, service-role keys, or raw phone numbers into logs or reports.

## Step 1 — clean install and contract suite
    Set-Location "G:\Deba"
    npm ci
    npm test
Expected: exit code 0; C1, Phase D and existing project contracts pass.

## Step 2 — typecheck and production build
    npm run typecheck
    npm run build
Expected: both exit with code 0 and the production build completes.

## Step 3 — local application
Terminal A:
    npm run dev
Expected: http://localhost:3000

## Step 4 — real WhatsApp authentication
1. Enter a real Egyptian mobile number.
2. Request WhatsApp OTP.
3. Confirm that the message arrives in WhatsApp.
4. Enter the real six-digit OTP.
5. Confirm the browser leaves /login.
6. Confirm the Auth session is authenticated.
7. Confirm the account shows هاتف موثّق only after successful verification.
8. Test a wrong OTP.
9. Test resend cooldown.
10. Exceed verification attempts and confirm rate limiting.
Never use a fake/test OTP.

## Step 5 — critical classifieds flow
REGISTER -> LOGIN -> CREATE LISTING -> UPLOAD MEDIA -> PUBLISH -> SEARCH -> FILTER -> VIEW -> SAVE -> CONTACT SELLER -> MESSAGE
Test the happy path and the blocked path for an unverified account.

## Step 6 — two-user communication
- Buyer opens a real published listing.
- Buyer selects تواصل مع البائع.
- Verify a real chat room opens.
- Buyer sends a normal message.
- Seller receives the notification.
- Muted recipient receives no notification.
- Location metadata is lat/lng/accuracy.
- Direct message insertion through the client is rejected.
- Presence changes with the second user's real session.
- Realtime failure shows الحالة غير متاحة, never a false غير متصل.

## Step 7 — negotiable listing / offers
For an offers-enabled listing: buyer sends offer -> seller receives -> seller accepts/counters/declines -> buyer receives the lifecycle result.
For fixed-price listings: no buyer auction panel, no secret floor, no 0 عرض نشط shell, and primary action remains تواصل مع البائع.

## Step 8 — responsive and dark-mode matrix
Test 320, 360, 390, 414, 768, 1024, 1280 and 1440 px.
Inspect RTL alignment, clipped text, overflow, listing cards, product detail, phone OTP, chat, account menu, dialogs, light mode, dark mode, and mobile keyboard reachability.

## Step 9 — evidence to return
- command exit status
- test summary/count
- screenshots for browser/responsive findings
- browser URL used
- whether WhatsApp OTP actually arrived
- whether two-user chat/presence succeeded
- exact errors needed for correction
Do not include secrets or OTP values.

## Completion rule
Do not mark a step PASS without corresponding real evidence. A successful build or static test suite does not equal browser/runtime/provider verification.