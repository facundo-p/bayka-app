---
phase: 09-testing-strategy
plan: "09"
subsystem: testing
tags: [offline-auth, integration-tests, unit-tests, broadcast]
dependency_graph:
  requires: ["09-04", "09-05"]
  provides: ["TEST-INTEGRATION", "TEST-UNIT"]
  affects: []
tech_stack:
  added: []
  patterns: [in-memory-securestore-simulator, module-level-broadcast-testing]
key_files:
  created:
    - mobile/tests/integration/offlineAuthCycle.test.ts
  modified:
    - mobile/tests/hooks/useAuth.test.ts
decisions:
  - "offlineAuthCycle uses in-memory Map as SecureStore simulator — allows real OfflineAuthService to run with deterministic crypto mocks"
  - "OFFLINE_LOGIN_EXPIRE=false branch: TTL tests verify invariant (always returns false) rather than skipping — keeps tests meaningful for both config states"
  - "Cross-instance broadcast tests use 50ms setTimeout for propagation — authChangeListeners.forEach is synchronous so propagation is immediate, but act() wrapper requires settling"
metrics:
  duration: "5min"
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_modified: 2
---

# Phase 09 Plan 09: Offline Auth Cycle Integration Tests Summary

**One-liner:** Integration test for full offline auth lifecycle (cache/verify/clear/TTL/multi-user) using real OfflineAuthService + cross-instance broadcast unit tests for useAuth.

## What Was Built

### Task 1: offlineAuthCycle.test.ts (integration test)

Created `mobile/tests/integration/offlineAuthCycle.test.ts` with 13 tests covering:

- **Credential caching:** `cacheCredential` stores hashed entries, overwrites on re-cache for same email
- **Credential verification:** correct password returns role, wrong password returns null, unknown email returns null
- **Credential clearing:** `clearCredential` removes entry, subsequent verify returns null
- **Full cycle:** cache -> verify -> clear -> verify fails (end-to-end scenario)
- **Multi-user:** independent credential stores per user, clearing one doesn't affect others
- **TTL expiry:** conditional on `OFFLINE_LOGIN_EXPIRE` config — when false (current config), verifies invariant; when true, validates expiry/window behavior
- **getCachedEmails:** returns all cached email addresses in insertion order

Key design: in-memory `Map` as SecureStore simulator set up in `beforeEach`, allowing real OfflineAuthService crypto operations (mocked via `expo-crypto` mock in `setup.integration.ts`) to work deterministically.

### Task 2: useAuth.test.ts cross-instance broadcast

Added `describe('cross-instance broadcast')` block with 2 tests:

- **signIn broadcasts:** When instance1 signs in offline, instance2 receives session/role update via `authChangeListeners.forEach`
- **signOut broadcasts:** When instance1 signs out, instance2's session/role are cleared to null

Tests render two hook instances via `renderHook`, perform action on instance1, then assert state propagation on instance2.

## Test Results

- `offlineAuthCycle.test.ts`: 13/13 tests pass
- `useAuth.test.ts`: 10/10 tests pass (8 existing + 2 new broadcast tests)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `mobile/tests/integration/offlineAuthCycle.test.ts` exists and passes (13 tests)
- `mobile/tests/hooks/useAuth.test.ts` contains "cross-instance broadcast" (2 new tests)
- Commits: `d8414e9` (Task 1), `0d7d2a6` (Task 2)
