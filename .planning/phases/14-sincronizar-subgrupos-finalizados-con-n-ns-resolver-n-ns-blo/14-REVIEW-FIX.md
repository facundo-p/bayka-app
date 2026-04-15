---
phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
fixed_at: 2026-04-14T19:29:20Z
review_path: .planning/phases/14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo/14-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-04-14T19:29:20Z
**Source review:** .planning/phases/14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-01: Missing Ionicons import causes runtime crash in NNResolutionScreen

**Files modified:** `mobile/src/screens/NNResolutionScreen.tsx`
**Commit:** 4d34e14
**Applied fix:** Added `import Ionicons from '@expo/vector-icons/Ionicons';` to the import block. The conflict banner JSX at line 148 references `<Ionicons>` but the import was missing, which would crash at runtime when a conflict is detected.

### CR-02: Race condition in sync_subgroup RPC -- DUPLICATE_CODE check runs after INSERT

**Files modified:** `supabase/migrations/009_sync_subgroup_update_trees.sql`
**Commit:** 48ee39f
**Applied fix:** Moved the DUPLICATE_CODE existence check (IF EXISTS query) before the INSERT statement. Previously, two devices uploading subgroups with different UUIDs but the same `(plantation_id, codigo)` pair could hit a constraint violation caught by the generic EXCEPTION WHEN OTHERS handler, returning 'UNKNOWN' instead of the meaningful 'DUPLICATE_CODE' error. Now the check runs first, returning the specific error before any insert is attempted.

### WR-01: canResolve is always true -- dead permission logic

**Files modified:** `mobile/src/hooks/useNNResolution.ts`
**Commit:** 8b48549
**Applied fix:** Removed the trailing `|| true` from the `canResolve` expression, changing it from `isAdmin || !subgrupoId || true` to `isAdmin || !subgrupoId`. The `|| true` made the entire permission check dead code, preventing the read-only label from ever appearing. The remaining logic is correct: admin can always resolve, and plantation-mode (no subgrupoId) trees are already filtered by user.

### WR-02: Swallowed errors in fetchPlantationMeta hide finalization gate failures

**Files modified:** `mobile/src/hooks/usePlantationAdmin.ts`
**Commit:** 8edf94d
**Applied fix:** Replaced both `catch { /* ignore */ }` blocks with `catch (e) { console.error(...) }` blocks that log the error with descriptive prefixes (`[fetchPlantationMeta] checkFinalizationGate failed:` and `[fetchPlantationMeta] hasIdsGenerated failed:`). This preserves the graceful degradation behavior while making failures debuggable.

### WR-03: bottomSheetMeta missing new fields causes type inconsistency

**Files modified:** `mobile/src/screens/PlantacionesScreen.tsx`
**Commit:** 2f603c0
**Applied fix:** Added `unresolvedNNCount: 0` and `unresolvedNNSubgroups: 0` to the initial state of `bottomSheetMeta`, matching the `ExpandedMeta` type definition. This prevents `undefined` values from being read by AdminBottomSheet before the async `fetchPlantationMeta` resolves.

### WR-04: Potential null dereference on currentTree in NNResolutionScreen

**Files modified:** `mobile/src/screens/NNResolutionScreen.tsx`
**Commit:** 147fbc2
**Applied fix:** Extended the early return guard from `unresolvedTrees.length === 0` to `unresolvedTrees.length === 0 || !currentTree`. This handles the race condition where `unresolvedTrees` changes between renders (e.g., another user resolves the last tree), causing `currentTree` to briefly be `undefined` before the re-render triggers the length check.

## Skipped Issues

### WR-05: SyncService pull uses wrong column names in onConflictDoUpdate for trees

**File:** `mobile/src/services/SyncService.ts:518-519`
**Reason:** The reviewer explicitly noted this "works correctly today" and the suggested fix uses the same `sql\`excluded.especie_id\`` pattern already present in the code. The fix is a maintainability note, not a functional change. No material code change to apply.
**Original issue:** The `onConflictDoUpdate` set clause uses raw SQL `excluded` references with DB column names. This works correctly because SQLite's `excluded` keyword references actual DB column names, but is fragile if column mappings change.

---

_Fixed: 2026-04-14T19:29:20Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
