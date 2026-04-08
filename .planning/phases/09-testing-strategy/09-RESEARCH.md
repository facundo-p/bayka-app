# Phase 9: Testing Strategy - Research

**Researched:** 2026-04-08
**Domain:** React Native / Expo testing — Jest + SQLite integration, Maestro E2E, GitHub Actions CI/CD, screen refactoring
**Confidence:** HIGH (architecture analysis from codebase) / MEDIUM (Maestro CI patterns)

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

## Summary

Phase 9 is split into two sequential concerns: (1) a refactor pass to make the codebase testable and compliant with CLAUDE.md architecture rules, then (2) comprehensive test coverage targeting the data/service layer.

**Refactor first, test second.** The codebase currently has 3 screens over 500 lines (TreeRegistrationScreen: 1053 lines, AdminScreen: 913 lines, PlantationDetailScreen: 605 lines) and a widespread violation of CLAUDE.md §9 where screens directly import from repositories/queries/services instead of going through hooks. ConfigureSpeciesScreen even imports `db` directly. This must be corrected before tests are added, or tests will reinforce the wrong architecture.

**Integration tests need better-sqlite3.** The existing test suite uses a fully mocked SQLite (`jest.mock('expo-sqlite', ...)`). For real SQLite integration tests (D-05), the approach is to install `better-sqlite3` + `@types/better-sqlite3` as dev dependencies, use `drizzle-orm/better-sqlite3`, and run migrations with `migrate()` from `drizzle-orm/migrator` against an in-memory database (`new Database(':memory:')`). This is a well-established pattern for Node.js Jest environments and works because `testEnvironment: 'node'` is already set.

