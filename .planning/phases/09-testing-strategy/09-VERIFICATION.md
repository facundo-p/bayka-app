---
phase: 09-testing-strategy
verified: 2026-04-09T20:25:06Z
status: gaps_found
score: 4/7 must-haves verified
gaps:
  - truth: "All screen files comply with CLAUDE.md rule 9 (no direct data imports)"
    status: failed
    reason: "TreeRegistrationScreen.tsx and PlantationDetailScreen.tsx still import directly from repositories/queries/services. TreeRegistrationScreen imports launchCamera/launchGallery from services/PhotoService, getSubgroupById from queries, saveUserSpeciesOrder from repositories. PlantationDetailScreen imports getPlantationEstado from queries/adminQueries."
    artifacts:
      - path: "mobile/src/screens/TreeRegistrationScreen.tsx"
        issue: "Imports insertTree, deleteLastTree, reverseTreeOrder, finalizeSubGroup from TreeRepository/SubGroupRepository directly; imports launchCamera/launchGallery from PhotoService; imports getSubgroupById from queries; imports saveUserSpeciesOrder from UserSpeciesOrderRepository. Still 1054 lines (original). Never refactored."
      - path: "mobile/src/screens/PlantationDetailScreen.tsx"
        issue: "Imports getPlantationEstado from queries/adminQueries directly. Does not import usePlantationDetail hook at all. Still 609 lines."
    missing:
      - "Complete TreeRegistrationScreen refactor: wire useTreeRegistration, useNNFlow, useSpeciesOrder hooks into the screen and remove all direct repository/query/service imports"
      - "Wire SpeciesGrid, LastThreeTrees, TreeRegistrationHeader components into TreeRegistrationScreen"
      - "Complete PlantationDetailScreen refactor: wire usePlantationDetail hook and remove getPlantationEstado direct import"
      - "Reduce TreeRegistrationScreen to under 300 lines"
      - "Reduce PlantationDetailScreen to under 350 lines"
  - truth: "TreeRegistrationScreen under 300 lines, AdminScreen under 350 lines"
    status: failed
    reason: "TreeRegistrationScreen.tsx is 1054 lines (unchanged from pre-phase). PlantationDetailScreen.tsx is 609 lines (exceeds 350 limit for Plan 03). AdminScreen.tsx is 333 lines (PASSES). The hooks (useTreeRegistration, useSpeciesOrder, useNNFlow) were created but never wired into TreeRegistrationScreen — screen and hooks coexist without connection."
    artifacts:
      - path: "mobile/src/screens/TreeRegistrationScreen.tsx"
        issue: "1054 lines — identical to pre-phase. Extracted hooks exist but are ORPHANED (screen never imports them)."
      - path: "mobile/src/screens/PlantationDetailScreen.tsx"
        issue: "609 lines — exceeds 350 line limit. usePlantationDetail hook exists but is not imported by the screen."
    missing:
      - "Rewrite TreeRegistrationScreen.tsx as thin composition layer using useTreeRegistration + useNNFlow + useSpeciesOrder + extracted components"
      - "Slim PlantationDetailScreen.tsx to under 350 lines by wiring usePlantationDetail"
  - truth: "Offline auth cycle fully tested: online login caches credentials, offline signOut clears session (not tokens), offline signIn restores session from cache, cross-instance broadcast works"
    status: partial
    reason: "offlineAuthCycle integration test (plan 04 requirement) is absent. The unit test (useAuth.test.ts) covers online signIn, offline signIn, TTL expiry, and signOut — but uses mocked OfflineAuthService. Cross-instance broadcast test is missing from useAuth.test.ts. The integration-level test with real OfflineAuthService (verifying actual SHA-256 hashing) was never created."
    artifacts:
      - path: "mobile/tests/integration/offlineAuthCycle.test.ts"
        issue: "MISSING — file does not exist. Required by plan 04 and ROADMAP success criterion #7."
    missing:
      - "Create mobile/tests/integration/offlineAuthCycle.test.ts with real OfflineAuthService (not mocked), covering the full cycle"
      - "Add cross-instance broadcast test to mobile/tests/hooks/useAuth.test.ts"
---

# Phase 9: Testing Strategy Verification Report

