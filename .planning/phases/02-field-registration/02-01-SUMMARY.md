---
phase: 02-field-registration
plan: "01"
subsystem: database
tags: [drizzle-orm, sqlite, expo-image-picker, expo-file-system, tdd, utils]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: "SQLite client, Drizzle migrations, schema with species/plantations/subgroups/trees"
provides:
  - "plantation_species table in SQLite schema with FK references"
  - "Unique index on subgroups(plantacion_id, codigo) enforcing SUBG-02"
  - "Drizzle migration 0001_noisy_triton.sql"
  - "Demo plantation seed (DEMO_PLANTATION_ID) and species-link seed"
  - "generateSubId pure function (TREE-04)"
  - "computeReversedPositions pure function (REVR-01/REVR-02)"
  - "expo-image-picker and expo-file-system installed"
  - "Test scaffold for SubGroupRepository and TreeRepository (Plan 02-02)"
  - "Mocks for expo-image-picker and expo-file-system"
affects:
  - 02-02-subgroup-tree-repository
  - 02-03-registration-ui
  - 02-04-photo-capture

# Tech tracking
tech-stack:
  added:
    - expo-image-picker ~16.0.6 (SDK 52 compatible)
    - expo-file-system ~18.0.12 (SDK 52 compatible)
  patterns:
    - "Seed functions are idempotent — check count before insert, return early if > 0"
    - "TDD: write failing test, commit RED, implement, commit GREEN"
    - "Drizzle uniqueIndex via second argument to sqliteTable"

key-files:
  created:
    - mobile/src/database/seeds/seedPlantation.ts
    - mobile/src/database/seeds/seedPlantationSpecies.ts
    - mobile/src/utils/idGenerator.ts
    - mobile/src/utils/reverseOrder.ts
    - mobile/drizzle/0001_noisy_triton.sql
    - mobile/tests/utils/idGenerator.test.ts
    - mobile/tests/utils/reverseOrder.test.ts
    - mobile/tests/__mocks__/expo-image-picker.js
    - mobile/tests/__mocks__/expo-file-system.js
    - mobile/tests/database/subgroup.test.ts
    - mobile/tests/database/tree.test.ts
  modified:
    - mobile/src/database/schema.ts
    - mobile/app/_layout.tsx
    - mobile/package.json

key-decisions:
  - "Demo plantation uses fixed UUID 00000000-0000-0000-0000-000000000002 for deterministic testing"
  - "Plantation and species seeds wired as chained promise (seedSpecies → seedPlantation → seedPlantationSpecies) to preserve dependency order"
  - "generateSubId is pure string concatenation: subgrupoCodigo + especieCodigo + posicion (no padding)"
  - "computeReversedPositions formula: newPosicion = total - oldPosicion + 1 — input positions need not be contiguous"

patterns-established:
  - "Pattern 1: Seed files export both the seed function and any constants (IDs) other seeds depend on"
  - "Pattern 2: TDD for pure utility functions — commit failing tests before implementation"
  - "Pattern 3: sqliteTable unique index via second argument callback: (t) => ({ name: uniqueIndex(...).on(...) })"

requirements-completed: [SUBG-01, SUBG-02, TREE-03, TREE-04, REVR-01, REVR-02, NN-01]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 2 Plan 01: Field Registration Foundation Summary

**plantation_species table, subgroup unique index, demo seed data, generateSubId + computeReversedPositions pure utils with 8 passing tests, and expo-image-picker/expo-file-system installed**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T21:28:34Z
- **Completed:** 2026-03-17T21:33:04Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Extended Drizzle schema with `plantation_species` table and unique index on `subgroups(plantacion_id, codigo)`, generated migration `0001_noisy_triton.sql`
- Created idempotent seed functions for demo plantation and its species links, wired into app startup in correct dependency order
- Implemented `generateSubId` and `computeReversedPositions` pure utility functions using TDD (8 unit tests all passing)
- Created mocks for `expo-image-picker` and `expo-file-system`, plus test scaffolds for SubGroupRepository and TreeRepository ready for Plan 02-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, extend schema, generate migration, seed demo data** - `92ee5e5` (feat)
2. **Task 2 (RED): Failing tests for generateSubId + computeReversedPositions** - `8bc9ccd` (test)
3. **Task 2 (GREEN): Implement utility functions** - `e3e56be` (feat)
4. **Task 2 (scaffold): Mocks + test scaffolds** - `f87dd27` (chore)

_Note: TDD task split into RED/GREEN/chore commits as per TDD protocol_

## Files Created/Modified
- `mobile/src/database/schema.ts` - Added uniqueIndex on subgroups, added plantation_species table, imported uniqueIndex
- `mobile/app/_layout.tsx` - Added seedPlantationIfNeeded + seedPlantationSpeciesIfNeeded calls after seedSpecies
- `mobile/src/database/seeds/seedPlantation.ts` - Idempotent demo plantation seed with DEMO_PLANTATION_ID constant
- `mobile/src/database/seeds/seedPlantationSpecies.ts` - Seeds all species as plantation_species rows for demo plantation
- `mobile/drizzle/0001_noisy_triton.sql` - CREATE TABLE plantation_species + CREATE UNIQUE INDEX subgroups_plantation_code_unique
- `mobile/src/utils/idGenerator.ts` - generateSubId: concatenates subgrupoCodigo + especieCodigo + posicion
- `mobile/src/utils/reverseOrder.ts` - computeReversedPositions: formula total - oldPosicion + 1 per tree
- `mobile/tests/utils/idGenerator.test.ts` - 4 unit tests for SubID generation
- `mobile/tests/utils/reverseOrder.test.ts` - 4 unit tests for position reversal
- `mobile/tests/__mocks__/expo-image-picker.js` - Jest mock for camera/gallery operations
- `mobile/tests/__mocks__/expo-file-system.js` - Jest mock for file system operations
- `mobile/tests/database/subgroup.test.ts` - Test scaffold (todo) for Plan 02-02
- `mobile/tests/database/tree.test.ts` - Test scaffold (todo) for Plan 02-02
- `mobile/package.json` - Added expo-image-picker ~16.0.6 and expo-file-system ~18.0.12

## Decisions Made
- Demo plantation uses fixed UUID `00000000-0000-0000-0000-000000000002` for deterministic end-to-end testing
- Seed calls chained as sequential promises (not `Promise.all`) to maintain FK dependency order: species → plantation → plantation_species
- `generateSubId` is pure concatenation without padding — matches business rule "L23BANC12" format
- `computeReversedPositions` treats input positions as arbitrary integers, formula holds even if positions are non-contiguous

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete: plantation_species table + unique index in place and migrated
- Utility functions tested and ready for use in Plan 02-02 repositories
- Test scaffolds in place so Plan 02-02 has immediate test feedback structure
- expo-image-picker and expo-file-system available for Plan 02-03/02-04

## Self-Check: PASSED

All created files verified present. All commits verified in git history:
- 92ee5e5 (Task 1: schema + migration + deps + seeds)
- 8bc9ccd (Task 2 RED: failing tests)
- e3e56be (Task 2 GREEN: implementations)
- f87dd27 (Task 2 chore: mocks + scaffolds)

---
*Phase: 02-field-registration*
*Completed: 2026-03-17*
