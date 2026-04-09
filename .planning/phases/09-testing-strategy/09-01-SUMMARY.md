---
phase: 09-testing-strategy
plan: 01
subsystem: testing
tags: [better-sqlite3, jest, integration-tests, ci, github-actions, react-native]

# Dependency graph
requires:
  - phase: 08-login-offline
    provides: OfflineAuthService, useProfileData hook
  - phase: 05-ux-improvements
    provides: freshnessQueries, useNetStatus, useProfileData
provides:
  - Integration test infrastructure with real in-memory SQLite (better-sqlite3)
  - Separate jest.integration.config.js for integration vs unit test runs
  - Test helper factories for plantation/subgroup/tree/species test data
  - Network helper (setOffline/setOnline) for centralized mock toggling
  - GitHub Actions CI pipeline with 3 parallel jobs
  - All 184 tests passing (4 previously failing tests fixed)
affects: [10-offline-plantation, future test plans]

# Tech tracking
tech-stack:
  added: [better-sqlite3 ^12.8.0, @types/better-sqlite3 ^7.6.13]
  patterns:
    - Separate jest config files for unit vs integration (jest.config.js / jest.integration.config.js)
    - Factory function pattern for test data with typed overrides
    - Centralized network mock helpers (setOffline/setOnline)
    - drizzle-orm/better-sqlite3 with migrate() for real schema in integration tests

key-files:
  created:
    - mobile/jest.integration.config.js
    - mobile/tests/setup.integration.ts
    - mobile/tests/helpers/integrationDb.ts
    - mobile/tests/helpers/factories.ts
    - mobile/tests/helpers/networkHelper.ts
    - .github/workflows/ci.yml
  modified:
    - mobile/package.json
    - mobile/tests/database/seed.test.ts
    - mobile/tests/hooks/useProfileData.test.ts

key-decisions:
  - "jest.integration.config.js extends base config but overrides testMatch and setupFilesAfterEnv — no expo-sqlite mock in integration setup"
  - "seed.test.ts: db mock requires delete() and update() mock chains re-attached in beforeEach after jest.clearAllMocks()"
  - "useProfileData.test.ts: hook uses single Supabase joined query (organizations embedded in profiles response) — test mock provides organizations nested in profiles data"
  - "GitHub Actions integration job runs npm rebuild better-sqlite3 to compile native module for current Node version"
  - "CI lint job uses tsc --noEmit only (no ESLint config exists in project)"

patterns-established:
  - "Integration DB pattern: createTestDb() returns {db, sqlite}; closeTestDb(sqlite) in afterEach"
  - "Factory pattern: createTestX(overrides?) with crypto.randomUUID() IDs for uniqueness per test"
  - "Network mock pattern: import {setOffline, setOnline} from tests/helpers/networkHelper"

requirements-completed: [TEST-INFRA, TEST-CI]

# Metrics
duration: 18min
completed: 2026-04-08
---

# Phase 09 Plan 01: Testing Infrastructure Summary

**better-sqlite3 integration test foundation with factory helpers, centralized network mocks, all 184 tests passing, and GitHub Actions CI pipeline**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Installed better-sqlite3 + types, created jest.integration.config.js for real-SQLite integration tests
- Created 3 test helper modules: integrationDb (createTestDb/closeTestDb), factories (4 factory functions), networkHelper (setOffline/setOnline)
- Fixed 4 failing tests across 2 test suites — seed.test.ts (db.delete mock chain) and useProfileData.test.ts (joined Supabase query mock + waitFor)
- Created GitHub Actions CI with 3 parallel jobs (lint/tsc, unit, integration) triggered on push and PR to main

## Task Commits

1. **Task 1: Install better-sqlite3, test helpers, fix failing tests** - `cf88362` (feat)
2. **Task 2: GitHub Actions CI pipeline** - `a994fd2` (chore)

## Files Created/Modified

- `mobile/jest.integration.config.js` - Separate Jest config for integration tests (testMatch: tests/integration/**)
- `mobile/tests/setup.integration.ts` - Integration setup WITHOUT expo-sqlite mock
- `mobile/tests/helpers/integrationDb.ts` - createTestDb/closeTestDb using better-sqlite3 + drizzle migrator
- `mobile/tests/helpers/factories.ts` - createTestPlantation, createTestSubGroup, createTestTree, createTestSpecies with typed overrides
- `mobile/tests/helpers/networkHelper.ts` - setOffline/setOnline NetInfo mock helpers
- `.github/workflows/ci.yml` - CI with lint, unit, integration parallel jobs
- `mobile/package.json` - Added better-sqlite3 and @types/better-sqlite3 devDependencies
- `mobile/tests/database/seed.test.ts` - Fixed: add delete/update mock chains, re-attach in beforeEach
- `mobile/tests/hooks/useProfileData.test.ts` - Fixed: nested organizations in profiles mock, use waitFor

## Decisions Made

- seed.test.ts mock uses getter pattern (`get db()`) to avoid jest.mock factory capturing stale references; mock chains re-attached in beforeEach after clearAllMocks
- useProfileData hook uses a single Supabase relationship join (not two separate from() calls) — mock updated to include `organizations` nested in profiles response
- CI lint step uses `npx tsc --noEmit` only; no ESLint step (project has no eslint config)
- Integration tests path pattern `tests/integration/**` is ready for future integration tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] seed.test.ts mock needed different pattern for clearAllMocks compatibility**
- **Found during:** Task 1 (Fix failing tests)
- **Issue:** The original plan suggested `jest.fn().mockReturnValue(...)` inline in jest.mock factory, but after `jest.clearAllMocks()` the implementations are cleared. The mock chains (delete, update) became undefined after `clearAllMocks` in beforeEach.
- **Fix:** Used `get db()` getter pattern for the mock so the mockDb object is always freshly accessed; re-attached all mock chain implementations in beforeEach
- **Files modified:** mobile/tests/database/seed.test.ts
- **Verification:** Test passes — 3 seed tests pass
- **Committed in:** cf88362 (Task 1 commit)

**2. [Rule 1 - Bug] useProfileData.test.ts mock mismatch with actual hook implementation**
- **Found during:** Task 1 (Fix failing tests)
- **Issue:** Test mocked `supabase.from('organizations')` as a separate call, but the hook uses a single joined query `from('profiles').select('...organizations(nombre)')` — organizations data comes nested in profiles response
- **Fix:** Updated mock to include `organizations: { nombre: 'Org Test' }` nested inside profiles response data; switched from `await new Promise(setTimeout)` to `waitFor()` for stable async resolution
- **Files modified:** mobile/tests/hooks/useProfileData.test.ts
- **Verification:** All 5 useProfileData tests pass
- **Committed in:** cf88362 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug fixes in test mocks)
**Impact on plan:** Both fixes necessary to make tests reflect actual implementation. No scope creep.

## Issues Encountered

None beyond the mock fixes documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Integration test infrastructure ready: run `npx jest --config jest.integration.config.js --ci` to execute integration tests
- Factory functions ready for use in integration tests (tests/helpers/factories.ts)
- Network helpers ready for offline/online test scenarios
- CI pipeline will run automatically on push/PR
- Next: Plan 09-02 (refactor pass on oversized screens) or integration tests for critical paths

---
*Phase: 09-testing-strategy*
*Completed: 2026-04-08*