**E2E on macOS runner via Maestro.** Maestro requires a compiled `.app` file. The approach without EAS is: `npx expo prebuild` to generate native directories, then `xcodebuild` to create the simulator build. macOS GitHub Actions runner (`macos-latest`) is required for iOS simulator. IDB (Facebook's iOS Device Bridge) must be installed for Maestro to control the simulator.

**Primary recommendation:** Install `better-sqlite3` for integration tests, fix the 3 oversized screens (extract logic into hooks), fix `db` direct import in ConfigureSpeciesScreen, create `tests/helpers/` infrastructure (factories + networkHelper), then add integration tests for the 5 critical flows.

---

## Codebase Analysis (Pre-Research)

### Refactor Targets — Confirmed by Line Count

| File | Lines | Action Required |
|------|-------|-----------------|
| `src/screens/TreeRegistrationScreen.tsx` | 1053 | Decompose: extract hooks for species ordering, tree CRUD, N/N state, photo flow |
| `src/screens/AdminScreen.tsx` | 913 | Decompose: extract usePlantationAdmin hook, separate modal components |
| `src/screens/PlantationDetailScreen.tsx` | 605 | Decompose: extract subgroup list logic into useSubgroupDetail hook |
| `src/services/SyncService.ts` | 389 | Close to limit — evaluate after screen refactors |
| `src/repositories/SubGroupRepository.ts` | 312 | Acceptable; no refactor needed |

### CLAUDE.md §9 Violations in Screens

All screens below directly import from repositories/queries/services — violating "no queries in screens" rule. Per D-02, these must be extracted to hooks before tests are written.

| Screen | Direct Imports | Extraction Target |
|--------|----------------|-------------------|
| `AdminScreen.tsx` | `dashboardQueries`, `adminQueries`, `PlantationRepository`, `ExportService` | `usePlantationAdmin` hook |
| `AssignTechniciansScreen.tsx` | `adminQueries`, `PlantationRepository` | `useAssignTechnicians` hook |
| `CatalogScreen.tsx` | `catalogQueries`, `PlantationRepository`, `SyncService` | `useCatalog` hook |
| `ConfigureSpeciesScreen.tsx` | `adminQueries`, `PlantationRepository`, `db` (direct!) | `useSpeciesConfig` hook |
| `NNResolutionScreen.tsx` | `TreeRepository`, `plantationDetailQueries` | `useNNResolution` hook |
| `NuevoSubgrupoScreen.tsx` | `SubGroupRepository` | Extract to `useNewSubgroup` or expand existing hook |
| `PlantacionesScreen.tsx` | `freshnessQueries`, `SyncService`, `dashboardQueries` | Hooks already exist — use them exclusively |
| `PlantationDetailScreen.tsx` | `SubGroupRepository`, `plantationDetailQueries`, `adminQueries` | `usePlantationDetail` hook |
| `TreeRegistrationScreen.tsx` | `TreeRepository`, `SubGroupRepository`, `PhotoService`, `plantationDetailQueries`, `UserSpeciesOrderRepository` | Multiple focused hooks |

**Priority:** ConfigureSpeciesScreen (`db` direct import) and AdminScreen (most complex, 913 lines) are highest priority refactor targets.

### Test Coverage Baseline

**Currently tested (24 test files, 159 tests, 154 passing):**
- Auth: session, role, logout, multiuser, offlineAuth (3 failing — offlineAuth stores plaintext password; test regression)
- Sync: SyncService, downloadService, dashboard queries
- Admin: adminQueries, ExportService, PlantationRepository (partial)
- Queries: catalogQueries, freshnessQueries, plantationDetailQueries, unsyncedSubgroupSummary
- Hooks: useNetStatus, useProfileData
- Utils: idGenerator, reverseOrder
- Database: migrations (stub), subgroup mock tests, tree mock tests, seed (1 failing — seed.test.ts: db.delete mock issue)

**Currently untested (critical gaps per D-03/D-04):**
- `SubGroupRepository`: all methods except what's in subgroup.test.ts (which uses mock db)
- `TreeRepository`: 0 tests
- `PlantationSpeciesRepository`: 0 tests
- `UserSpeciesOrderRepository`: 0 tests
- `PhotoService`: 0 tests
- Integration tests with REAL SQLite: 0 (D-05)
- `useAuth`: 0 tests
- `useSync`: 0 tests
- `usePendingSyncCount`: 0 tests
- Hooks: 10 of 12 untested

### Existing Failing Tests (Must Fix in Wave 0)

1. `tests/auth/offlineAuth.test.ts` — OfflineAuthService stores `password` plaintext in credential object. Test expects it not to. Test regression from Phase 8 changes.
2. `tests/database/seed.test.ts` — `db.delete` mock missing in seed test setup (mock doesn't include `delete` method).
3. `tests/hooks/useProfileData.test.ts` — failing (details not fetched, but confirmed failing).

---

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jest | 29.7.0 | Test runner | Already configured, jest-expo preset |
| jest-expo | ~54.0.17 | Expo-aware Jest preset | Handles Expo module transforms |
| @types/jest | 29.5.14 | TypeScript types for Jest | Already present |
| @testing-library/react-native | ^12.9.0 | React Native testing utils | Already installed (for future use) |

### To Install (Integration Tests)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 | Real SQLite for Node.js test env | Synchronous API, in-memory support, Drizzle adapter exists |
| @types/better-sqlite3 | 7.6.13 | TypeScript types | Companion to above |

**Version verification:** `npm view better-sqlite3 version` → 12.8.0 (verified 2026-04-08)

### CI (New Files — No Install Needed)
| Tool | Where | Purpose |
|------|-------|---------|
| GitHub Actions | `.github/workflows/` | CI pipeline YAML |
| Maestro | macOS runner only | E2E test runner (installed in CI step) |

**Installation for integration tests:**
```bash
cd mobile && npm install --save-dev better-sqlite3 @types/better-sqlite3
```

**Note on better-sqlite3 and native modules:** `better-sqlite3` requires a native build. In GitHub Actions, use `npm ci` + `npm rebuild better-sqlite3` after checkout. It must NOT be transformed by Babel (add to `transformIgnorePatterns`).

---

## Architecture Patterns

### Integration Test Database Setup (D-05)

The key insight: the project already has `testEnvironment: 'node'` and Drizzle migrations in `drizzle/migrations.js`. Real SQLite tests can use `better-sqlite3` with `drizzle-orm/better-sqlite3` adapter and run `migrate()` before each suite.

```typescript
// tests/helpers/integrationDb.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../src/database/schema';
import migrations from '../../drizzle/migrations';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });  // or pass migrations object directly
  return { db, sqlite };
}

export function closeTestDb(sqlite: Database.Database) {
  sqlite.close();
}
```

**Isolation pattern per test file:**
```typescript
let db: ReturnType<typeof createTestDb>['db'];
let sqlite: Database.Database;

beforeAll(() => {
  const result = createTestDb();
  db = result.db;
  sqlite = result.sqlite;
});

afterAll(() => {
  closeTestDb(sqlite);
});

beforeEach(async () => {
  // Clear data between tests without dropping schema
  await db.delete(schema.trees);
  await db.delete(schema.subgroups);
  await db.delete(schema.plantations);
});
```

**Critical:** `better-sqlite3` migrations must use the folder-based approach if `migrations.js` references SQL files by path. Alternatively, seed schema via `sqlite.exec(schemaSQL)` if migrations object is self-contained.

**Jest config addition needed:** Integration tests should have their own config or use a `--testPathPattern` to separate unit from integration:

```javascript
// jest.integration.config.js
module.exports = {
  ...require('./jest.config'),
  testMatch: ['**/tests/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['./tests/setup.integration.ts'],
};
```

Integration setup should NOT mock `expo-sqlite` or `drizzle-orm/expo-sqlite` — use real `better-sqlite3` adapter instead.

### Centralized Network Helper (D-08 / D-09)

```typescript
// tests/helpers/networkHelper.ts
import NetInfo from '@react-native-community/netinfo';

export function setOffline() {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
}

export function setOnline() {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
}
```

**Usage pattern in tests:**
```typescript
import { setOffline, setOnline } from '../helpers/networkHelper';

beforeEach(() => setOnline()); // default state

it('falls back to cached credentials when offline', async () => {
  setOffline();
  // ... test body
});
```

### Factory Functions Pattern (D-10)

Use `Partial<T>` overrides with typed defaults. No external library needed — plain TypeScript.

```typescript
// tests/helpers/factories.ts
import type { NewPlantation } from '../../src/database/schema';

export function createTestPlantation(overrides?: Partial<NewPlantation>): NewPlantation {
  return {
    id: `plantation-${Math.random().toString(36).slice(2, 9)}`,
    organizacionId: '00000000-0000-0000-0000-000000000001',
    lugar: 'Campo Norte',
    periodo: '2026-otono',
    estado: 'activa',
    creadoPor: 'user-admin-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestSubGroup(overrides?: Partial<...>): NewSubgroup {
  return {
    id: `sg-${Math.random().toString(36).slice(2, 9)}`,
    plantacionId: 'plantation-default',
    nombre: 'Línea A',
    codigo: 'LA',
    tipo: 'linea',
    estado: 'activa',
    usuarioCreador: 'user-tecnico-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestTree(overrides?: Partial<...>): NewTree {
  return {
    id: `tree-${Math.random().toString(36).slice(2, 9)}`,
    subgrupoId: 'sg-default',
    especieId: 'species-eucalyptus',
    posicion: 1,
    subId: 'LA-EUC-1',
    fotoUrl: null,
    plantacionId: null,
    globalId: null,
    usuarioRegistro: 'user-tecnico-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

**Key rule:** IDs must be unique per test — use random suffix, not hardcoded strings, unless testing requires specific IDs.

### Maestro E2E Flow Structure (D-06)

```
mobile/
└── .maestro/
    ├── flows/
    │   ├── 01-login-offline.yaml
    │   ├── 02-register-tree.yaml
    │   └── 03-sync-subgroup.yaml
    └── helpers/
        └── login.yaml  (reusable subflow)
```

**Example flow (login offline):**
```yaml
appId: com.bayka.app   # must match app.json bundleIdentifier
---
- launchApp:
    clearState: true
- tapOn:
    id: "email-input"
- inputText: "tecnico@test.com"
- tapOn:
    id: "password-input"
- inputText: "password123"
- tapOn:
    id: "login-button"
- assertVisible:
    id: "plantaciones-screen"
```

**testID requirement:** Maestro targets by `testID` prop (maps to accessibility ID). The refactor wave should add `testID` to key interactive elements: login form inputs/button, plantation list, subgroup list, tree registration buttons, sync button.

**App bundle ID:** Must be defined in `app.json`. Currently the project has `app.json` in the root — verify it contains `ios.bundleIdentifier`.

### GitHub Actions CI Pipeline (D-12 / D-13)

**File structure:**
```
.github/
└── workflows/
    ├── ci.yml          # Branch push: lint + unit + integration (fast, < 5 min)
    └── e2e.yml         # PR to main: full pipeline + Maestro E2E (macOS, ~15 min)
```

**ci.yml (branch push — parallel jobs):**
```yaml
name: CI

on:
  push:
    branches: ['*']
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json
      - run: npm ci
        working-directory: mobile
      - run: npx tsc --noEmit
        working-directory: mobile
      - run: npx eslint src/ tests/
        working-directory: mobile

  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json
      - run: npm ci
        working-directory: mobile
      - run: npx jest --testPathPattern="tests/(auth|hooks|utils|database)/" --ci
        working-directory: mobile

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json
      - run: npm ci
        working-directory: mobile
      - run: npm rebuild better-sqlite3
        working-directory: mobile
      - run: npx jest --testPathPattern="tests/integration/" --ci
        working-directory: mobile
```

**e2e.yml (PR to main — sequential, macOS):**
```yaml
name: E2E

on:
  pull_request:
    branches: [main]

jobs:
  e2e-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json
      - run: npm ci
        working-directory: mobile
      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH
      - name: Install IDB for iOS simulator control
        run: brew tap facebook/fb && brew install facebook/fb/idb-companion
      - name: Prebuild Expo app
        run: npx expo prebuild --platform ios --clean
        working-directory: mobile
      - name: Build iOS simulator app
        run: |
          xcodebuild -workspace ios/mobile.xcworkspace \
            -scheme mobile \
            -configuration Release \
            -destination 'generic/platform=iOS Simulator' \
            -derivedDataPath build/
        working-directory: mobile
      - name: Boot iOS simulator
        run: |
          SIMULATOR_ID=$(xcrun simctl list devices available -j | \
            python3 -c "import sys,json; devs=json.load(sys.stdin)['devices']; \
            iphone=[d for v in devs.values() for d in v if 'iPhone' in d['name'] and d['isAvailable']]; \
            print(iphone[0]['udid'])")
          xcrun simctl boot $SIMULATOR_ID
          xcrun simctl install $SIMULATOR_ID mobile/build/Build/Products/Release-iphonesimulator/mobile.app
      - name: Run Maestro flows
        run: maestro test mobile/.maestro/flows/
```

**Cost note (MEDIUM confidence):** `macos-latest` minutes cost 10x Ubuntu minutes on GitHub Actions. For a public repo this is free. For a private repo the team should budget ~15 min/run × 10x multiplier.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| In-memory SQLite for tests | Custom file-based test DB | `better-sqlite3` with `':memory:'` | Zero cleanup, full isolation, synchronous API |
| Migration runner | Custom SQL executor | `migrate()` from `drizzle-orm/better-sqlite3/migrator` | Handles migration state, idempotent |
| iOS simulator control | Custom ADB/simctl wrapper | Maestro CLI | Handles element targeting, retries, assertions |
| Test data seeding | Raw SQL inserts per test | Factory functions + Drizzle insert | Type-safe, refactor-friendly |
| CI pipeline | Custom scripts | GitHub Actions YAML | Native branch protection integration |
| NetInfo mock management | Per-test `jest.mock()` calls | Centralized `networkHelper.ts` | Single-place rule from CLAUDE.md |

**Key insight:** The existing mock-based tests cover unit behavior well. The gap is in integration confidence for critical flows. Don't replace mocks — add a parallel integration test layer.

---

## Common Pitfalls

### Pitfall 1: better-sqlite3 migration path mismatch
**What goes wrong:** `migrate(db, { migrationsFolder: './drizzle' })` fails with "no migrations found" when run from a test file because the path is relative to the CWD of the Jest process, not the test file.
**Why it happens:** Jest runs from the package root (`mobile/`). The path `./drizzle` works from there, but if tests set a different CWD it breaks.
**How to avoid:** Use `path.join(__dirname, '../../drizzle')` with `__dirname` resolution in `integrationDb.ts`. Test from `mobile/` directory always.
**Warning signs:** `Error: No migrations found in ...` on first integration test run.

### Pitfall 2: better-sqlite3 not rebuilt after npm ci
**What goes wrong:** GitHub Actions fails with "The module was compiled against a different Node.js version."
**Why it happens:** `better-sqlite3` prebuilds may not match the runner's Node version exactly.
**How to avoid:** Add `npm rebuild better-sqlite3` step after `npm ci` in CI workflows.
**Warning signs:** Error contains `NODE_MODULE_VERSION` mismatch.

### Pitfall 3: Integration tests accidentally using expo-sqlite mock
**What goes wrong:** Integration tests pass but don't actually hit real SQLite because `setup.ts` mocks `expo-sqlite` globally.
**Why it happens:** `setupFilesAfterEnv` runs for ALL test files unless overridden.
**How to avoid:** Create `setup.integration.ts` that does NOT mock `expo-sqlite`/`drizzle-orm/expo-sqlite`. Use a separate Jest config (`jest.integration.config.js`) for integration tests.
**Warning signs:** Integration tests pass even when schema has errors.

### Pitfall 4: Maestro testID not propagating to iOS accessibility ID
**What goes wrong:** Maestro can't find elements by `id: "login-button"` on iOS.
**Why it happens:** On iOS, `testID` maps to `accessibilityIdentifier`, not `accessibilityLabel`. Maestro uses the accessibility ID.
**How to avoid:** Use `testID` (not `accessibilityLabel`) on all interactive elements. Verify with Maestro Studio (`maestro studio`) locally before writing CI flows.
**Warning signs:** `Element not found` errors on iOS but not Android.

### Pitfall 5: Expo prebuild generating ios/ directory committed to git
**What goes wrong:** CI generated `ios/` directory conflicts with gitignore or causes unexpected diff noise.
**Why it happens:** `npx expo prebuild` generates native directories. These should not be committed for a managed-workflow project.
**How to avoid:** Add `mobile/ios/` and `mobile/android/` to `.gitignore` if using CNG (Continuous Native Generation). The CI step uses `--clean` to regenerate from scratch.
**Warning signs:** PR diffs contain hundreds of Xcode project file changes.

### Pitfall 6: resetAllMocks vs clearAllMocks in integration tests
**What goes wrong:** Factory functions or shared mocks get unexpectedly cleared between tests.
**Why it happens:** `jest.resetAllMocks()` clears `mockReturnValueOnce` queues; `jest.clearAllMocks()` only clears calls/instances. Project established: use `resetAllMocks` for unit tests, `clearAllMocks` for offlineAuth tests.
**How to avoid:** Integration tests don't use Jest mocks for the DB layer at all — they use real better-sqlite3. Keep the distinction: mock tests → `resetAllMocks`, integration tests → no mocks needed for DB.

### Pitfall 7: Screen refactor breaking existing mock-based tests
**What goes wrong:** Extracting logic from screens into hooks changes the import paths that existing unit tests rely on.
**Why it happens:** Some tests may test logic that currently lives in screens (via indirect imports).
**How to avoid:** Run full test suite after each refactor step (not just at the end). Screen logic moving to hooks is expected — update test imports accordingly.

### Pitfall 8: offlineAuth.test.ts currently failing
**What goes wrong:** `OfflineAuthService.cacheCredential` stores a `password` field in plaintext in the credential object. The test from Phase 8 expects this NOT to exist (hash-only storage). This is a **test regression** — the service implementation doesn't match the spec.
**Why it happens:** Phase 8 implementation diverged from the expected behavior.
**How to avoid:** Fix the service or fix the test in Wave 0 before adding new tests.

---

## Code Examples

### Real SQLite Integration Test Pattern

```typescript
// tests/integration/subgroup-lifecycle.test.ts
// Source: Drizzle ORM better-sqlite3 adapter + migrate function

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import * as schema from '../../src/database/schema';
import { createSubGroup, finalizeSubGroup } from '../../src/repositories/SubGroupRepository';
import { createTestPlantation, createTestSubGroup } from '../helpers/factories';

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });
  migrate(testDb, { migrationsFolder: path.join(__dirname, '../../drizzle') });
});

