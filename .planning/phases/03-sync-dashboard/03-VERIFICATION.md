---
phase: 03-sync-dashboard
verified: 2026-03-19T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Log in as tecnico and confirm only assigned plantations appear on dashboard"
    expected: "Tecnico sees only plantations where plantation_users has their userId; admin sees all plantations"
    why_human: "Role-gated query logic is unit-tested but actual plantation_users rows on device depend on seeded data and sync having run at least once"
  - test: "Navigate to a plantation with finalizada SubGroups — sync CTA button is visible"
    expected: "Blue 'Sincronizar N subgrupos' button appears above the SubGroup list when pendingCount > 0"
    why_human: "Requires a device with finalizada data; visual placement and conditional rendering cannot be verified programmatically"
  - test: "Tap 'Sincronizar' with internet connection"
    expected: "Confirmation dialog appears in Spanish, then progress modal shows 'Sincronizando... X de Y', then results summary"
    why_human: "Requires live Supabase RPC call and real network; end-to-end flow cannot be verified by grep or unit tests"
  - test: "After successful sync, verify SubGroup state chip changes to 'Sincronizada'"
    expected: "SubGroups that were finalizada now show sincronizada chip and are immutable (no edit button)"
    why_human: "State transition requires live RPC call and UI re-render"
  - test: "Verify tab icon badge shows correct total pending count"
    expected: "Orange badge with number appears on Plantaciones tab icon when any finalizada SubGroups exist; badge disappears after all sync"
    why_human: "Badge visibility depends on live usePendingSyncCount reactive query and actual device state"
---

# Phase 3: Sync Dashboard Verification Report