**Phase Goal:** Refactor critical code for testability (eliminate duplication, decompose large screens), then implement comprehensive testing covering offline operations, sync flows, data integrity, and role-based access. Set up CI/CD pipeline in GitHub Actions.
**Verified:** 2026-04-09T20:25:06Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All screen files comply with CLAUDE.md rule 9 (no direct data imports) | FAILED | TreeRegistrationScreen.tsx has 4 direct data imports; PlantationDetailScreen.tsx has 1 direct query import |
| 2 | TreeRegistrationScreen under 300 lines, AdminScreen under 350 lines | FAILED | TreeRegistrationScreen = 1054 lines (unchanged); PlantationDetailScreen = 609 lines (>350); AdminScreen = 333 lines (PASS) |
| 3 | Integration tests pass against real in-memory SQLite for 5 critical flows | PARTIAL | 5 of 6 planned integration test files exist and pass (subgroup-lifecycle, sync-pipeline, cascade-delete, tree-registration, role-based-access). offlineAuthCycle.test.ts is MISSING. |
| 4 | Unit tests cover all repositories, critical hooks (useAuth, useSync), and services | VERIFIED | TreeRepository, PlantationSpeciesRepository, UserSpeciesOrderRepository, PhotoService, useAuth, useSync, useTreeRegistration all have test files with substantive coverage |
| 5 | 3 Maestro E2E flows exist for critical user journeys | VERIFIED | mobile/.maestro/flows/01-login-offline.yaml, 02-register-tree.yaml, 03-sync-subgroup.yaml all exist with appId + tapOn steps |
| 6 | GitHub Actions CI runs lint + unit + integration on every push, E2E on PR to main | VERIFIED | .github/workflows/ci.yml triggers on all branches (lint, unit, integration jobs). .github/workflows/e2e.yml triggers on PR to main with Maestro on macos-latest. Note: ci-full.yml was replaced by separate e2e.yml — functionally equivalent. |
| 7 | Offline auth cycle fully tested: online login caches → offline signOut clears session → offline signIn restores → cross-instance broadcast | PARTIAL | useAuth.test.ts covers online signIn, offline fallback, TTL expiry, signOut (mocked OfflineAuthService). Cross-instance broadcast NOT tested. offlineAuthCycle integration test with real OfflineAuthService MISSING. |