afterAll(() => {
  sqlite.close();
});

beforeEach(async () => {
  await testDb.delete(schema.trees);
  await testDb.delete(schema.subgroups);
  await testDb.delete(schema.plantations);
});

it('SubGroup lifecycle: activa -> finalizada (SUBG-05)', async () => {
  // Insert plantation directly
  await testDb.insert(schema.plantations).values(createTestPlantation({ id: 'p1' }));
  
  // Create subgroup via repository (uses injected db or we swap the module)
  // NOTE: Repository uses module-level db import — requires jest.mock or dependency injection
  // For integration tests, prefer calling Drizzle directly or refactor repo to accept db param
  const result = await testDb.insert(schema.subgroups).values(
    createTestSubGroup({ id: 'sg1', plantacionId: 'p1' })
  );

  // Verify cascade behavior, constraints, etc.
  const rows = await testDb.select().from(schema.subgroups);
  expect(rows).toHaveLength(1);
  expect(rows[0].estado).toBe('activa');
});
```

**Important caveat:** Repositories use module-level `db` import from `src/database/client`. This makes them hard to inject in integration tests. Two options:
1. Use `jest.mock('../../src/database/client', () => ({ db: testDb }))` — works but requires module reload per test
2. Call Drizzle directly in integration tests (bypassing repository functions) to test SQL behavior
3. Refactor repositories to accept optional `db` parameter (dependency injection) — cleanest but requires refactor work

**Recommendation for Phase 9:** Use option 2 (direct Drizzle calls) for integration tests that test SQL constraints and cascade behavior. Use option 1 (mock swap) for integration tests that test repository business logic. Document this decision in the plan.

### Dependency Injection Refactor Pattern for Repository

```typescript
// Refactored SubGroupRepository.ts pattern
import { db as defaultDb } from '../database/client';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

