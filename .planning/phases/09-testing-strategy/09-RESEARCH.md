# Phase 9: Testing Strategy - Research

**Researched:** 2026-04-08 (full re-investigation)
**Domain:** React Native / Expo testing — Jest + SQLite integration, Maestro E2E, GitHub Actions CI/CD, screen refactoring
**Confidence:** HIGH (codebase analysis is fresh and direct) / MEDIUM (Maestro CI patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Phase 9 starts with a refactor pass before writing tests: eliminate duplicate code, decompose screen/component files over 500 lines into smaller testable units

**D-02:** Refactor targets: screens and components with excessive length, duplicated patterns between admin/tecnico, any inline logic that should be extracted to repositories/queries/services per CLAUDE.md rule 9

**D-03:** Critical paths first — prioritize: (1) offline flow (cached auth, data persistence), (2) sync pipeline (upload atomicity, download integrity, conflict detection), (3) data integrity (SubGroup lifecycle, cascade delete, tree registration), (4) role-based access (admin vs tecnico data visibility)

**D-04:** Data + service layer only — repositories, queries, services, and key hooks (useAuth, useSync). No screen-level render tests in this phase

**D-05:** Real SQLite integration tests for critical paths — spin up in-memory SQLite, run migrations, test actual queries (sync, cascade delete, SubGroup lifecycle). Replaces mock-only approach for these flows

**D-06:** Maestro E2E for 2-3 critical user journeys: login offline, register tree, sync SubGroup. YAML-based flows

**D-07:** Keep existing Jest unit tests with mocks for fast feedback on individual functions

**D-08:** Centralized test helpers in `tests/helpers/networkHelper.ts`: `setOffline()` / `setOnline()` functions that configure NetInfo mock + Supabase client mock in one place

**D-09:** All offline-dependent tests use the centralized helpers, not inline NetInfo mocks

**D-10:** Factory functions pattern: `createTestPlantation()`, `createTestSubGroup()`, `createTestTree()`, etc. with sensible defaults and optional overrides. Located in `tests/helpers/factories.ts`

**D-11:** Minimal but representative data volumes: 2-3 plantations, 5-10 subgroups, 20-30 trees

**D-12:** GitHub Actions CI triggered on push to any branch AND on PRs to main

**D-13:** Two-tier pipeline:
  - Push to branches: 3 parallel jobs — ESLint/TypeScript check, Jest unit tests, Jest integration tests
  - PR/push to main: Full pipeline — Lint + Unit + Integration + Maestro E2E on simulator (macOS runner)

**D-14:** Branch protection on main — all CI checks required to pass before merge

### Claude's Discretion
- Integration test SQLite setup/teardown mechanics
- Factory function internal implementation and default values
- Maestro flow file organization
- GitHub Actions workflow YAML structure and caching strategy
- Which specific files need refactoring (to be determined by codebase analysis)

### Deferred Ideas (OUT OF SCOPE)
- Performance/load testing with realistic field volumes (1000+ trees) — future phase
- Screen-level render tests with React Native Testing Library — future phase
- Visual regression testing — future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-INFRA | Set up integration test infrastructure (better-sqlite3, jest config split, helper files) | Standard Stack section; Architecture Patterns — Integration DB Setup |
| TEST-REFACTOR | Refactor oversized screens and CLAUDE.md §9 violations before writing tests | Codebase Analysis section; Refactor Targets table |
| TEST-INTEGRATION | Real SQLite integration tests for SubGroup lifecycle, cascade delete, sync atomicity, role-based filtering | Architecture Patterns — Integration Test Patterns |
| TEST-UNIT | Unit tests (mock-based) for critical service/hook layer: useAuth, useSync, SyncService remaining flows | Test Coverage Baseline section; Existing Failing Tests |
| TEST-E2E | Maestro E2E flows for 3 user journeys | Architecture Patterns — Maestro |
| TEST-CI | GitHub Actions CI/CD pipeline — two-tier, triggered on push + PR | Architecture Patterns — CI/CD |
| TEST-CI-E2E | E2E step in CI — macOS runner, Expo prebuild, simulator | Architecture Patterns — CI/CD |
</phase_requirements>

---

## Summary

Phase 9 is split into two sequential concerns: (1) a refactor pass to make the codebase testable and compliant with CLAUDE.md architecture rules, then (2) comprehensive test coverage targeting the data/service layer.

**Refactor first, test second.** The codebase still has 3 screens over 500 lines (TreeRegistrationScreen: 1053, AdminScreen: 925, PlantationDetailScreen: 606) and widespread CLAUDE.md §9 violations where screens directly import from repositories/queries/services. ConfigureSpeciesScreen imports `db` directly on line 28 — the most critical violation. These violations must be corrected before tests are written, or tests will reinforce the wrong architecture.

**Test suite status changed since last research.** The suite grew from 159 to 174 tests and 24 to 26 test files. The OfflineAuthService tests are now PASSING (the test was updated in Phase 8 to accept that `password` IS stored, because the quick-login chip feature intentionally stores plaintext in SecureStore under OS Keychain protection). Two failing suites remain: `seed.test.ts` (3 failing — mock missing `delete` method, plus `seedSpeciesIfNeeded` changed to upsert/sync logic) and `useProfileData.test.ts` (1 failing — hook now uses a single Supabase join query, test mocks two separate calls).

**SyncService grew significantly.** It is now 500 lines (up from 389) after Phase 10 added `pullSpeciesFromServer()`, `uploadOfflinePlantations()`, `downloadPlantation()`, and `batchDownload()`. New tests were added in `SyncService.offline.test.ts` covering these functions. SyncService is at the 500-line boundary and warrants evaluation after screen refactors.

**Integration tests need better-sqlite3.** The pattern from the previous research is confirmed correct: `testEnvironment: 'node'` is already set, `drizzle/migrations.js` exists with all 7 migrations. Install `better-sqlite3` + `@types/better-sqlite3` as dev dependencies.

**Primary recommendation:** Fix the 2 failing test suites in Wave 0 (easy fixes — add `delete` to seed mock, fix useProfileData join query mock). Then execute the refactor pass on the 3 oversized screens. Then add integration test infrastructure and integration tests.

---

## Delta: What Changed Since Previous Research

| Area | Previous State (pre-Phase 10) | Current State | Impact on Plan |
|------|-------------------------------|---------------|----------------|
| Test suite | 24 files, 159 tests, 154 passing, 3 failing (offlineAuth) | 26 files, 174 tests, 170 passing, 4 failing | Wave 0 fix targets changed |
| OfflineAuthService | Had failing tests about plaintext password | Tests now PASS — feature intentionally stores password for quick-login | Remove offlineAuth from Wave 0 fix list |
| SyncService | 389 lines, 4 functions | 500 lines, 8 functions; new: pullSpeciesFromServer, uploadOfflinePlantations, downloadPlantation, batchDownload | SyncService now at 500-line boundary; new offline test file added |
| useAuth | 185 lines, complex offline+TTL logic added | 210 lines; now has: authChangeListeners broadcast, withTimeout(), handleOfflineSignIn(), isOfflineLoginExpired() | useAuth testing is more complex; needs TTL mock |
| OfflineAuthService | 100 lines, basic hash/verify | 113 lines; now has: getCachedPassword(), saveLastOnlineLogin(), isOfflineLoginExpired() + config from offlineLogin.ts | New functions need unit test coverage |
| offlineLogin.ts | Did not exist | New file: `src/config/offlineLogin.ts` — OFFLINE_LOGIN_EXPIRE + OFFLINE_LOGIN_DURATION_HS constants | TTL tests must override these constants |
| useProfileData | Used two separate Supabase calls | Now uses single join query: `.select('nombre, rol, organizacion_id, organizations(nombre)')` | Test mock must return joined structure, not two separate chains |
| seedSpecies | Simple bulk insert if empty | Now does full sync: upsert changes + delete removed species with `db.delete` | Test mock missing `delete` — root cause of 3 seed.test.ts failures |
| SyncService.offline.test.ts | Did not exist | New test file, 7 tests, all PASSING — covers pullSpeciesFromServer + uploadOfflinePlantations | No gap here — already covered |
| AdminScreen | 913 lines | 925 lines | Still primary refactor target |
| SubGroupRepository | 312 lines | 312 lines (unchanged) | No change |
| PlantationRepository | 329 lines | 329 lines (unchanged) | No change |

---

## Codebase Analysis (Fresh Investigation)

### Refactor Targets — Current Line Counts

| File | Lines | Action Required | Priority |
|------|-------|-----------------|----------|
| `src/screens/TreeRegistrationScreen.tsx` | 1053 | Decompose: extract hooks for species ordering, tree CRUD, N/N state, photo flow | HIGH |
| `src/screens/AdminScreen.tsx` | 925 | Decompose: extract usePlantationAdmin hook, separate modal components | HIGH |
| `src/screens/PlantationDetailScreen.tsx` | 606 | Decompose: extract subgroup list logic into useSubgroupDetail hook | HIGH |
| `src/services/SyncService.ts` | 500 | At the limit — evaluate after screen refactors; likely needs extraction of download logic | MEDIUM |
| `src/screens/NNResolutionScreen.tsx` | 413 | Under limit but has direct repository imports | MEDIUM |
| `src/screens/AssignTechniciansScreen.tsx` | 386 | Under limit but has direct query/repository imports | LOW |

### CLAUDE.md §9 Violations — Current State

All screens below directly import from repositories/queries/services. Per D-02, these must be extracted to hooks.

| Screen | Direct Imports (confirmed) | Extraction Target |
|--------|----------------------------|-------------------|
| `AdminScreen.tsx` | `dashboardQueries`, `adminQueries`, `PlantationRepository`, `ExportService` | `usePlantationAdmin` hook |
| `AssignTechniciansScreen.tsx` | `adminQueries`, `PlantationRepository` | `useAssignTechnicians` hook |
| `CatalogScreen.tsx` | `catalogQueries`, `PlantationRepository`, `SyncService` | `useCatalog` hook |
| `ConfigureSpeciesScreen.tsx` | `adminQueries`, `PlantationRepository`, `db` **(direct import of db on line 28!)** | `useSpeciesConfig` hook |
| `NNResolutionScreen.tsx` | `TreeRepository`, `plantationDetailQueries` | `useNNResolution` hook |
| `NuevoSubgrupoScreen.tsx` | `SubGroupRepository` | Expand existing hook or extract `useNewSubgroup` |
| `PlantacionesScreen.tsx` | `freshnessQueries`, `SyncService`, `dashboardQueries` | Hooks already exist — use them exclusively |
| `PlantationDetailScreen.tsx` | `SubGroupRepository`, `plantationDetailQueries`, `adminQueries` | `usePlantationDetail` hook |
| `TreeRegistrationScreen.tsx` | `TreeRepository`, `SubGroupRepository`, `PhotoService`, `plantationDetailQueries`, `UserSpeciesOrderRepository` | Multiple focused hooks |

**Note:** `PerfilScreen.tsx` is CLEAN (185 lines, only uses hooks: useAuth, useProfileData, useNetStatus).

### Test Coverage Baseline (Current — After Phase 10)

**26 test files, 174 tests, 170 passing:**

| Suite | Status | Notes |
|-------|--------|-------|
| `auth/offlineAuth.test.ts` | PASSING | Updated in Phase 8 — now correctly expects `password` field to exist |
| `auth/session.test.ts` | PASSING | |
| `auth/role.test.ts` | PASSING | |
| `auth/logout.test.ts` | PASSING | |
| `auth/multiuser.test.ts` | PASSING | |
| `sync/SyncService.test.ts` | PASSING | |
| `sync/SyncService.offline.test.ts` | PASSING | NEW — covers pullSpeciesFromServer, uploadOfflinePlantations |
| `sync/downloadService.test.ts` | PASSING | |
| `sync/dashboard.test.ts` | PASSING | |
| `admin/adminQueries.test.ts` | PASSING | |
| `admin/ExportService.test.ts` | PASSING | |
| `admin/PlantationRepository.test.ts` | PASSING | |
| `admin/PlantationRepository.offline.test.ts` | PASSING | |
| `queries/catalogQueries.test.ts` | PASSING | |
| `queries/freshnessQueries.test.ts` | PASSING | |
| `queries/plantationDetailQueries.test.ts` | PASSING | |
| `queries/unsyncedSubgroupSummary.test.ts` | PASSING | |
| `repositories/deletePlantationLocally.test.ts` | PASSING | |
| `hooks/useNetStatus.test.ts` | PASSING | |
| `hooks/useProfileData.test.ts` | **1 FAILING** | organizacionNombre empty — mock uses 2 calls but hook now uses 1 join |
| `database/seed.test.ts` | **3 FAILING** | `db.delete` missing from mock; seedSpecies changed to sync logic |
| `database/migrations.test.ts` | PASSING | |
| `database/subgroup.test.ts` | PASSING | |
| `database/tree.test.ts` | PASSING | |
| `utils/idGenerator.test.ts` | PASSING | |
| `utils/reverseOrder.test.ts` | PASSING | |

**Currently untested (critical gaps per D-03/D-04):**
- `SubGroupRepository`: createSubGroup, updateSubGroup, updateSubGroupCode, deleteSubGroup, getSyncableSubGroups
- `TreeRepository`: all methods
- `PlantationSpeciesRepository`: all methods
- `UserSpeciesOrderRepository`: all methods
- `PhotoService`: all methods
- `useAuth`: 0 tests — complex post-Phase 10 logic (authChangeListeners, TTL, offline fallback)
- `useSync`: 0 tests
- `usePendingSyncCount`: 0 tests
- Integration tests with REAL SQLite: 0 (D-05 not yet implemented)

### Failing Tests — Root Causes and Fixes

**1. `tests/database/seed.test.ts` (3 failing)**

Root cause: `seedSpeciesIfNeeded` was refactored in Phase 10 from a simple bulk-insert to a full sync function. The new version calls `db.delete()`, `db.update()`, and `db.select()` with a different chain. The current test mock:
```js
jest.mock('../../src/database/client', () => ({
  db: {
    select: () => ({ from: mockFrom }),
    insert: () => ({ values: mockValues }),
    // Missing: delete, update
  },
}));
```
Also: the function now does `db.select({ id, codigo, nombre, nombreCientifico }).from(species)` (full scan) — mock always returns `[{ count: 0 }]` which matches the new empty-table path incorrectly. Fix: rewrite mock with `delete`, `update`, and correct return shapes.

**2. `tests/hooks/useProfileData.test.ts` (1 failing)**

Root cause: `useProfileData` was changed to use a single Supabase join query:
```ts
supabase.from('profiles').select('nombre, rol, organizacion_id, organizations(nombre)').eq('id', user.id).single()
```
The test mocks two separate `from()` calls (one for 'profiles', one for 'organizations'). The mock returns `{ nombre: 'Juan', rol: 'tecnico', organizacion_id: 'org-1' }` with no `organizations` field. Fix: update mock to return the joined shape:
```ts
{ data: { nombre: 'Juan', rol: 'tecnico', organizacion_id: 'org-1', organizations: { nombre: 'Org Test' } }, error: null }
```

---

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jest | 29.7.0 | Test runner | Already configured, jest-expo preset |
| jest-expo | ~54.0.17 | Expo-aware Jest preset | Handles Expo module transforms |
| @types/jest | 29.5.14 | TypeScript types for Jest | Already present |
| @testing-library/react-native | ^12.9.0 | React Native testing utils | Already installed |

### To Install (Integration Tests)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 | Real SQLite for Node.js test env | Synchronous API, in-memory support, Drizzle adapter exists |
| @types/better-sqlite3 | 7.6.13 | TypeScript types | Companion to above |

**Version verification:** `npm view better-sqlite3 version` → 12.8.0 (verified 2026-04-08). Not yet installed in the project (confirmed: `npm list better-sqlite3` shows empty).

### CI (New Files — No Install Needed)
| Tool | Where | Purpose |
|------|-------|---------|
| GitHub Actions | `.github/workflows/` | CI pipeline YAML — directory does NOT exist yet |
| Maestro | macOS runner only | E2E test runner (installed in CI step — not installed locally) |

**Installation:**
```bash
cd mobile && npm install --save-dev better-sqlite3 @types/better-sqlite3
```

**Note on better-sqlite3 and native modules:** `better-sqlite3` requires a native build. In GitHub Actions, add `npm rebuild better-sqlite3` after `npm ci`. Must NOT be transformed by Babel — add to `transformIgnorePatterns`.

---

## Architecture Patterns

### Integration Test Database Setup (D-05)

The project already has `testEnvironment: 'node'` and `drizzle/migrations.js` with all 7 migrations. The migrations.js file uses ES module `import` syntax (it imports SQL files as strings via the `.sql` mock). For integration tests with better-sqlite3, the approach is to use the Drizzle migrator with the folder-based approach using actual `.sql` files (not the `migrations.js` export), since better-sqlite3 uses its own adapter.

```typescript
// tests/helpers/integrationDb.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/database/schema';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite };
}

export function closeTestDb(sqlite: Database.Database) {
  sqlite.close();
}
```

**Critical setup detail:** The `migrationsFolder` path must be relative to the Jest working directory (the `mobile/` folder). The `drizzle/` folder is at `mobile/drizzle/`. This works because Jest `rootDir` is `mobile/`.

**Important:** better-sqlite3 must NOT be in the `transformIgnorePatterns` allow-list. It is a native Node module and must remain untransformed. The current `transformIgnorePatterns` already excludes it by default.

**Jest config addition needed** — integration tests require a separate config or `--testPathPattern` to run separately from unit tests:

```js
// jest.integration.config.js (in mobile/)
module.exports = {
  ...require('./jest.config'),
  testMatch: ['**/tests/integration/**/*.test.ts'],
  setupFiles: ['./tests/jestSetup.js'],
  setupFilesAfterEnv: ['./tests/setup.integration.ts'],  // lighter setup — no expo-sqlite mock
};
```

The integration setup file must NOT mock `expo-sqlite` or `drizzle-orm/expo-sqlite` — those mocks break the better-sqlite3 path. A separate `setup.integration.ts` should only mock what integration tests need (expo-secure-store, NetInfo, expo-crypto).

**Isolation pattern per test:**
```typescript
let db: ReturnType<typeof createTestDb>['db'];
let sqlite: Database.Database;

beforeAll(() => {
  const result = createTestDb();
  db = result.db;
  sqlite = result.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  // Delete in FK-safe order (children before parents)
  await db.delete(schema.trees);
  await db.delete(schema.subgroups);
  await db.delete(schema.userSpeciesOrder);
  await db.delete(schema.plantationSpecies);
  await db.delete(schema.plantationUsers);
  await db.delete(schema.plantations);
  await db.delete(schema.species);
});
```

### Factory Functions (D-10)

Located at `tests/helpers/factories.ts`. Functions inject directly into a passed `db` instance (not the module-level `db` from `client.ts`):

```typescript
// tests/helpers/factories.ts
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { plantations, subgroups, trees, species, plantationSpecies } from '../../src/database/schema';
import * as schema from '../../src/database/schema';

type TestDb = BetterSQLite3Database<typeof schema>;

export async function createTestSpecies(db: TestDb, overrides?: Partial<...>) {
  const defaults = { id: crypto.randomUUID(), codigo: 'TST', nombre: 'Test Species', ... };
  const s = { ...defaults, ...overrides };
  await db.insert(species).values(s);
  return s;
}

export async function createTestPlantation(db: TestDb, overrides?: Partial<...>) { ... }
export async function createTestSubGroup(db: TestDb, plantacionId: string, overrides?: Partial<...>) { ... }
export async function createTestTree(db: TestDb, subgrupoId: string, especieId: string, overrides?: Partial<...>) { ... }
```

### Network Helper (D-08/D-09)

Located at `tests/helpers/networkHelper.ts`. Works with the existing `setup.ts` mocks:

```typescript
// tests/helpers/networkHelper.ts
import NetInfo from '@react-native-community/netinfo';

export function setOffline() {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });
}

export function setOnline() {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
}

// For supabase timeout simulation (offline with hanging network)
export function setHangingNetwork(delayMs = 10000) {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: null });
  // Caller must also mock supabase to delay/timeout
}
```

### useAuth Testing Pattern

`useAuth` (210 lines) is significantly more complex post-Phase 10. Key testing challenges:

1. **Module-level `authChangeListeners` set** — persists across tests if not cleared. Fix: expose a `_resetListeners()` function for test isolation only, or use `jest.isolateModules()`.
2. **`withTimeout()` wraps all network calls** — tests must either mock fast or advance timers. Use `jest.useFakeTimers()` + `jest.runAllTimersAsync()`.
3. **`isOfflineLoginExpired()`** reads `OFFLINE_LOGIN_EXPIRE` from `src/config/offlineLogin.ts` — tests must mock this config module to control TTL behavior.
4. **`handleOfflineSignIn()`** is an internal function — test via `signIn()` with `isConnected: false`.

Pattern for useAuth tests:
```typescript
jest.mock('../../src/config/offlineLogin', () => ({
  OFFLINE_LOGIN_EXPIRE: false,  // or true for TTL tests
  OFFLINE_LOGIN_DURATION_HS: 168,
}));

jest.mock('../../src/services/OfflineAuthService');  // mock the whole service
```

### Maestro E2E (D-06)

Maestro is not installed locally or in CI (confirmed). Flows go in `mobile/maestro/` directory:

```yaml
# mobile/maestro/01-offline-login.yaml
appId: com.bayka.app  # from app.json
---
- launchApp:
    clearState: true
- tapOn: "Email"
- inputText: "tecnico1@bayka.com"
- tapOn: "Contraseña"
- inputText: "password123"
- tapOn: "Iniciar sesión"
- assertVisible: "Mis plantaciones"
```

Key Maestro + Expo constraints:
- Requires a compiled `.app` (simulator) or `.apk` (Android emulator) — cannot run on Metro bundler alone
- In CI: `npx expo prebuild --no-install`, then `xcodebuild` for iOS simulator build
- `app.json` exists in the project root (confirmed by git status) — need to verify `bundleIdentifier`
- Local development: install Maestro with `curl -Ls "https://get.maestro.mobile.dev" | bash`

### GitHub Actions CI/CD (D-12/D-13)

No `.github/workflows/` directory exists yet. Must be created from scratch.

Two-tier architecture:

**Tier 1 — Branch pushes** (`.github/workflows/ci.yml`):
```yaml
on:
  push:
    branches-ignore: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, tsc --noEmit, eslint]
  
  unit-tests:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, npm rebuild better-sqlite3, jest --testPathPattern=unit]
  
  integration-tests:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, npm rebuild better-sqlite3, jest --config jest.integration.config.js]
```

**Tier 2 — Main branch / PR to main** (`.github/workflows/ci-full.yml`):
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

jobs:
  # All jobs from Tier 1, plus:
  e2e:
    runs-on: macos-latest
    steps:
      - checkout
      - setup-node + npm ci
      - install Maestro
      - npx expo prebuild --no-install
      - xcodebuild (build simulator app)
      - boot simulator
      - maestro test mobile/maestro/
```

**Caching strategy:** Cache `mobile/node_modules` by hash of `mobile/package-lock.json`. Use `actions/setup-node@v4` with `cache: 'npm'` and `cache-dependency-path: mobile/package-lock.json`.

**Note:** macOS runner (`macos-latest`) is significantly more expensive than `ubuntu-latest` (~10x). Keep E2E only on main branch PR/push gate per D-13.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory SQLite for tests | Custom DB fixture code | `better-sqlite3` + `drizzle-orm/better-sqlite3` + `migrate()` | Exact SQLite behavior, runs migrations, Drizzle adapter exists |
| Offline simulation | Inline NetInfo mocks per test | `tests/helpers/networkHelper.ts` helpers | Consistency, "un solo lugar" rule, easy maintenance |
| E2E test runner | Custom automation scripts | Maestro | YAML syntax, iOS/Android support, widely used in RN ecosystem |
| CI pipeline | Custom scripts | GitHub Actions | Free for public repos, integrates with branch protection |
| Test data setup | Inline `db.insert()` in each test | Factory functions in `tests/helpers/factories.ts` | Reuse, consistent defaults, typed overrides |

---

## Common Pitfalls

### Pitfall 1: Integration setup.ts mocks break better-sqlite3
**What goes wrong:** The global `setup.ts` mocks `expo-sqlite` and `drizzle-orm/expo-sqlite` with Jest mocks. When integration tests import `src/database/client.ts`, the mock intercepts it and returns an empty `{}` instead of the real drizzle instance.
**How to avoid:** Create a separate `setup.integration.ts` that does NOT mock expo-sqlite or drizzle-orm/expo-sqlite. Pass this as `setupFilesAfterEnv` in `jest.integration.config.js`. The integration tests import `better-sqlite3` directly, not through the production `client.ts`.
**Pattern:** Integration tests receive `db` from `createTestDb()` factory, not from `src/database/client`. They call repository functions by passing the test `db` OR by temporarily overriding the module-level `db` import via a dependency injection approach.

### Pitfall 2: Repository functions use module-level db
**What goes wrong:** All repositories (`SubGroupRepository`, `TreeRepository`, etc.) import `db` at the module level from `src/database/client.ts`. Integration tests cannot simply create a test db and pass it in.
**How to avoid:** Two options: (A) Write integration tests that mock the `src/database/client` module to return the test db — `jest.mock('../../src/database/client', () => ({ db: testDb }))` — but this is fragile with beforeAll timing. (B) Restructure repositories to accept db as a parameter (dependency injection). Option B is architecturally superior but requires refactoring. For Phase 9, use Option A with careful `beforeAll` setup order.
**Pattern for integration tests:**
```typescript
let testDb: any;
jest.mock('../../src/database/client', () => ({
  get db() { return testDb; }  // getter — always returns current testDb value
}));
```

### Pitfall 3: authChangeListeners bleeds between tests
**What goes wrong:** `useAuth.ts` declares `authChangeListeners` as a module-level `Set`. Since Jest reuses module instances across tests in the same file, listeners registered in one test remain for the next.
**How to avoid:** Use `jest.isolateModules()` per test, or add a test-only export `_resetListeners = () => authChangeListeners.clear()` to useAuth.ts, or call `jest.resetModules()` in `afterEach`.

### Pitfall 4: seed.test.ts mock shape mismatch after seedSpecies refactor
**What goes wrong:** `seedSpeciesIfNeeded` now calls `db.select({ id, codigo, nombre, nombreCientifico }).from(species)` (returns full rows, not count), then `db.delete()`. Old mock shape `[{ count: 0 }]` satisfies the `.length === 0` check accidentally, but then calls `db.delete` which doesn't exist in the mock.
**How to avoid:** Rewrite the seed test mock to match the new function signature: `db.select()` returns `[]`, add `db.delete` to the mock.

### Pitfall 5: useProfileData join query mock
**What goes wrong:** `useProfileData` uses a PostgREST join: `.select('nombre, rol, organizacion_id, organizations(nombre)')`. The test mock returns `{ nombre, rol, organizacion_id }` without the `organizations` key. The hook extracts `orgData` from `profileData.organizations` which is `undefined`, falling back to `''`.
**How to avoid:** Mock must return: `{ data: { nombre: 'Juan', rol: 'tecnico', organizacion_id: 'org-1', organizations: { nombre: 'Org Test' } }, error: null }`.

### Pitfall 6: better-sqlite3 delete order violates FK constraints
**What goes wrong:** SQLite FK constraints are enforced. Deleting `plantations` before `subgroups` throws a FK violation.
**How to avoid:** Always delete in child-first order in `beforeEach`: trees → subgroups → userSpeciesOrder → plantationSpecies → plantationUsers → plantations → species.

### Pitfall 7: migrations.js uses ES module imports (SQL files)
**What goes wrong:** `drizzle/migrations.js` uses `import m0000 from './0000_....sql'` syntax. The `.sql` mock in Jest (`moduleNameMapper: { '\\.sql$': fileMock.js }`) returns an empty string. When `migrate()` from `drizzle-orm/better-sqlite3/migrator` reads the `migrationsFolder` directly, it reads actual `.sql` files from disk — not through the `migrations.js` export. These are separate code paths.
**How to avoid:** Use `migrate(db, { migrationsFolder: './drizzle' })` in integration tests — this reads SQL files from disk directly and does NOT go through `migrations.js`. The `.sql` mock only affects unit tests that import SQL files as strings.

---

## Code Examples

### Integration Test: SubGroup lifecycle with real SQLite

```typescript
// tests/integration/subgroupLifecycle.test.ts
import { createTestDb, closeTestDb } from '../helpers/integrationDb';
import { createSubGroup, finalizeSubGroup, deleteSubGroup } from '../../src/repositories/SubGroupRepository';
import { createTestPlantation, createTestSubGroup } from '../helpers/factories';
import * as schema from '../../src/database/schema';

let testDb: any;
let sqlite: any;

jest.mock('../../src/database/client', () => ({
  get db() { return testDb; }
}));
jest.mock('../../src/database/liveQuery', () => ({ notifyDataChanged: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-' + Math.random().toString(36).substring(2, 9)),
}));

beforeAll(() => {
  const result = createTestDb();
  testDb = result.db;
  sqlite = result.sqlite;
});

afterAll(() => closeTestDb(sqlite));

beforeEach(async () => {
  await testDb.delete(schema.trees);
  await testDb.delete(schema.subgroups);
  await testDb.delete(schema.plantations);
  await testDb.delete(schema.species);
});

it('creates, finalizes, and deletes a subgroup', async () => {
  const plantation = await createTestPlantation(testDb);
  
  const result = await createSubGroup({
    plantacionId: plantation.id,
    nombre: 'Linea 1',
    codigo: 'L1',
    tipo: 'linea',
    usuarioCreador: 'user-test',
  });
  
  expect(result.success).toBe(true);
  if (!result.success) return;
  
  await finalizeSubGroup(result.id);
  
  const rows = await testDb.select().from(schema.subgroups);
  expect(rows[0].estado).toBe('finalizada');
  
  const { treeCount } = await deleteSubGroup(result.id);
  expect(treeCount).toBe(0);
  
  const afterDelete = await testDb.select().from(schema.subgroups);
  expect(afterDelete).toHaveLength(0);
});
```

### Unit Test: useAuth offline TTL

```typescript
// tests/hooks/useAuth.test.ts
jest.mock('../../src/config/offlineLogin', () => ({
  OFFLINE_LOGIN_EXPIRE: true,
  OFFLINE_LOGIN_DURATION_HS: 1,  // 1 hour TTL for tests
}));

jest.mock('../../src/services/OfflineAuthService', () => ({
  verifyCredential: jest.fn(),
  cacheCredential: jest.fn(),
  saveLastOnlineLogin: jest.fn(),
  isOfflineLoginExpired: jest.fn().mockResolvedValue(false),
  getCachedPassword: jest.fn(),
  getCachedEmails: jest.fn().mockResolvedValue([]),
}));
```

### Fix for seed.test.ts

```typescript
jest.mock('../../src/database/client', () => ({
  db: {
    select: jest.fn(() => ({ from: mockSelectFrom })),
    insert: jest.fn(() => ({ values: mockInsertValues })),
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn() })) })),
    delete: jest.fn(() => ({ where: jest.fn() })),
  },
}));
```

For "inserts all when empty" test: `mockSelectFrom.mockResolvedValue([])` (empty array, not `[{ count: 0 }]`).

### Fix for useProfileData.test.ts

```typescript
(supabase.from as jest.Mock).mockImplementation((table: string) => {
  if (table === 'profiles') {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          nome: 'Juan',
          rol: 'tecnico',
          organizacion_id: 'org-1',
          organizations: { nombre: 'Org Test' },  // joined field
        },
        error: null,
      }),
    };
  }
  return makeSupabaseChain({ data: null, error: null });
});
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Jest, CI | ✓ | v25.2.1 | — |
| npm | Package install | ✓ | 11.6.2 | — |
| better-sqlite3 | Integration tests | ✗ (not installed) | 12.8.0 available | — must install |
| xcodebuild | Maestro iOS build | ✓ | detected | — |
| Maestro CLI | E2E tests | ✗ (not installed) | latest | Only needed in CI macos runner + locally for test authoring |
| GitHub Actions | CI/CD | ✓ (repo on GitHub) | — | — |
| `.github/workflows/` | CI | ✗ (dir missing) | — | Must create |

