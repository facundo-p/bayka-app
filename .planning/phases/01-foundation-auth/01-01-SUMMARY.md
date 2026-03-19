---
phase: 01-foundation-auth
plan: 01
subsystem: database
tags: [expo, sqlite, drizzle-orm, typescript, jest, react-native, offline-first]

# Dependency graph
requires: []
provides:
  - Expo SDK 55 project scaffolded under mobile/
  - Drizzle ORM schema with species, plantations, subgroups, trees tables
  - SQLite singleton client with WAL mode enabled
  - Metro config bundling .sql migration files
  - Initial Drizzle migration generated (0000_peaceful_winter_soldier.sql)
  - Domain types: Role, UserProfile, Session
  - Species JSON seed data (10 Argentine native species)
  - Idempotent species seed function
  - Jest test infrastructure with expo-compatible setup
  - 6 passing unit tests (3 seed, 3 migration)
affects: [01-02, 01-03, 02-01, 02-02, 03-01]

# Tech tracking
tech-stack:
  added:
    - expo@55.0.6 (SDK 55)
    - expo-router@55.0.5 (file-based routing)
    - expo-sqlite@55.0.10 (local SQLite)
    - drizzle-orm@0.45.1 (type-safe ORM + useMigrations hook)
    - drizzle-kit@0.31.9 (dev: migration generation)
    - "@supabase/supabase-js@2.99.2" (auth + backend)
    - expo-secure-store@55.0.8 (encrypted token storage)
    - "@react-native-async-storage/async-storage@2.2.0" (Supabase session storage)
    - react-native-url-polyfill@3.0.0 (required by Supabase)
    - "@react-native-community/netinfo@11.5.2" (connectivity detection)
    - jest-expo@55.0.9 (test runner)
  patterns:
    - SQLite singleton with WAL mode pragma before first query
    - Metro config extended for .sql file bundling
    - useMigrations hook gates app rendering before any screen loads
    - Idempotent seed using count() check before insert
    - jest jestSetup.js pre-mocks expo winter runtime globals to avoid import.meta issues

key-files:
  created:
    - mobile/metro.config.js
    - mobile/drizzle.config.ts
    - mobile/src/database/schema.ts
    - mobile/src/database/client.ts
    - mobile/src/types/domain.ts
    - mobile/assets/species.json
    - mobile/src/database/seeds/seedSpecies.ts
    - mobile/drizzle/0000_peaceful_winter_soldier.sql
    - mobile/drizzle/migrations.js
    - mobile/app/_layout.tsx
    - mobile/jest.config.js
    - mobile/tests/setup.ts
    - mobile/tests/jestSetup.js
    - mobile/tests/database/seed.test.ts
    - mobile/tests/database/migrations.test.ts
  modified:
    - mobile/package.json (entry point changed to expo-router/entry)
    - mobile/app.json (added scheme: bayka, slug: bayka)

key-decisions:
  - "Entry point set to expo-router/entry (not index.ts) to enable file-based routing"
  - "jest testEnvironment: node avoids React Native renderer conflicts for unit tests"
  - "jestSetup.js pre-defines __ExpoImportMetaRegistry and structuredClone to prevent expo winter runtime from triggering dynamic import errors in jest"
  - "SQL files mocked via moduleNameMapper (\\.sql$ -> fileMock.js) for jest compatibility"
  - "drizzle-orm added with --legacy-peer-deps due to react-dom peer conflict in Expo SDK 55"

patterns-established:
  - "Pattern: SQLite client (client.ts) — single file, WAL pragma immediately after open, export db"
  - "Pattern: Migration gate in _layout.tsx — useMigrations runs before any Slot renders"
  - "Pattern: Jest setup — jestSetup.js (setupFiles) for global mocks, setup.ts (setupFilesAfterEnv) for module mocks"

requirements-completed: [FOUN-01, FOUN-02, FOUN-03]

# Metrics
duration: 14min
completed: 2026-03-17
---

# Phase 1 Plan 01: DB Foundation Summary