**Phase Goal:** Technicians can see their plantation progress on the dashboard and manually sync finalizada SubGroups to the server, downloading other technicians' data in return
**Verified:** 2026-03-19
**Status:** human_needed (all automated checks pass — 5 items need device testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supabase RPC sync_subgroup inserts SubGroup + trees atomically in one transaction | VERIFIED | `supabase/migrations/002_sync_rpc.sql` — PLPGSQL with INSERT INTO subgroups + INSERT INTO trees via jsonb_array_elements, EXCEPTION WHEN OTHERS, ON CONFLICT idempotency |
| 2 | RPC returns DUPLICATE_CODE when a different SubGroup with the same plantation+codigo already exists | VERIFIED | `002_sync_rpc.sql` line 36: `RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE')` |
| 3 | RPC is idempotent — re-uploading the same SubGroup UUID is a no-op | VERIFIED | `ON CONFLICT (id) DO NOTHING` appears for both subgroups insert and trees insert |
| 4 | Local SQLite has plantation_users table for role-gated dashboard queries | VERIFIED | `schema.ts` exports `plantationUsers`; drizzle migration `0003_closed_zuras.sql` contains `CREATE TABLE plantation_users` with unique index |
| 5 | SubGroupRepository exports markAsSincronizada, getFinalizadaSubGroups, getPendingSyncCount | VERIFIED | All three functions present and substantive in `SubGroupRepository.ts` lines 267-291 |
| 6 | SyncService orchestrates pull-then-push with per-SubGroup error accumulation | VERIFIED | `SyncService.ts` 217 lines — pullFromServer called before upload loop, results array accumulates all outcomes, notifyDataChanged called once after loop |
| 7 | useSync hook exposes state/progress/results for UI consumption | VERIFIED | `useSync.ts` 47 lines — returns state, progress, results, startSync, reset, hasFailures, successCount, failureCount |
| 8 | Dashboard shows role-gated plantation list with stats, pending sync count, and sync CTA | VERIFIED | PlantacionesScreen imports from dashboardQueries; PlantationDetailScreen imports useSync, usePendingSyncCount, SyncProgressModal — all wired and rendered |

**Score:** 8/8 truths verified

---

## Required Artifacts

### Plan 03-01 Artifacts

| Artifact | Status | Lines | Details |
|----------|--------|-------|---------|
| `supabase/migrations/002_sync_rpc.sql` | VERIFIED | 62 | Contains sync_subgroup, SECURITY INVOKER, ON CONFLICT x2, DUPLICATE_CODE, jsonb_array_elements, GRANT, EXCEPTION WHEN OTHERS |
| `mobile/src/database/schema.ts` | VERIFIED | 63 | Exports plantationUsers with uniqueIndex on (plantationId, userId) |
| `mobile/drizzle/0003_closed_zuras.sql` | VERIFIED | — | `CREATE TABLE plantation_users` with correct columns and unique index |
| `mobile/src/repositories/SubGroupRepository.ts` | VERIFIED | 292 | Exports markAsSincronizada, getFinalizadaSubGroups, getPendingSyncCount — all substantive |

### Plan 03-02 Artifacts

| Artifact | Status | Lines | Details |
|----------|--------|-------|---------|
| `mobile/src/services/SyncService.ts` | VERIFIED | 217 | Exports syncPlantation, SyncSubGroupResult, SyncProgress, getErrorMessage, pullFromServer, uploadSubGroup |
| `mobile/src/hooks/useSync.ts` | VERIFIED | 47 | Exports useSync with full return shape including computed fields |
| `mobile/tests/sync/SyncService.test.ts` | VERIFIED | 289 | 20 tests total (8 in SyncService suite), all pass |

### Plan 03-03 Artifacts

| Artifact | Status | Lines | Details |
|----------|--------|-------|---------|
| `mobile/src/queries/dashboardQueries.ts` | VERIFIED | 125 | Exports all 6 required functions: getPlantationsForRole, getUnsyncedTreeCounts, getUserTotalTreeCounts, getPendingSyncCounts, getTodayTreeCounts, getTotalTreeCounts |
| `mobile/tests/sync/dashboard.test.ts` | VERIFIED | 200 | 12 test cases covering DASH-01 through DASH-06, all pass |
| `mobile/src/screens/PlantacionesScreen.tsx` | VERIFIED | — | Imports from dashboardQueries, renders unsyncedCount badge and pendingSync rows |
| `mobile/src/screens/PlantationDetailScreen.tsx` | VERIFIED | — | Imports useSync, usePendingSyncCount, SyncProgressModal; renders sync CTA with Alert confirmation |
| `mobile/src/components/PlantacionesTabIcon.tsx` | VERIFIED | 51 | Imports usePendingSyncCount, renders badge with 99+ cap, colors.secondary background |
| `mobile/src/components/SyncProgressModal.tsx` | VERIFIED | 170 | Shows ActivityIndicator + "Sincronizando..." during sync; success/failure summary with Spanish messages; "Cerrar" button |
| `mobile/src/hooks/usePendingSyncCount.ts` | VERIFIED | 27 | Accepts optional plantacionId, uses useLiveData, queries subgroups where estado = 'finalizada' |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SyncService.ts` | `supabase.rpc('sync_subgroup')` | Supabase client RPC | WIRED | Line 158: `return supabase.rpc('sync_subgroup', { p_subgroup, p_trees })` |
| `SyncService.ts` | `SubGroupRepository.ts` | markAsSincronizada import | WIRED | Lines 7-10: `import { markAsSincronizada, getFinalizadaSubGroups, SubGroup } from '../repositories/SubGroupRepository'` |
| `useSync.ts` | `SyncService.ts` | syncPlantation import | WIRED | Line 2: `import { syncPlantation, SyncSubGroupResult, SyncProgress } from '../services/SyncService'` |
| `PlantacionesTabIcon.tsx` | `usePendingSyncCount.ts` | hook import | WIRED | Line 3: `import { usePendingSyncCount } from '../hooks/usePendingSyncCount'` |
| `PlantationDetailScreen.tsx` | `useSync.ts` | hook import | WIRED | Line 36: `import { useSync } from '../hooks/useSync'` |
| `PlantacionesScreen.tsx` | `dashboardQueries.ts` | query function imports | WIRED | Lines 11-17: imports getPlantationsForRole, getTotalTreeCounts, getUnsyncedTreeCounts, getUserTotalTreeCounts, getTodayTreeCounts, getPendingSyncCounts |
| `dashboard.test.ts` | `dashboardQueries.ts` | test imports | WIRED | Tests import and exercise all 6 exported functions |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYNC-01 | 03-02 | Technician can manually initiate sync for finalizada SubGroups | SATISFIED | Sync CTA button in PlantationDetailScreen calls startSync from useSync hook |
| SYNC-02 | 03-01 | Sync uploads SubGroup + all trees as atomic unit | SATISFIED | RPC function inserts both in a single transaction with EXCEPTION rollback |
| SYNC-03 | 03-01 | Server rejects sync if SubGroup code already exists in plantation | SATISFIED | DUPLICATE_CODE check in RPC returns `{success: false, error: 'DUPLICATE_CODE'}` |
| SYNC-04 | 03-02 | Sync conflict shows clear error message to user | SATISFIED | getErrorMessage('DUPLICATE_CODE') returns Spanish message; SyncProgressModal renders it per failed SubGroup |
| SYNC-05 | 03-02 | Successful sync marks SubGroup as sincronizada (immutable) | SATISFIED | On `data.success === true`, markAsSincronizada(sg.id) is called; existing canEdit check blocks edits for sincronizada state |
| SYNC-06 | 03-02 | During sync, app downloads updated data from other technicians | SATISFIED | pullFromServer() called before upload loop — downloads subgroups, plantation_users, plantation_species and upserts locally |
| SYNC-07 | 03-03 | User can see list of SubGroups pending sync | SATISFIED | Tab icon badge shows total pending count; each plantation card shows "N subgrupos pendientes"; sync CTA on detail screen |
| DASH-01 | 03-03 | Technician sees list of assigned plantations after login | SATISFIED (human needed) | getPlantationsForRole(isAdmin=false, userId) uses innerJoin with plantation_users — tested in dashboard.test.ts |
| DASH-02 | 03-03 | Admin sees all plantations for the organization | SATISFIED (human needed) | getPlantationsForRole(isAdmin=true) queries all plantations without join — tested in dashboard.test.ts |
| DASH-03 | 03-03 | Each plantation shows total trees registered and synced | SATISFIED | getTotalTreeCounts used in PlantacionesScreen, rendered as "{N} arboles" badge |
| DASH-04 | 03-03 | Each plantation shows user's unsynced tree count | SATISFIED | getUnsyncedTreeCounts filters estado != 'sincronizada' AND usuarioRegistro = userId — tested; rendered as "N sin sincronizar" badge |
| DASH-05 | 03-03 | Each plantation shows user's total tree count | SATISFIED | getUserTotalTreeCounts filters by usuarioRegistro = userId — tested; wired into PlantacionesScreen |
| DASH-06 | 03-03 | Each plantation shows user's trees registered today | SATISFIED | getTodayTreeCounts filters by userId AND createdAt >= today start — tested; wired into PlantacionesScreen |

All 13 requirement IDs declared in plan frontmatter are accounted for. No orphaned requirements detected.

---

## Test Results

```
PASS tests/sync/dashboard.test.ts
PASS tests/sync/SyncService.test.ts

Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total
```

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SyncProgressModal.tsx` | 25 | `return null` | Info | Intentional guard — returns null when state is 'idle' to unmount modal. Not a stub. |

No blockers or warnings found.

---

## Human Verification Required

### 1. Role-gated plantation list (DASH-01 / DASH-02)

**Test:** Log in as tecnico user (e.g. tecnico1@test.com). Check the Plantaciones dashboard.
**Expected:** Only plantations where this tecnico is in plantation_users appear. Log in as admin — all plantations appear.
**Why human:** Query logic is unit-tested but actual plantation_users rows depend on seeded data and whether sync has been run at least once to populate the local plantation_users table.

### 2. Sync CTA button visibility (SYNC-01 / SYNC-07)

**Test:** Navigate to a plantation that has at least one SubGroup in finalizada state.
**Expected:** A blue "Sincronizar N subgrupos" button appears above the SubGroup list. The tab icon shows an orange badge with the count.
**Why human:** Conditional render requires real device state with finalizada SubGroups.

### 3. Full sync flow (SYNC-01 through SYNC-06)

**Test:** Tap "Sincronizar" button. Confirm dialog appears in Spanish. Tap "Sincronizar" in dialog.
**Expected:** Progress modal shows "Sincronizando... X de Y" with current subgroup name. After completion, shows "Sincronizacion completa" with success count. SubGroups switch to "Sincronizada" chip and become immutable.
**Why human:** Requires live Supabase RPC call and real network connectivity.

### 4. DUPLICATE_CODE error display (SYNC-03 / SYNC-04)

**Test:** Manually upload a SubGroup, then attempt to sync a second SubGroup with the same code from another device.
**Expected:** SyncProgressModal shows the failed SubGroup with Spanish error message "El codigo de subgrupo ya existe en el servidor. Renombra el codigo e intenta de nuevo."
**Why human:** Requires simulating a real code collision on the server.

### 5. Pending count reactivity (SYNC-07)

**Test:** After successful sync, verify tab icon badge and plantation card pending counts update without navigating away.
**Expected:** Badge count decreases immediately after sync completes. Card's "N subgrupos pendientes" text disappears when all SubGroups are synced.
**Why human:** Reactive behavior of useLiveData + notifyDataChanged chain requires running app observation.

---

## Summary

Phase 3 goal is structurally achieved. All 8 observable truths verified, 13/13 requirements covered, 20/20 unit tests pass, zero stub anti-patterns detected. The sync engine (RPC, SyncService, useSync), dashboard queries (dashboardQueries.ts with role-gating and all 6 stat functions), and UI layer (PlantacionesScreen, PlantationDetailScreen, SyncProgressModal, PlantacionesTabIcon, usePendingSyncCount) are all implemented with full wiring.

The 5 human verification items are flow-level checks that require a running device with real data and network — they cannot be verified programmatically. The core risk area is DASH-01 (tecnico role filtering), which depends on plantation_users being populated via sync — technicians who have never synced will not have plantation_users rows locally and may see an empty dashboard.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