**Missing dependencies with no fallback:**
- `better-sqlite3` — blocking for TEST-INFRA and TEST-INTEGRATION. Must install before integration tests.

**Missing dependencies with fallback (or CI-only):**
- Maestro CLI — not needed locally for implementation. CI step installs it. Optionally install locally for flow authoring: `curl -Ls "https://get.maestro.mobile.dev" | bash`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `offlineAuth` tests checking NO password field | Tests now check password IS stored (intentional for quick-login) | Phase 8 | offlineAuth tests now PASS — not a Wave 0 fix |
| `seedSpeciesIfNeeded` bulk-insert if empty | Full sync: select all, upsert changes, delete removed | Phase 10 | seed.test.ts mock is broken |
| `useProfileData` using two Supabase calls | Single join query with PostgREST embedding | Phase 10 | useProfileData test mock is broken |
| SyncService: upload subgroups only | Also pulls species catalog, uploads offline plantations, downloads trees | Phase 10 | SyncService.offline.test.ts added (passing) |
| `useAuth` single-instance | Multi-instance broadcast via `authChangeListeners` | Phase 10 | More complex to test |

---

## Open Questions

1. **Integration test db injection pattern**
   - What we know: repositories use module-level `db` from `src/database/client`
   - What's unclear: getter pattern (`get db() { return testDb }`) may not work if the module is cached before `testDb` is assigned
   - Recommendation: Test the getter approach in Wave 0 setup; fallback is dependency injection refactor on repositories (which aligns with CLAUDE.md §9 goals anyway)