**Score:** 4/7 truths verified (2 failed, 1 partial for truth #3, 1 partial for truth #7)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mobile/jest.integration.config.js` | Integration test Jest config | VERIFIED | Exists, correct testMatch pattern, setup.integration.ts wired |
| `mobile/tests/setup.integration.ts` | Setup without expo-sqlite mocks | VERIFIED | Exists, comment confirms no expo-sqlite mock |
| `mobile/tests/helpers/integrationDb.ts` | better-sqlite3 DB factory | VERIFIED | Exports createTestDb, closeTestDb, IntegrationDb type |
| `mobile/tests/helpers/factories.ts` | Typed test data factories | VERIFIED | Exports createTestPlantation, createTestSubGroup, createTestTree, createTestSpecies |
| `mobile/tests/helpers/networkHelper.ts` | Offline/online simulation | VERIFIED | Exports setOffline, setOnline |
| `.github/workflows/ci.yml` | Branch push CI pipeline | VERIFIED | lint + unit + integration jobs, triggers on push to all branches + PR to main |
| `.github/workflows/e2e.yml` | E2E pipeline (plan named ci-full.yml) | VERIFIED | Exists as e2e.yml, triggers on PR to main, macos-latest runner, Maestro test command |
| `mobile/src/hooks/useTreeRegistration.ts` | Tree CRUD logic hook | ORPHANED | Exists (225 lines), substantive, but TreeRegistrationScreen does NOT import it |
| `mobile/src/hooks/useSpeciesOrder.ts` | Species ordering hook | ORPHANED | Exists (51 lines), but TreeRegistrationScreen does NOT import it |
| `mobile/src/hooks/useNNFlow.ts` | N/N flow hook | ORPHANED | Exists (47 lines), but TreeRegistrationScreen does NOT import it |
| `mobile/src/components/SpeciesGrid.tsx` | Species button grid component | MISSING | File does not exist. SpeciesButtonGrid.tsx exists but is a different component. |
| `mobile/src/components/LastThreeTrees.tsx` | Last 3 trees display | VERIFIED | Exists (wiring to TreeRegistrationScreen: not found, but SpeciesButtonGrid covers species display in tree screen) |
| `mobile/src/components/TreeRegistrationHeader.tsx` | Registration header | VERIFIED | Exists |
| `mobile/src/hooks/usePlantationAdmin.ts` | Admin plantation hook | VERIFIED | Exists (309 lines), AdminScreen imports and uses it |
| `mobile/src/hooks/usePlantationDetail.ts` | Plantation detail hook | ORPHANED | Exists (154 lines), but PlantationDetailScreen does NOT import it |
| `mobile/src/hooks/useSpeciesConfig.ts` | Species config hook | VERIFIED | Exists (142 lines) |
| `mobile/src/hooks/useCatalog.ts` | Catalog hook | VERIFIED | Exists (171 lines) |
| `mobile/src/hooks/useNNResolution.ts` | NN resolution hook | VERIFIED | Exists (139 lines) |
| `mobile/src/hooks/useAssignTechnicians.ts` | Assign technicians hook | VERIFIED | Exists (143 lines) |
| `mobile/tests/integration/subgroup-lifecycle.test.ts` | SubGroup lifecycle tests | VERIFIED | Exists (125 lines), uses createTestDb + factories |
| `mobile/tests/integration/sync-pipeline.test.ts` | Sync pipeline tests | VERIFIED | Exists (162 lines) |
| `mobile/tests/integration/cascade-delete.test.ts` | Cascade delete tests | VERIFIED | Exists (191 lines) |
| `mobile/tests/integration/tree-registration.test.ts` | Tree registration tests | VERIFIED | Exists (261 lines) |
| `mobile/tests/integration/role-based-access.test.ts` | Role-based access tests | VERIFIED | Exists (188 lines) |
| `mobile/tests/integration/offlineAuthCycle.test.ts` | Offline auth cycle integration | MISSING | Does not exist — required by plan 04 and ROADMAP SC#7 |
| `mobile/tests/hooks/useAuth.test.ts` | useAuth unit tests | PARTIAL | Exists (228 lines), 8 test cases. Covers online signIn, offline fallback, TTL expiry, signOut. MISSING: cross-instance broadcast test. |
| `mobile/tests/hooks/useSync.test.ts` | useSync unit tests | VERIFIED | Exists (194 lines) |
| `mobile/tests/hooks/useTreeRegistration.test.ts` | useTreeRegistration unit tests | VERIFIED | Exists (225 lines) |
| `mobile/tests/repositories/TreeRepository.test.ts` | TreeRepository unit tests | VERIFIED | Exists (317 lines) |
| `mobile/maestro/.maestro/flows/01-login-offline.yaml` | Login E2E flow | VERIFIED | Exists at mobile/.maestro/flows/01-login-offline.yaml, contains appId + tapOn |
| `mobile/maestro/.maestro/flows/02-register-tree.yaml` | Tree registration E2E flow | VERIFIED | Exists, contains tapOn steps |
| `mobile/maestro/.maestro/flows/03-sync-subgroup.yaml` | Sync subgroup E2E flow | VERIFIED | Exists, contains tapOn steps |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `jest.integration.config.js` | `tests/setup.integration.ts` | setupFilesAfterEnv | WIRED | `setupFilesAfterEnv: ['./tests/setup.integration.ts']` confirmed |
| `tests/helpers/integrationDb.ts` | `src/database/schema` | drizzle + better-sqlite3 | WIRED | Uses drizzle(sqlite, { schema }) with better-sqlite3 in-memory DB |
| `tests/integration/*.test.ts` | `tests/helpers/integrationDb.ts` | createTestDb import | WIRED | Confirmed in subgroup-lifecycle.test.ts: `import { createTestDb, closeTestDb }` |
| `TreeRegistrationScreen.tsx` | `hooks/useTreeRegistration.ts` | hook import | NOT WIRED | Screen does not import useTreeRegistration; still uses repository functions directly |
| `TreeRegistrationScreen.tsx` | `hooks/useNNFlow.ts` | hook import | NOT WIRED | Screen does not import useNNFlow |
| `TreeRegistrationScreen.tsx` | `hooks/useSpeciesOrder.ts` | hook import | NOT WIRED | Screen does not import useSpeciesOrder |
| `PlantationDetailScreen.tsx` | `hooks/usePlantationDetail.ts` | hook import | NOT WIRED | Screen does not import usePlantationDetail |
| `AdminScreen.tsx` | `hooks/usePlantationAdmin.ts` | hook import | WIRED | `import { usePlantationAdmin } from '../hooks/usePlantationAdmin'` confirmed |
| `.github/workflows/ci.yml` | unit tests | `npx jest --ci` | WIRED | Job present with `npm rebuild better-sqlite3` + jest call |
| `.github/workflows/e2e.yml` | maestro flows | `maestro test mobile/.maestro/flows/` | WIRED | E2E job runs `maestro test mobile/.maestro/flows/` |
| `login.tsx` (app/(auth)/login.tsx) | testID props | testID attributes | WIRED | testID="email-input", "password-input", "login-button" present |
| `src/components/SpeciesButtonGrid.tsx` | testID props | testID on species buttons | WIRED | `testID={species-btn-${speciesItem.codigo}}`, `testID="nn-button"` present |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces test infrastructure, not UI components with dynamic data rendering.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Integration test config resolves to integration tests only | `grep testMatch jest.integration.config.js` | `**/tests/integration/**/*.test.ts` | PASS |
| better-sqlite3 installed as devDependency | `grep better-sqlite3 package.json` | `"better-sqlite3": "^12.8.0"` | PASS |
| CI workflow triggers on all branches | `grep -A4 'on:' ci.yml` | push branches: `'**'` | PASS |
| E2E workflow triggers on PR to main | `grep -A6 'on:' e2e.yml` | pull_request to main | PASS |
| Maestro flows reference correct testIDs | `grep testID SpeciesButtonGrid.tsx` | `species-btn-${codigo}`, `nn-button` | PASS |
| TreeRegistrationScreen uses extracted hooks | `grep import.*useTreeRegistration TreeRegistrationScreen.tsx` | No match | FAIL |
| TreeRegistrationScreen under 300 lines | `wc -l TreeRegistrationScreen.tsx` | 1054 lines | FAIL |
| PlantationDetailScreen imports usePlantationDetail | `grep usePlantationDetail PlantationDetailScreen.tsx` | No match | FAIL |
| offlineAuthCycle integration test exists | `ls tests/integration/offlineAuthCycle.test.ts` | MISSING | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description (derived) | Status | Evidence |
|-------------|------------|----------------------|--------|----------|
| TEST-INFRA | 09-01 | Integration test infrastructure: better-sqlite3, helpers, config, factories | SATISFIED | jest.integration.config.js, setup.integration.ts, integrationDb.ts, factories.ts, networkHelper.ts all exist and are wired |
| TEST-REFACTOR | 09-02, 09-03 | Screen refactors: screens under line limits, CLAUDE.md rule 9 compliance | BLOCKED | TreeRegistrationScreen (1054 lines, 4 direct data imports) and PlantationDetailScreen (609 lines, 1 direct query import) violate both size and rule 9 requirements. Extracted hooks are ORPHANED. AdminScreen (333 lines, zero violations) PASSES. |
| TEST-INTEGRATION | 09-04 | Integration tests for 5+ flows with real SQLite | PARTIAL | 5 of 6 planned integration tests exist (subgroup-lifecycle, sync-pipeline, cascade-delete, tree-registration, role-based-access). offlineAuthCycle.test.ts MISSING. |
| TEST-UNIT | 09-05 | Unit tests for repositories, hooks, services | PARTIAL | All 7 planned unit test files exist. useAuth.test.ts missing cross-instance broadcast test. Otherwise substantive. |
| TEST-E2E | 09-06 | 3 Maestro E2E flows, testIDs on interactive elements | SATISFIED | 3 YAML flows exist in mobile/.maestro/flows/. testIDs present on login screen and SpeciesButtonGrid. |
| TEST-CI | 09-01 | GitHub Actions CI: lint + unit + integration on every push | SATISFIED | ci.yml triggers on push to all branches with lint, unit, integration jobs. |
| TEST-CI-E2E | 09-01 | GitHub Actions E2E on PR to main, macOS runner | SATISFIED | e2e.yml triggers on PR to main with macos-latest runner and Maestro test command. Note: PLAN specified ci-full.yml but file was implemented as e2e.yml — intent satisfied. |

**ORPHANED REQUIREMENTS:** The TEST-* requirement IDs are phase-internal (not in REQUIREMENTS.md). No orphaned requirements from REQUIREMENTS.md map to Phase 9.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `mobile/src/screens/TreeRegistrationScreen.tsx` | 1054 lines — unchanged from pre-phase; imports 4 direct data layer dependencies | BLOCKER | Violates CLAUDE.md rule 9; TEST-REFACTOR requirement not satisfied; hooks created for this screen are orphaned |
| `mobile/src/screens/PlantationDetailScreen.tsx` | 609 lines; imports `getPlantationEstado` from queries/adminQueries directly; `usePlantationDetail` hook not wired | BLOCKER | Partial TEST-REFACTOR violation |
| `mobile/src/hooks/useTreeRegistration.ts`, `useNNFlow.ts`, `useSpeciesOrder.ts` | Hooks exist (225+51+47 lines) but are never imported by any screen | WARNING | Dead code risk — extracted but orphaned |
| `mobile/src/components/SpeciesGrid.tsx` | File does not exist (plan artifact) — replaced by existing `SpeciesButtonGrid.tsx` | WARNING | Plan artifact naming mismatch; actual component works correctly as SpeciesButtonGrid.tsx |
| `mobile/tests/integration/` | offlineAuthCycle.test.ts missing — ROADMAP SC#7 specifically calls for integration-level test with real OfflineAuthService | BLOCKER | ROADMAP success criterion #7 not fully satisfied |
| `mobile/tests/hooks/useAuth.test.ts` | Missing cross-instance broadcast test (`authChangeListeners` propagation across hook instances) | WARNING | Partial gap in success criterion #7 |

### Human Verification Required

#### 1. Integration test suite passing

**Test:** Run `cd mobile && npx jest --config jest.integration.config.js --ci --no-coverage` against the current codebase.
**Expected:** All 5 integration test files pass (25 tests per the provided context).
**Why human:** The provided context confirms "25 tests, all passing" but this was documented before the verification date. Confirm the suite still passes with the current code state.

#### 2. Unit test suite passing

**Test:** Run `cd mobile && npx jest --ci --no-coverage` (excluding integration).
**Expected:** 35 suites, 248 tests, all passing.
**Why human:** Provided context says this was passing; confirm no regression from any commits since then.

### Gaps Summary

Three blockers prevent the phase goal from being achieved:

**Blocker 1 — TreeRegistrationScreen refactor incomplete (TEST-REFACTOR / SC#1 and SC#2):**
The three hooks (`useTreeRegistration`, `useNNFlow`, `useSpeciesOrder`) and three components (`LastThreeTrees`, `TreeRegistrationHeader`, and effectively `SpeciesButtonGrid`) were created as planned, but the actual refactor of `TreeRegistrationScreen.tsx` was never completed. The screen remains at 1054 lines and still directly imports from `TreeRepository`, `SubGroupRepository`, `PhotoService`, and `plantationDetailQueries`. The extracted hooks are dead code — they exist but are never used.

**Blocker 2 — PlantationDetailScreen partially refactored (TEST-REFACTOR / SC#1):**
`usePlantationDetail` was created (154 lines) but `PlantationDetailScreen.tsx` (609 lines) never imports or uses it. The screen still directly calls `getPlantationEstado` from `adminQueries`. This is a wiring failure — the hook is orphaned.

**Blocker 3 — Offline auth cycle integration test missing (TEST-INTEGRATION / SC#7):**
`offlineAuthCycle.test.ts` does not exist in `mobile/tests/integration/`. The ROADMAP success criterion #7 requires this test to use the real `OfflineAuthService` implementation (not mocked) to validate the full cycle: online login caches SHA-256 hash → signOut clears session but not tokens → offline signIn verifies hash and restores session → cross-instance broadcast works. The unit-level `useAuth.test.ts` covers parts of this with a mocked `OfflineAuthService`, but the cross-instance broadcast test case is also missing from that file.

**Root cause for Blockers 1 and 2:** Hooks and components were created in separate plans (02, 03), but the final wiring step — actually replacing the direct repository calls in the screens with the hook calls — was either not executed or not completed. The plan documents show the intent but the actual file evidence shows the screens were not updated to use their extracted hooks.

---

_Verified: 2026-04-09T20:25:06Z_
_Verifier: Claude (gsd-verifier)_
