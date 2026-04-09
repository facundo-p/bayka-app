---
phase: 09-testing-strategy
plan: "05"
subsystem: mobile/tests/repositories mobile/tests/services mobile/tests/hooks
tags: [tests, unit-tests, repositories, hooks, mocks, tdd]
dependency_graph:
  requires:
    - 09-01 (test infrastructure: better-sqlite3, networkHelper, factories)
    - 09-02 (useTreeRegistration hook)
    - 09-03 (extracted hooks)
  provides:
    - Unit tests for TreeRepository (all public methods)
    - Unit tests for PlantationSpeciesRepository (getSpeciesForPlantation)
    - Unit tests for UserSpeciesOrderRepository (get, save, overwrite)
    - Unit tests for PhotoService (launchCamera, launchGallery)
    - Unit tests for useAuth (online/offline sign in, signOut, role)
    - Unit tests for useSync (startSync, startPull, state transitions)
    - Unit tests for useTreeRegistration (registerTree, undoLast, executeFinalize, derived state)
  affects:
    - Increases test coverage from critical-gap status to covered for all listed modules
tech_stack:
  added: []
  patterns:
    - jest.mock + lazy db getter pattern for Drizzle ORM (get db() pattern)
    - mockState shared object pattern for jest.mock factory closures (PhotoService)
    - constructor function mocks for class-based APIs (expo-file-system File/Directory)
    - renderHook + act from @testing-library/react-native for hook testing
    - networkHelper setOffline/setOnline for offline path testing
key_files:
  created:
    - mobile/tests/repositories/TreeRepository.test.ts
    - mobile/tests/repositories/PlantationSpeciesRepository.test.ts
    - mobile/tests/repositories/UserSpeciesOrderRepository.test.ts
    - mobile/tests/services/PhotoService.test.ts
    - mobile/tests/hooks/useAuth.test.ts
    - mobile/tests/hooks/useSync.test.ts
    - mobile/tests/hooks/useTreeRegistration.test.ts
  modified: []
decisions:
  - "Used 'get db()' getter pattern in jest.mock factory so tests can reassign mockDb between test cases without the mock capturing a stale reference"
  - "PhotoService uses new expo-file-system API (File/Directory classes) — mocked using constructor functions (not jest.fn().mockImplementation) so 'new Directory()' works"
  - "mockState shared object pattern in PhotoService test: jest.mock factories are hoisted but closures over module-scope objects still work because references are resolved at call time"
  - "useAuth tests mock supabase/client, supabase/auth, OfflineAuthService, SecureStore, and NetInfo separately — hook is fully testable via renderHook without rendering components"
  - "useTreeRegistration tests mock useTrees, useLiveData, and canEdit independently — allows testing isReadOnly and canReactivate derivations without DB calls"
metrics:
  duration: "~35min"
  completed_date: "2026-04-09"
  tasks: 2
  files: 7
---

# Phase 09 Plan 05: Critical Unit Test Coverage Summary

Filled unit test gaps for untested repositories, PhotoService, and key hooks (useAuth, useSync, useTreeRegistration). Added 7 new test files with 29 total test cases. Full test suite remains green (35 suites, 248 tests).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Unit tests for untested repositories and PhotoService | ea28f8e | 4 new test files (TreeRepository, PlantationSpeciesRepository, UserSpeciesOrderRepository, PhotoService) |
| 2 | Unit tests for useAuth, useSync, useTreeRegistration hooks | 5123df9 | 3 new test files (useAuth, useSync, useTreeRegistration) |

## What Was Built

**7 new test files, 29+ test cases:**

