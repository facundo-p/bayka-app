---
phase: 10-creaci-n-de-plantaci-n-offline-sync-cat-logo-de-especies
plan: 02
subsystem: ui
tags: [offline, react-native, netinfo, securestore, sqlite, drizzle]

requires:
  - phase: 10-01
    provides: createPlantationLocally and saveSpeciesConfigLocally in PlantationRepository, pendingSync column in schema

provides:
  - Connectivity-aware AdminScreen: creates plantations offline or online depending on NetInfo
  - pendingSync badge on PlantationConfigCard (orange "Pendiente de sync" chip)
  - Finalization gate: pendingSync=true plantations cannot be finalized
  - Technician assignment gate: blocked when offline
  - ConfigureSpeciesScreen: uses saveSpeciesConfigLocally for pendingSync plantations
  - organizacionId sourced from useProfileData SecureStore cache (offline-safe)

affects: [sync, admin-screens, plantation-management]

tech-stack:
  added: []
  patterns:
    - "NetInfo.fetch() for point-in-time connectivity check before mutation"
    - "useProfileData hook for offline-safe organizacionId (SecureStore cache-first)"
    - "pendingSync prop threading: AdminScreen -> ConfigureSpeciesScreen"

key-files:
  created: []
  modified:
    - mobile/src/screens/AdminScreen.tsx
    - mobile/src/screens/ConfigureSpeciesScreen.tsx
    - mobile/src/components/PlantationConfigCard.tsx

key-decisions:
  - "colors.stateFinalizada (#F59E0B orange) used for pendingSync badge — colors.warning does not exist in theme"
  - "handleAssignTech extracted as async handler to support NetInfo check before opening modal"
  - "useProfileData replaces manual Supabase profiles fetch in AdminScreen — organizacionId now works offline via SecureStore"

patterns-established:
  - "Connectivity-aware mutation: await NetInfo.fetch() -> isConnected && isInternetReachable check -> branch online/offline path"
  - "Prop threading for offline state: parent passes pendingSync to child screen, child branches on it"

requirements-completed:
  - OFPL-07
  - OFPL-08

duration: 3min
completed: 2026-04-08
---

# Phase 10 Plan 02: Wire Offline Plantation Creation into UI Summary

**Connectivity-aware AdminScreen with offline plantation creation, pendingSync badge, finalization/tech-assignment gates, and offline-safe species config via useProfileData SecureStore cache**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T13:22:00Z
- **Completed:** 2026-04-08T13:25:00Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint — pending user verification)
- **Files modified:** 3

## Accomplishments
- AdminScreen now checks connectivity before creating a plantation: online path calls `createPlantation`, offline path calls `createPlantationLocally`
- organizacionId sourced from `useProfileData` (SecureStore cache-first) — removed direct Supabase profiles fetch that broke offline
- PlantationConfigCard shows orange "Pendiente de sync" badge when `pendingSync=true`
- Finalization blocked for pendingSync plantations with "Sincroniza primero" message
- Technician assignment blocked when offline with "Sin conexion" message
- ConfigureSpeciesScreen branches on `pendingSync` prop: uses `saveSpeciesConfigLocally` for offline plantations

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire offline creation into AdminScreen + ConfigureSpeciesScreen + pending badge** - `1b6baae` (feat)
2. **Task 2: Verify offline plantation creation flow end-to-end** - pending human verification

**Plan metadata:** (to be committed after human verification)

## Files Created/Modified
- `mobile/src/screens/AdminScreen.tsx` - Connectivity-aware creation, useProfileData, finalization gate, tech-assignment gate, passes pendingSync to ConfigureSpeciesScreen
- `mobile/src/screens/ConfigureSpeciesScreen.tsx` - Added pendingSync prop, branches saveSpeciesConfigLocally vs saveSpeciesConfig
- `mobile/src/components/PlantationConfigCard.tsx` - Added pendingSync to Plantation type, orange badge for pending plantations

## Decisions Made
- Used `colors.stateFinalizada` (#F59E0B) for pendingSync badge since `colors.warning` doesn't exist in theme — consistent with finalization/warning semantic
- Extracted `handleAssignTech` as dedicated async function to cleanly contain the NetInfo check logic
- `useProfileData` replaces the ad-hoc Supabase fetch for organizacionId — aligns with CLAUDE.md rule 9 (no data logic in screens)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used colors.stateFinalizada instead of colors.warning**
- **Found during:** Task 1
- **Issue:** Plan specifies `colors.warning` for the pendingSync badge but this color does not exist in theme.ts
- **Fix:** Used `colors.stateFinalizada` (#F59E0B amber/orange) which carries the same warning semantic and is the only orange in the theme
- **Files modified:** mobile/src/components/PlantationConfigCard.tsx, mobile/src/screens/AdminScreen.tsx
- **Verification:** TypeScript compiles without error, badge renders with orange color
- **Committed in:** 1b6baae (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing theme color substitution)
**Impact on plan:** No functional impact — visual result is equivalent. Badge is orange as intended.

## Issues Encountered
- Pre-existing TypeScript error in `SubGroupRepository.ts` (tipo string vs SubGroupTipo union) — out of scope, not introduced by this plan

## Known Stubs
None — all functionality is fully wired. The offline-created plantation will show the badge until synced.

## Next Phase Readiness
- Human verification (Task 2) required: test offline creation flow on device/simulator
- After verification: Phase 10 plan 02 is complete
- Phase 9 (Testing Strategy) can proceed after Phase 10 is verified

---
*Phase: 10-creaci-n-de-plantaci-n-offline-sync-cat-logo-de-especies*
*Completed: 2026-04-08*