type DB = typeof defaultDb | BetterSQLite3Database<typeof schema>;

export async function createSubGroup(
  params: CreateSubGroupParams,
  db: DB = defaultDb  // optional for injection
): Promise<...> {
  // implementation
}
```

This pattern allows integration tests to inject the in-memory DB without mocking.

### Offline Network Mock Helper

```typescript
// tests/helpers/networkHelper.ts
import NetInfo from '@react-native-community/netinfo';

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
};

export function setNetworkState(state: NetworkState) {
  (NetInfo.fetch as jest.Mock).mockResolvedValue(state);
  (NetInfo.fetch as jest.Mock).mockResolvedValue(state);
}

export const setOffline = () => setNetworkState({ isConnected: false, isInternetReachable: false });
export const setOnline = () => setNetworkState({ isConnected: true, isInternetReachable: true });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Detox for RN E2E | Maestro YAML flows | 2022-2023 | Dramatically simpler YAML syntax, no JS boilerplate |
| EAS-only CI | Self-hosted macOS runner | 2024 | Free for public repos, full control |
| Mock-everything Jest | Hybrid mock + real SQLite | 2023+ | Better confidence for SQL constraint testing |
| Factory libraries (factory.ts) | Plain TypeScript Partial<T> functions | Ongoing | Zero deps, type-safe, easier to understand |

