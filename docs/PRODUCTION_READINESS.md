# DEBA Production Readiness Register

## Known environment limitation — Supabase leaked-password protection

**Status:** WAIVED / KNOWN ENVIRONMENT LIMITATION

The Supabase Security Advisor currently reports `auth_leaked_password_protection` as a warning for the DEBA project. This control is configured at the Supabase Auth/project environment level and is not enforceable from the DEBA repository alone.

**Decision:** This item is explicitly waived for the current repository-readiness gate. The repository does not claim that leaked-password protection is enabled. The Supabase project settings remain a separate environment remediation item.

**Re-verification requirement:** After the Supabase environment change, rerun the Supabase Security Advisor and record the new evidence here. The waiver must then be removed or renewed explicitly.

**Repository impact:** No application feature is disabled because of this limitation. Authentication and authorization hardening remain required and are tested independently.

## Evidence policy

A readiness item is marked PASS only when the repository or live environment provides direct evidence. WAIVED items are environment exceptions, not equivalent to PASS.

## Active production-readiness work

Authenticated Playwright coverage and a database-enforced offer lifecycle are tracked as part of the transition toward production readiness.
