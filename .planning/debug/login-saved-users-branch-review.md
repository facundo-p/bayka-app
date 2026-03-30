---
status: awaiting_human_verify
trigger: "Analyze all code modifications on the feature/ui-redesign branch to detect errors. Concrete bug: login fails when trying to log in with one of the saved users on the login screen."
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — initializing.current race condition: when user taps saved account quickly, the SIGNED_IN event fires while getSession() IIFE is still running. The handler returns early (initializing.current === true), session is never set, app stays on login screen.
test: traced code path in useAuth.ts onAuthStateChange handler
expecting: fix by removing the initializing.current guard from SIGNED_IN event, or by re-querying session after signIn
next_action: implement fix in useAuth.ts

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: User can tap a saved user on the login screen and log in successfully
actual: Error when trying to log in with a saved user from the login screen
errors: Unknown — user reports login failure but no specific error message provided
reproduction: Open app → login screen → tap a saved user → error occurs
started: After modifications on feature/ui-redesign branch. Previously worked on main.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: network or credentials error
  evidence: signIn is called with saved credentials that worked before; handleLogin path with same credentials would work fine
  timestamp: 2026-03-28T00:01:00Z

- hypothesis: SecureStore not reading saved accounts correctly
  evidence: getSavedAccounts is called on mount and state is populated; selectAccount receives valid account object
  timestamp: 2026-03-28T00:01:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-28T00:01:00Z
  checked: useAuth.ts lines 58-91 — onAuthStateChange handler
  found: handler has guard `if (initializing.current) return;` that skips ALL events (including SIGNED_IN) during init
  implication: if user taps saved account while getSession() IIFE is still running, SIGNED_IN event is silently dropped

- timestamp: 2026-03-28T00:01:00Z
  checked: useAuth.ts lines 22-55 — getSession IIFE with finally block
  found: initializing.current is set to false only in finally{} of getSession() — which runs AFTER supabase.auth.getSession() resolves (network call)
  implication: getSession() can take 100ms–2000ms+; if user taps saved account fast, selectAccount fires signIn before getSession completes

- timestamp: 2026-03-28T00:01:00Z
  checked: login.tsx selectAccount function (added in commit 1f473b3)
  found: the auto-login was ADDED to selectAccount, converting it from a simple pre-fill to a full signIn call. The original function only set email/password state.
  implication: the original flow had no race condition because the user had to manually press "Iniciar sesión" after getSession completed

- timestamp: 2026-03-28T00:01:00Z
  checked: _layout.tsx useEffect dependency on [success, loading, session, role, segments]
  found: navigation to authenticated screens requires both session AND role. If SIGNED_IN is dropped and session stays null, app stays on login screen.
  implication: user sees stuck login screen with loading=false — no error message shown

- timestamp: 2026-03-28T00:01:00Z
  checked: selectAccount does NOT call saveAccount before signing in
  found: handleLogin calls saveAccount(email, password) BEFORE signIn to avoid state loss on unmount. selectAccount skips this entirely.
  implication: secondary bug — if user somehow has an outdated password stored, it would fail silently. More importantly, the auto-login call lacks the same pre-save safety net.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Race condition in useAuth.ts — the `initializing.current` guard in `onAuthStateChange` drops the `SIGNED_IN` event when `selectAccount` triggers `signIn` before `getSession()` IIFE completes. The original code was safe because `selectAccount` only pre-filled form fields; the auto-login was added in commit 1f473b3 without accounting for this guard. When login via saved account happens quickly (before getSession resolves), the SIGNED_IN event is silently discarded, leaving session and role as null, so the app stays stuck on the login screen.

fix: Removed `initializing.current` ref entirely from useAuth.ts. The guard was designed to prevent double-processing of the initial session restore, but the SIGNED_IN handler is idempotent (fetching and setting role/session twice with the same data is harmless). Removing the guard ensures all explicit login events are always processed regardless of timing.

Secondary bug fixed: ExportService.test.ts mock was written for the old expo-file-system API (writeAsStringAsync/cacheDirectory) but ExportService.ts was migrated to the new File/Paths API. Updated the mock to use MockFile constructor and mockWrite, matching the actual production code.

verification: All 123 tests pass (npx jest --no-coverage from mobile/).
files_changed: [mobile/src/hooks/useAuth.ts, mobile/tests/admin/ExportService.test.ts]