**Deprecated/outdated:**
- Detox: Still maintained but Maestro is the simpler choice for new projects
- Enzyme: Not applicable here (no RNTL render tests in this phase)
- Jest `testEnvironment: 'jsdom'` for React Native: Project correctly uses `'node'`

---

## Open Questions

1. **Repository dependency injection scope**
   - What we know: Repositories use module-level `db` import. Direct injection is not currently supported.
   - What's unclear: How deeply to refactor for integration test support without over-engineering.
   - Recommendation: Add optional `db` param to the 3-5 repository functions that need integration tests. Minimal footprint — only where integration tests are planned.

2. **Expo app.json bundle identifier**
   - What we know: `app.json` exists in the project root (recently added per git status). It likely has bundle identifier configuration.
   - What's unclear: The actual `ios.bundleIdentifier` value (not read during research).
   - Recommendation: Planner should read `app.json` to get the bundle identifier and hard-code it in Maestro flows.

3. **offlineAuth.test.ts regression root cause**
   - What we know: Test expects hash-only storage but service stores plaintext `password` field.
   - What's unclear: Whether the service implementation is wrong or the test expectation is wrong.
   - Recommendation: Fix `OfflineAuthService.cacheCredential` to not include `password` in the stored credential object (hashed credentials should use `hash` + `salt` only). This is a security fix, not just a test fix.

