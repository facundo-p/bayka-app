---
phase: 09-testing-strategy
plan: "06"
subsystem: testing
tags: [maestro, e2e, github-actions, ios-simulator, testid, ci-cd]

# Dependency graph
requires:
  - phase: 09-testing-strategy/09-02
    provides: SpeciesButtonGrid component (species buttons refactored from TreeRegistrationScreen)
  - phase: 09-testing-strategy/09-03
    provides: PlantationDetailScreen refactored to <200 lines
  - phase: 09-testing-strategy/09-04
    provides: PlantacionesScreen refactored
  - phase: 09-testing-strategy/09-05
    provides: NuevoSubgrupoScreen refactored
provides:
  - "Maestro E2E flows for 3 critical user journeys: offline login, tree registration, subgroup sync"
  - "testID props on all critical interactive elements for E2E test targeting"
  - "GitHub Actions E2E workflow triggering on PR to main with macOS runner"
  - "Reusable Maestro login helper subflow"
affects: [ci-cd, e2e-testing, branch-protection]

# Tech tracking
tech-stack:
  added: [maestro, github-actions-macos]
  patterns:
    - "testID naming: {element-type}-{identifier} (e.g. species-btn-PEU, subgroup-card-{id})"
    - "Two-tier CI: fast checks (push) via ci.yml, full E2E (PR to main) via e2e.yml"
    - "Maestro helper subflows for reusable login sequence"

key-files:
  created:
    - mobile/.maestro/helpers/login.yaml
    - mobile/.maestro/flows/01-login-offline.yaml
    - mobile/.maestro/flows/02-register-tree.yaml
    - mobile/.maestro/flows/03-sync-subgroup.yaml
    - .github/workflows/e2e.yml
  modified:
    - mobile/app/(auth)/login.tsx
    - mobile/src/components/SpeciesButton.tsx
    - mobile/src/components/SpeciesButtonGrid.tsx
    - mobile/src/screens/PlantacionesScreen.tsx
    - mobile/src/screens/PlantationDetailScreen.tsx
    - mobile/src/screens/TreeRegistrationScreen.tsx

key-decisions:
  - "testID species-btn-{code} placed in SpeciesButtonGrid.tsx (not TreeRegistrationScreen) — consistent with 09-02 refactor"
  - "Two-tier CI pattern: macos-latest only on PR to main, not on every push — manages macOS runner cost (10x Ubuntu)"
  - "Bundle ID com.bayka.app used in Maestro flows (matches Android package; no iOS bundleIdentifier in app.json)"
  - "Task 3 (branch protection) is a human action — auto-approved per auto_advance mode; user must manually enable in GitHub settings"

patterns-established:
  - "testID naming: {widget-type}-{unique-identifier} for Maestro targeting"
  - "Maestro helpers/ for reusable subflows, flows/ for full journeys"

requirements-completed: [TEST-E2E, TEST-CI-E2E, TEST-CI]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 09 Plan 06: E2E Flows and Maestro CI Summary

**3 Maestro E2E flows (offline login, tree registration, subgroup sync) with testID instrumentation on critical UI elements and GitHub Actions E2E pipeline gating PRs to main on macOS runner**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-08T00:43:12Z
- **Completed:** 2026-04-08T00:47:00Z
- **Tasks:** 2 auto + 1 checkpoint (auto-approved)
- **Files modified:** 10

## Accomplishments
- Added testID props to all critical interactive elements: login inputs/button, plantation list, subgroup list/cards, sync button, species buttons (species-btn-{code}), N/N button, tree count, undo button, finalize button
- Created 3 complete Maestro YAML flows covering the critical user journeys: offline login with cached credentials, one-tap tree registration with undo, and subgroup finalize + sync
- Created reusable `helpers/login.yaml` subflow for DRY login across all E2E flows
- Created `.github/workflows/e2e.yml` — full iOS simulator pipeline on macOS runner triggered on PR to main
- Established two-tier CI: fast lint/unit/integration on push (ci.yml), full E2E only on PR to main (e2e.yml)