**Repository tests (mock-based):**
- `TreeRepository.test.ts` — 12 tests: insertTree (position auto-increment, null especieId for N/N, subId generation, notifyDataChanged), deleteLastTree (highest posicion, empty subgroup), reverseTreeOrder (transaction, all updated, empty), resolveNNTree (update + no-op), updateTreePhoto, deleteTreeAndRecalculate
- `PlantationSpeciesRepository.test.ts` — 4 tests: getSpeciesForPlantation (returns joined rows, empty, innerJoin verified, field presence)
- `UserSpeciesOrderRepository.test.ts` — 5 tests: getUserSpeciesOrder (returns order, empty), saveUserSpeciesOrder (delete+insert, notifyDataChanged, overwrite, empty items skip insert, correct userId/plantacionId)

**Service tests:**
- `PhotoService.test.ts` — 7 tests: launchCamera (denied, canceled, copy to document, create dir when absent), launchGallery (denied, canceled, copy to document)

**Hook tests:**
- `useAuth.test.ts` — 8 tests: online signIn (calls signInWithPassword, caches credential), offline fallback (verifyCredential, no credentials error, expired error), signOut (clears ROLE_KEY, nulls session), role from SecureStore cache
- `useSync.test.ts` — 10 tests: startSync (plantacionId arg, state idle→syncing→done, notifyDataChanged in finally, results+hasFailures, no failures), startPull (plantacionId arg, pullSuccess true/false, notifyDataChanged in finally), reset
- `useTreeRegistration.test.ts` — 11 tests: registerTree (correct params, blocked when readOnly, blocked when empty userId), undoLast (called, blocked when readOnly), executeFinalize (calls finalizeSubGroup, navigates back), derived state (isReadOnly, canReactivate, unresolvedNN/totalCount from useTrees)

## Deviations from Plan

### Infrastructure merged from prerequisite branches

**1. [Rule 3 - Blocking] Missing prerequisite branches not yet merged**
- **Found during:** Setup (before Task 1)
- **Issue:** This worktree (agent-a7eec0a9) was branched from `main` before plans 09-01, 09-02, 09-03 were executed. The test helpers (networkHelper, factories), useTreeRegistration hook, and extracted hooks were all on different worktree branches.
- **Fix:** Merged `worktree-agent-a0584f8e` (09-01 test infra) and `worktree-agent-a0cfeb3e` (09-02 hooks) and `worktree-agent-aff345df` (09-03 hooks) into this worktree. Planning file conflicts resolved by keeping `ours`.
- **Commits:** d36289d (09-02 merge), d274ba0 (09-03 merge)

### PhotoService mock pattern deviation

**2. [Rule 1 - Bug] expo-file-system mock using constructor functions not jest.fn()**
- **Found during:** Task 1 - first test run
- **Issue:** `PhotoService.ts` uses `new Directory()` and `new File()` from expo-file-system's new API. The initial mock used `jest.fn().mockImplementation()` for these, but `new` operator requires actual constructor functions.
- **Fix:** Changed to plain `function MockDirectory(){}` / `function MockFile(){}` constructor patterns in the jest.mock factory. Used a `mockState` object to track call counts (since factory closures can't reference module-level variables through hoisting).
- **Files modified:** mobile/tests/services/PhotoService.test.ts
- **Commit:** ea28f8e

## Known Stubs

None. All test files are complete with real assertions.

## Self-Check: PASSED

Verified created files exist:
- mobile/tests/repositories/TreeRepository.test.ts ✓
- mobile/tests/repositories/PlantationSpeciesRepository.test.ts ✓
- mobile/tests/repositories/UserSpeciesOrderRepository.test.ts ✓
- mobile/tests/services/PhotoService.test.ts ✓
- mobile/tests/hooks/useAuth.test.ts ✓
- mobile/tests/hooks/useSync.test.ts ✓
- mobile/tests/hooks/useTreeRegistration.test.ts ✓

Verified commits exist:
- ea28f8e ✓ (task 1 repositories + PhotoService)
- 5123df9 ✓ (task 2 hooks)

Verified full test suite:
- `cd mobile && npx jest --ci` → 35 suites, 248 tests, 0 failures ✓