4. **ESLint configuration**
   - What we know: No ESLint config was found in the codebase scan.
   - What's unclear: Whether `.eslintrc.js` exists or if TypeScript-only checking is sufficient.
   - Recommendation: CI lint job should use `npx tsc --noEmit` as primary quality gate. Add ESLint only if config already exists.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All Jest tests | ✓ | v25.2.1 | — |
| npm | Package management | ✓ | 11.6.2 | — |
| better-sqlite3 | Integration tests | ✗ (not installed) | — | Must install: `npm i -D better-sqlite3 @types/better-sqlite3` |
| Maestro CLI | E2E tests | ✗ (not installed) | — | Install locally + in CI: `curl -Ls https://get.maestro.mobile.dev \| bash` |
| Xcode | iOS E2E builds | ✓ (macOS host) | Not checked | — |
| GitHub Actions | CI pipeline | ✗ (no .github dir) | — | Must create `.github/workflows/` directory |

**Missing dependencies with no fallback:**
- `better-sqlite3` — required for D-05 integration tests; no alternative in Node.js test env
- GitHub Actions workflow files — required for D-12/D-13; must be created from scratch

**Missing dependencies with fallback:**
- Maestro — can run E2E manually locally; CI integration deferred if iOS build setup is complex

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + jest-expo ~54.0.17 |
| Config file | `mobile/jest.config.js` |
| Quick run command | `cd mobile && npx jest --testPathPattern="tests/(auth|hooks|utils)" --ci` |
| Full suite command | `cd mobile && npx jest --ci` |
| Integration run command | `cd mobile && npx jest --config jest.integration.config.js --ci` |