**Expo SDK 55 app scaffolded with Drizzle ORM + SQLite WAL client, migration-generated schema for 4 tables, and green jest tests for seeding and migration infrastructure**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-17T01:55:00Z
- **Completed:** 2026-03-17T02:09:00Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Expo SDK 55 project with expo-router configured, all dependencies installed
- Drizzle schema (species, plantations, subgroups, trees) with generated initial migration
- SQLite singleton client with WAL mode + useMigrations gate in root layout
- 10-species JSON seed file with idempotent seedSpeciesIfNeeded() function
- Jest infrastructure working with expo-compatible configuration (6 tests green)

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffolding + DB infrastructure** - `23bb971` (feat)
2. **Task 2: Species seed data + unit tests** - `2b95790` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `mobile/metro.config.js` - Metro config with .sql extension for migration bundling
- `mobile/drizzle.config.ts` - Drizzle kit config (schema path, expo driver)
- `mobile/src/database/schema.ts` - 4-table Drizzle schema (species/plantations/subgroups/trees)
- `mobile/src/database/client.ts` - SQLite singleton, WAL pragma, Drizzle export
- `mobile/src/types/domain.ts` - Role, UserProfile, Session type definitions
- `mobile/assets/species.json` - 10 Argentine native species seed data
- `mobile/src/database/seeds/seedSpecies.ts` - Idempotent seed function with count() check
- `mobile/drizzle/0000_peaceful_winter_soldier.sql` - Generated initial migration
- `mobile/drizzle/migrations.js` - Drizzle migrator module
- `mobile/app/_layout.tsx` - Root layout with useMigrations gate and error screen
- `mobile/app/index.tsx` - Placeholder index screen for expo-router
- `mobile/jest.config.js` - Jest config with jest-expo preset, node env, SQL mock
- `mobile/tests/setup.ts` - jest.mock() for expo-sqlite, netinfo, drizzle
- `mobile/tests/jestSetup.js` - Pre-defines expo winter runtime globals
- `mobile/tests/database/seed.test.ts` - 3 tests: empty table insert, idempotency, field validation
- `mobile/tests/database/migrations.test.ts` - 3 tests: migrations importable, db defined, schema defined
- `mobile/package.json` - expo-router/entry as main; all dependencies added

## Decisions Made
- Used `testEnvironment: 'node'` in jest config — unit tests don't need React Native renderer
- Added `jestSetup.js` as `setupFiles` (runs before modules) to pre-define `__ExpoImportMetaRegistry` and `structuredClone` — Expo SDK 55 winter runtime lazily defines these as globals, but when triggered inside jest they fail with "import outside test scope" because `@ungap/structured-clone` uses ES module syntax
- Used `--legacy-peer-deps` for Supabase install — react-dom peer conflict in Expo SDK 55 tree

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed expo winter runtime dynamic import errors in jest**
- **Found during:** Task 2 (running tests)
- **Issue:** jest-expo preset sets up expo's winter runtime via setupFiles; when `__ExpoImportMetaRegistry` or `structuredClone` lazy getters fired, they called `require('@ungap/structured-clone')` which is an ES module, causing jest-runtime to throw "You are trying to import a file outside of the scope of the test code"
- **Fix:** Added `tests/jestSetup.js` (configured as `setupFiles`) that pre-defines these globals before the lazy getters can fire. Also fixed `setupFilesAfterFramework` typo (plan error) to `setupFilesAfterEnv`
- **Files modified:** mobile/jest.config.js, mobile/tests/jestSetup.js (new)
- **Verification:** All 6 tests pass
- **Committed in:** 2b95790 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required for tests to run at all. No scope creep.

## Issues Encountered
- `setupFilesAfterFramework` in the plan spec is not a valid Jest config key — correct key is `setupFilesAfterEnv`. Auto-fixed per deviation Rule 3.
- `react-dom` peer conflict when installing Supabase packages — resolved with `--legacy-peer-deps` (standard for Expo projects).

## Next Phase Readiness
- Database foundation complete: schema, migrations, client, and seed all working
- Plan 01-02 (Supabase backend setup) can proceed independently
- Plan 01-03 (Auth implementation) depends on this plan's types and DB client
- The `drizzle/migrations.js` is ready to be imported by `useMigrations` in production

## Self-Check: PASSED

All key files verified present. Both task commits verified in git log.

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-17*
