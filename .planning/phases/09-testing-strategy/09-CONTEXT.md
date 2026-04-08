# Phase 9: Testing Strategy - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor critical code (eliminate duplication, decompose large files) then implement comprehensive testing covering critical business functionality — offline operations, sync flows, data integrity, and role-based access. Set up CI/CD pipeline in GitHub Actions. Unit tests, integration tests with real SQLite, and Maestro E2E basics.

</domain>

<decisions>
## Implementation Decisions

### Refactor scope (pre-testing)
- **D-01:** Phase 9 starts with a refactor pass before writing tests: eliminate duplicate code, decompose screen/component files over 500 lines into smaller testable units
- **D-02:** Refactor targets: screens and components with excessive length, duplicated patterns between admin/tecnico, any inline logic that should be extracted to repositories/queries/services per CLAUDE.md rule 9

### Test coverage priorities
- **D-03:** Critical paths first — prioritize: (1) offline flow (cached auth, data persistence), (2) sync pipeline (upload atomicity, download integrity, conflict detection), (3) data integrity (SubGroup lifecycle, cascade delete, tree registration), (4) role-based access (admin vs tecnico data visibility)
- **D-04:** Data + service layer only — repositories, queries, services, and key hooks (useAuth, useSync). No screen-level render tests in this phase

### Test types & tooling
- **D-05:** Real SQLite integration tests for critical paths — spin up in-memory SQLite, run migrations, test actual queries (sync, cascade delete, SubGroup lifecycle). Replaces mock-only approach for these flows
- **D-06:** Maestro E2E for 2-3 critical user journeys: login offline, register tree, sync SubGroup. YAML-based flows
- **D-07:** Keep existing Jest unit tests with mocks for fast feedback on individual functions

### Offline simulation strategy
- **D-08:** Centralized test helpers in `tests/helpers/networkHelper.ts`: `setOffline()` / `setOnline()` functions that configure NetInfo mock + Supabase client mock in one place. Consistent with "un solo lugar" rule from CLAUDE.md
- **D-09:** All offline-dependent tests use the centralized helpers, not inline NetInfo mocks

### Test data & fixtures
- **D-10:** Factory functions pattern: `createTestPlantation()`, `createTestSubGroup()`, `createTestTree()`, etc. with sensible defaults and optional overrides. Located in `tests/helpers/factories.ts`
- **D-11:** Minimal but representative data volumes for integration tests: 2-3 plantations, 5-10 subgroups, 20-30 trees. Enough for edge cases (multi-species, N/N, roles) without slow tests

### CI/CD pipeline
- **D-12:** GitHub Actions CI triggered on push to any branch AND on PRs to main
- **D-13:** Two-tier pipeline:
  - Push to branches: 3 parallel jobs — ESLint/TypeScript check, Jest unit tests, Jest integration tests
  - PR/push to main: Full pipeline — Lint + Unit + Integration + Maestro E2E on simulator (macOS runner)
- **D-14:** Branch protection on main — all CI checks required to pass before merge

### Claude's Discretion
- Integration test SQLite setup/teardown mechanics
- Factory function internal implementation and default values
- Maestro flow file organization
- GitHub Actions workflow YAML structure and caching strategy
- Which specific files need refactoring (to be determined by codebase analysis)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing test infrastructure
- `mobile/jest.config.js` — Jest configuration: jest-expo preset, node environment, transform patterns
- `mobile/tests/setup.ts` — Test setup file (setupFilesAfterEnv)
- `mobile/tests/jestSetup.js` — Pre-mock setup for expo winter runtime globals
- `mobile/tests/__mocks__/` — Existing mocks: expo-file-system, expo-image-picker, expoWinterRuntime, fileMock

### Architecture rules
- `.claude/CLAUDE.md` §8 — Centralized design: all colors/styles from theme.ts, zero duplication between admin/tecnico
- `.claude/CLAUDE.md` §9 — Data/presentation separation: no queries in screens/components, repositories/queries/services pattern

### Project context
- `.planning/PROJECT.md` — Core value, constraints, tech stack
- `.planning/REQUIREMENTS.md` — All v1 requirements with traceability to phases

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 24 existing test files: good patterns for mocking Drizzle chains, Supabase client, SecureStore
- `tests/setup.ts` and `tests/jestSetup.js`: test bootstrap already configured
- `tests/__mocks__/`: expo module mocks ready to extend

### Established Patterns
- Drizzle mock chain: intermediate methods return chain, terminal methods resolve to arrays, re-init in beforeEach
- `jest.resetAllMocks()` in beforeEach (Phase 6 decision) — except offlineAuth tests which use `clearAllMocks`
- Plain JS object chain mocks for Supabase (not jest.fn()) to survive resetAllMocks
- Module-level mocking for db imports (ES module closures)

### Integration Points
- `mobile/src/repositories/` — 5 repositories, all need integration test coverage
- `mobile/src/services/` — 4 services (SyncService, OfflineAuthService, ExportService, PhotoService)
- `mobile/src/queries/` — 6 query modules
- `mobile/src/hooks/` — 12 hooks, only 2 tested (useNetStatus, useProfileData)

### Files likely needing refactor (>500 lines to investigate)
- Screen files in `mobile/src/screens/`
- Possible duplication between admin/tecnico route wrappers

</code_context>

<specifics>
## Specific Ideas

- User saw screen files over 500 lines — wants these decomposed before testing
- Two-tier CI: fast checks on branches, full E2E gate on main
- Offline simulation must be a first-class concern — centralized helpers, not afterthought mocks
- Factory functions should be typed and follow the existing TypeScript patterns

</specifics>

<deferred>
## Deferred Ideas

- Performance/load testing with realistic field volumes (1000+ trees) — future phase
- Screen-level render tests with React Native Testing Library — future phase
- Visual regression testing — future phase

</deferred>

---

*Phase: 09-testing-strategy*
*Context gathered: 2026-04-08*