### Phase Requirements → Test Map

| Area | Behavior | Test Type | Command |
|------|----------|-----------|---------|
| Refactor: screens >500 lines | TreeRegistrationScreen, AdminScreen, PlantationDetailScreen decomposed | Manual + lint | `npx tsc --noEmit` |
| Refactor: §9 violations | No `db` import in screens, no direct repo imports in screens | Manual audit | grep check in CI |
| D-05: SubGroup lifecycle | activa → finalizada with real SQLite | Integration | `jest tests/integration/subgroup*.test.ts` |
| D-05: cascade delete | deletePlantationLocally removes trees+subgroups | Integration | `jest tests/integration/cascade*.test.ts` |
| D-05: sync atomicity | uploadSubGroup + markAsSincronizada in transaction | Integration | `jest tests/integration/sync*.test.ts` |
| D-03: offline auth | signIn falls back to cached credentials | Unit (existing + fix) | `jest tests/auth/offlineAuth.test.ts` |
| D-03: role-based access | Admin sees all plantations, tecnico sees assigned only | Unit | `jest tests/queries/dashboardQueries.test.ts` |
| D-08: network helpers | setOffline/setOnline configure all relevant mocks | Unit | `jest tests/helpers/networkHelper.test.ts` |
| D-10: factory functions | factories produce valid typed objects with overrides | Unit | `jest tests/helpers/factories.test.ts` |
| D-06: E2E login offline | User can log in with cached credentials on Maestro | E2E manual | `maestro test .maestro/flows/01-login-offline.yaml` |
| D-06: E2E register tree | Technician registers a tree in a subgroup | E2E manual | `maestro test .maestro/flows/02-register-tree.yaml` |
| D-06: E2E sync subgroup | Technician syncs a finalizada subgroup | E2E manual | `maestro test .maestro/flows/03-sync-subgroup.yaml` |
| D-12/D-13: CI pipeline | All jobs pass on branch push | CI | GitHub Actions on push |