2. **Maestro app bundle ID**
   - What we know: `app.json` exists (untracked in git, confirmed by `git status`)
   - What's unclear: what `bundleIdentifier` / `package` is set — Maestro needs `appId`
   - Recommendation: Read `app.json` when writing Maestro flows

3. **SyncService 500-line boundary**
   - What we know: SyncService is exactly 500 lines — at the refactor threshold
   - What's unclear: whether download functions (downloadPlantation, batchDownload) should be extracted to a separate `DownloadService.ts`
   - Recommendation: Evaluate after screen refactors; if SyncService grows further, extract download logic to `DownloadService.ts`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + jest-expo ~54.0.17 |
| Config file | `mobile/jest.config.js` (unit tests); `mobile/jest.integration.config.js` (to be created) |
| Quick run command | `cd mobile && npx jest --testPathPattern=tests/unit` |
| Full suite command | `cd mobile && npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-INFRA | better-sqlite3 installs, integration db helper works | smoke | `cd mobile && npx jest --config jest.integration.config.js` | ❌ Wave 0 |
| TEST-REFACTOR | Screens under 500 lines, no direct db/repository imports in screens | static analysis | `cd mobile && npx tsc --noEmit` | ✅ (tsc) |
| TEST-INTEGRATION | SubGroup lifecycle, cascade delete, getSyncableSubGroups, tree registration in real SQLite | integration | `cd mobile && npx jest --config jest.integration.config.js` | ❌ Wave 0 |
| TEST-UNIT | useAuth offline TTL, authChangeListeners, useSync, usePendingSyncCount | unit | `cd mobile && npx jest tests/hooks/useAuth.test.ts` | ❌ Wave 0 |
| TEST-E2E | Login offline, register tree, sync SubGroup — Maestro YAML flows | e2e | `maestro test mobile/maestro/` | ❌ Wave 0 |
| TEST-CI | GitHub Actions workflow triggers on push/PR | CI | GitHub Actions run | ❌ Wave 0 |
| TEST-CI-E2E | macOS runner runs Maestro on iOS simulator | CI-e2e | GitHub Actions run (main only) | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] Fix `tests/database/seed.test.ts` — add `delete`, `update` to db mock, fix select return shape
- [ ] Fix `tests/hooks/useProfileData.test.ts` — update mock to return joined `organizations` field
- [ ] Create `mobile/jest.integration.config.js` — integration test configuration
- [ ] Create `mobile/tests/setup.integration.ts` — integration setup without expo-sqlite mock
- [ ] Create `mobile/tests/helpers/integrationDb.ts` — better-sqlite3 + drizzle setup
- [ ] Create `mobile/tests/helpers/factories.ts` — typed factory functions
- [ ] Create `mobile/tests/helpers/networkHelper.ts` — setOffline/setOnline helpers
- [ ] Create `mobile/tests/integration/` directory — real SQLite test files
- [ ] Create `.github/workflows/ci.yml` — branch/PR pipeline
- [ ] Create `.github/workflows/ci-full.yml` — main branch + E2E pipeline
- [ ] Create `mobile/maestro/` directory — E2E flow YAML files
- [ ] Install `better-sqlite3 @types/better-sqlite3` as dev deps

---

## Sources

### Primary (HIGH confidence)
- Direct codebase investigation — all file contents read fresh as of 2026-04-08
- Jest test run output — 26 suites, 174 tests, exact fail reasons confirmed

### Secondary (MEDIUM confidence)
- Drizzle ORM better-sqlite3 adapter — pattern from drizzle-orm documentation, confirmed by existing `drizzle/migrations.js` structure
- Maestro documentation — YAML flow syntax, Expo integration patterns

### Tertiary (LOW confidence)
- GitHub Actions macOS runner Maestro setup — pattern from community, not verified against current GitHub Actions runner versions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from running test suite and package.json
- Architecture (refactor targets): HIGH — confirmed by direct line counts and grep for imports
- Test failures root causes: HIGH — confirmed by running tests and reading source code
- Integration test setup: MEDIUM — pattern is established but not yet proven in this codebase
- Maestro CI patterns: MEDIUM — based on community practices, Expo docs

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (30 days — stable ecosystem)