## Task Commits

1. **Task 1: Add testIDs + create Maestro E2E flows** - `2436f72` (feat)
2. **Task 2: Create GitHub Actions E2E workflow** - `a414c94` (feat)
3. **Task 3: Branch protection checkpoint** - auto-approved (human action required in GitHub settings)

## Files Created/Modified

- `mobile/app/(auth)/login.tsx` - Added testID to email-input, password-input, login-button, email-chip-{email}
- `mobile/src/components/SpeciesButton.tsx` - Added testID prop to component interface and Pressable
- `mobile/src/components/SpeciesButtonGrid.tsx` - Added testID="species-btn-{code}" and testID="nn-button"
- `mobile/src/screens/PlantacionesScreen.tsx` - Added testID="plantaciones-list" and plantation-card-{id}
- `mobile/src/screens/PlantationDetailScreen.tsx` - Added testID to subgroup-list, subgroup-card-{id}, sync-button
- `mobile/src/screens/TreeRegistrationScreen.tsx` - Added testID to tree-count, undo-button, finalize-button
- `mobile/.maestro/helpers/login.yaml` - Reusable login subflow (created)
- `mobile/.maestro/flows/01-login-offline.yaml` - Offline/cached credential login flow (created)
- `mobile/.maestro/flows/02-register-tree.yaml` - Species tap + tree registration + undo flow (created)
- `mobile/.maestro/flows/03-sync-subgroup.yaml` - Finalize + sync subgroup flow (created)
- `.github/workflows/e2e.yml` - GitHub Actions E2E pipeline with Maestro on macOS runner (created)

## Decisions Made

- testID `species-btn-{code}` placed in `SpeciesButtonGrid.tsx` (not `TreeRegistrationScreen`) — consistent with component refactor from plans 09-02
- Two-tier CI: macOS runner only triggers on PR to main (not every push) — manages cost (10x Ubuntu minutes for private repos)
- Used `com.bayka.app` as Maestro `appId` matching Android package in app.json (no iOS bundleIdentifier defined)
- Task 3 checkpoint (branch protection) auto-approved per `auto_advance: true`; user must manually enable branch protection in GitHub Settings → Branches → Add rule for `main`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added testID prop to SpeciesButton component**
- **Found during:** Task 1 (adding testID to SpeciesButtonGrid)
- **Issue:** Plan said to add `testID="species-btn-{code}"` to SpeciesButtonGrid, but the actual species button is rendered by the `SpeciesButton` child component. The Pressable is inside SpeciesButton, not SpeciesButtonGrid — passing testID without accepting it would silently drop the prop.
- **Fix:** Added `testID?: string` to SpeciesButton's Props interface and forwarded it to the Pressable
- **Files modified:** `mobile/src/components/SpeciesButton.tsx`
- **Committed in:** `2436f72` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing prop forwarding for testID)
**Impact on plan:** Essential fix — without it, testID would be silently ignored and Maestro could not target species buttons. No scope creep.

## Issues Encountered

- The worktree does not have `node_modules` installed, so TypeScript could not be checked via `npx tsc`. Verified against main repo's tsc — all errors are pre-existing (unrelated to this plan's changes). testID is a standard React Native prop accepted by all Pressable/TouchableOpacity/TextInput/View components, so no type errors introduced.

## User Setup Required

**Branch protection must be enabled manually:**
1. Go to GitHub repo → Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Enable "Require status checks to pass before merging"
4. Add required checks: `lint`, `unit`, `integration`, `e2e-ios`
5. Save changes

## Next Phase Readiness

- E2E foundation complete: 3 Maestro flows targeting real testIDs in production components
- Two-tier CI pipeline established: ci.yml (fast, every push) + e2e.yml (full E2E, PR to main)
- Flows use test user `tecnico1@bayka.com` — requires that user to exist in seeded data
- Species code `PEU` used in flows — adjust if seeded species differ

---
*Phase: 09-testing-strategy*
*Completed: 2026-04-08*