### Sampling Rate
- **Per task commit:** `cd mobile && npx jest --testPathPattern="(auth|hooks|utils)" --ci` (fast unit subset)
- **Per wave merge:** `cd mobile && npx jest --ci` (full suite)
- **Phase gate:** Full suite green + E2E flows run locally before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `mobile/tests/helpers/factories.ts` — covers D-10
- [ ] `mobile/tests/helpers/networkHelper.ts` — covers D-08/D-09
- [ ] `mobile/tests/helpers/integrationDb.ts` — covers D-05 infrastructure
- [ ] `mobile/jest.integration.config.js` — separate config for real SQLite tests
- [ ] `mobile/tests/setup.integration.ts` — integration setup without expo-sqlite mock
- [ ] Fix: `mobile/tests/auth/offlineAuth.test.ts` — failing test (Pitfall 8)
- [ ] Fix: `mobile/tests/database/seed.test.ts` — missing `db.delete` mock
- [ ] Fix: `mobile/tests/hooks/useProfileData.test.ts` — failing (investigate)
- [ ] Install: `npm install --save-dev better-sqlite3 @types/better-sqlite3`
- [ ] Create: `.github/workflows/ci.yml` and `.github/workflows/e2e.yml`
- [ ] Add to package.json scripts: `"test": "jest"`, `"test:unit": "jest --testPathPattern=..."`, `"test:integration": "jest --config jest.integration.config.js"`, `"typecheck": "tsc --noEmit"`

---

## Project Constraints (from CLAUDE.md)

All directives that constrain Phase 9 planning:

| Rule | Directive | Impact on Phase 9 |
|------|-----------|-------------------|
| §3: Refactor if >20 lines | Refactor rule applies to functions, not files. But D-01/D-02 extend this to file-level decomposition | Screen decomposition is mandatory before tests |
| §8: Centralized design | All colors/styles from `theme.ts`. Zero duplication admin/tecnico | Refactored screen components must import from theme |
| §9: No queries in screens | Screens never import `db`, repositories, queries, or services directly | All screen violations must be fixed in refactor pass |
| §9: Hooks as bridge | Hooks call repositories/queries, don't contain raw SQL | New hooks extracted during refactor must not contain SQL |
| §1: Planning first | No implementation without approval | Plans must be approved before implementing waves |

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis (direct file reads) — all refactor targets, test gaps, failing tests
- `mobile/jest.config.js` — confirmed Jest configuration
- `mobile/tests/setup.ts` — confirmed mock setup
- `mobile/tests/` — confirmed 24 test files, 159 tests, 154 passing

### Secondary (MEDIUM confidence)
- [Drizzle ORM better-sqlite3 discussion](https://github.com/drizzle-team/drizzle-orm/discussions/784) — integration test patterns, no official recommendation
- [Expo E2E with Maestro docs](https://docs.expo.dev/eas/workflows/examples/e2e-tests/) — EAS Workflows approach (adapted for self-hosted)
- [Maestro React Native tips](https://dev.to/retyui/best-tips-tricks-for-e2e-maestro-with-react-native-2kaa) — testID best practices, CI considerations
- [Lingvano Maestro + Expo](https://medium.com/lingvano/native-e2e-testing-with-maestro-and-expo-14e9e9b0f0fe) — eas.json simulator profile, GitHub Actions structure
- npm registry — better-sqlite3@12.8.0 (verified), @types/better-sqlite3@7.6.13 (verified)

### Tertiary (LOW confidence)
- GitHub Actions workflow structure for macOS iOS E2E — assembled from multiple sources, exact xcodebuild paths may vary by project name

---

## Metadata

**Confidence breakdown:**
- Refactor targets: HIGH — direct codebase analysis
- Test coverage gaps: HIGH — direct file listing
- Standard stack: HIGH — npm registry verified, existing config confirmed
- Integration test patterns: MEDIUM — Drizzle discussion shows no official stance, pattern is established in community
- Maestro CI patterns: MEDIUM — documentation exists but self-hosted iOS without EAS has fewer reference implementations
- GitHub Actions YAML: MEDIUM — assembled from multiple sources, will need adjustment to actual project names

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable toolchain — jest, better-sqlite3, Maestro are not fast-moving)
