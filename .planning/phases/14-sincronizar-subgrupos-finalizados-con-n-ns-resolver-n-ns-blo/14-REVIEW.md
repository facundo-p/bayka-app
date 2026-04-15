---
phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
reviewed: 2026-04-14T12:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - mobile/drizzle/0010_add_tree_conflict_columns.sql
  - mobile/drizzle/meta/_journal.json
  - mobile/drizzle/migrations.js
  - mobile/src/components/AdminBottomSheet.tsx
  - mobile/src/components/PlantationCard.tsx
  - mobile/src/database/schema.ts
  - mobile/src/hooks/useNNResolution.ts
  - mobile/src/hooks/usePlantaciones.ts
  - mobile/src/hooks/usePlantationAdmin.ts
  - mobile/src/queries/adminQueries.ts
  - mobile/src/queries/dashboardQueries.ts
  - mobile/src/queries/plantationDetailQueries.ts
  - mobile/src/repositories/SubGroupRepository.ts
  - mobile/src/screens/NNResolutionScreen.tsx
  - mobile/src/screens/PlantacionesScreen.tsx
  - mobile/src/screens/PlantationDetailScreen.tsx
  - mobile/src/services/SyncService.ts
  - supabase/migrations/009_sync_subgroup_update_trees.sql
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-04-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 14 implements sync for finalized subgroups with N/N trees, N/N resolution UI with conflict detection, and a Supabase RPC migration for tree upsert. The migration stack (SQL + journal + migrations.js) is correctly synchronized. The architecture follows project conventions well -- queries in `queries/`, mutations in `repositories/`, hooks as bridges. However, there are two critical issues: a missing import that will crash NNResolutionScreen at runtime, and a race condition in the Supabase RPC that can silently accept duplicate subgroup codes. Several warnings around dead code, unhandled edge cases, and swallowed errors are also noted.

## Critical Issues

### CR-01: Missing Ionicons import causes runtime crash in NNResolutionScreen

**File:** `mobile/src/screens/NNResolutionScreen.tsx:149`
**Issue:** The conflict banner JSX references `<Ionicons name="warning-outline" ...>` but `Ionicons` is never imported in this file. This will crash the screen at runtime whenever a conflict is detected. The import list at the top (lines 1-21) includes many components but not `Ionicons`.
**Fix:**
```typescript
// Add to the imports at the top of the file (e.g., after line 12)
import Ionicons from '@expo/vector-icons/Ionicons';
```

### CR-02: Race condition in sync_subgroup RPC -- DUPLICATE_CODE check runs after INSERT ON CONFLICT DO NOTHING

**File:** `supabase/migrations/009_sync_subgroup_update_trees.sql:14-39`
**Issue:** The RPC first tries `INSERT ... ON CONFLICT (id) DO NOTHING` (line 16-27), then checks for DUPLICATE_CODE (line 30-39). If two devices upload subgroups with different UUIDs but the same `(plantation_id, codigo)` pair simultaneously, the first INSERT succeeds. The second INSERT also succeeds via `DO NOTHING` (different `id`, no conflict on `id`). But wait -- there is a unique constraint on `(plantation_id, codigo)` in the subgroups table (from schema), so the second INSERT would actually fail with a constraint violation caught by `EXCEPTION WHEN OTHERS` at line 59, returning a generic `UNKNOWN` error instead of the meaningful `DUPLICATE_CODE`. The DUPLICATE_CODE check on line 30 only catches the case where the insert succeeded (same id, different code already exists), which is the wrong order.
**Fix:** Move the DUPLICATE_CODE check BEFORE the INSERT, or use `ON CONFLICT ON CONSTRAINT subgroups_plantation_code_unique` to handle the code conflict explicitly:
```sql
-- Option A: Check before insert
IF EXISTS (
  SELECT 1 FROM subgroups
  WHERE plantation_id = (p_subgroup->>'plantation_id')::UUID
    AND codigo = p_subgroup->>'codigo'
    AND id <> (p_subgroup->>'id')::UUID
) THEN
  RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
END IF;

-- Then do the INSERT
INSERT INTO subgroups ...
ON CONFLICT (id) DO NOTHING;
```

## Warnings

### WR-01: canResolve is always true -- dead permission logic

**File:** `mobile/src/hooks/useNNResolution.ts:123`
**Issue:** The `canResolve` expression is `isAdmin || !subgrupoId || true`. The trailing `|| true` makes this always evaluate to `true`, rendering the entire permission check dead code. This means the "read-only" label in NNResolutionScreen (line 165-167) is unreachable.
**Fix:** Remove `|| true` and implement the actual permission check, or remove the `canResolve` variable and the `!canResolve` branch in NNResolutionScreen entirely if all users should always be able to resolve:
```typescript
// If truly always allowed:
const canResolve = true;
// Or implement real logic:
const canResolve = isAdmin || !subgrupoId; // plantation-mode already filtered by user
```

### WR-02: Swallowed errors in fetchPlantationMeta hide finalization gate failures

**File:** `mobile/src/hooks/usePlantationAdmin.ts:45-51`
**Issue:** Both `try/catch` blocks in `fetchPlantationMeta` use `catch { /* ignore */ }`. If `checkFinalizationGate` throws (e.g., database corruption, schema mismatch), the function returns `canFinalize: false` silently. The admin sees "cannot finalize" with no explanation, making debugging impossible.
**Fix:** At minimum, log the error:
```typescript
} catch (e) {
  console.error('[fetchPlantationMeta] checkFinalizationGate failed:', e);
}
```

### WR-03: bottomSheetMeta missing new fields causes type inconsistency

**File:** `mobile/src/screens/PlantacionesScreen.tsx:83`
**Issue:** The initial state for `bottomSheetMeta` is `{ canFinalize: false, idsGenerated: false }` but the `ExpandedMeta` type requires `unresolvedNNCount` and `unresolvedNNSubgroups` fields. TypeScript should catch this, but if it does not (due to loose config), the AdminBottomSheet will read `undefined` for `meta.unresolvedNNCount` and `meta.unresolvedNNSubgroups` before the async `fetchPlantationMeta` resolves, leading to the N/N helper text showing "0" instead of not appearing.
**Fix:**
```typescript
const [bottomSheetMeta, setBottomSheetMeta] = useState<ExpandedMeta>({
  canFinalize: false,
  idsGenerated: false,
  unresolvedNNCount: 0,
  unresolvedNNSubgroups: 0,
});
```

### WR-04: Potential null dereference on currentTree in NNResolutionScreen

**File:** `mobile/src/screens/NNResolutionScreen.tsx:110-113`
**Issue:** After the early return for `unresolvedTrees.length === 0` (line 97), the code accesses `currentTree.subgrupoNombre` and `currentTree.posicion` (lines 110-113). However, `currentTree` comes from `useNNResolution` where `safeIndex` can be `-1` when `unresolvedTrees.length - 1` equals `-1` for an empty array. In practice, the early return prevents this, but if `unresolvedTrees` changes between renders (e.g., another user resolves the last tree), `currentTree` could briefly be `undefined` before the re-render triggers the early return.
**Fix:** Add a guard:
```typescript
if (!currentTree) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No hay arboles N/N pendientes</Text>
      ...
    </View>
  );
}
```

### WR-05: SyncService pull uses wrong column names in onConflictDoUpdate for trees

**File:** `mobile/src/services/SyncService.ts:518-519`
**Issue:** The `onConflictDoUpdate` set clause uses `sql`excluded.especie_id`` and `sql`excluded.posicion`` (lines 518-519). However, Drizzle ORM's `excluded` references use the column names from the `values()` call, which use camelCase JS property names mapped to snake_case DB columns. The `excluded` keyword in SQLite refers to the actual DB column names (`especie_id`, `posicion`, `sub_id`), so this happens to work correctly. However, this is fragile -- if the column mapping changes, these raw SQL references would break silently. Consider using the Drizzle column references instead.
**Fix:** This works correctly today but is worth noting for maintainability. Use Drizzle helpers if available:
```typescript
set: {
  especieId: sql`excluded.especie_id`,
  posicion: sql`excluded.posicion`,
  subId: sql`excluded.sub_id`,
  // ...
}
```

## Info

### IN-01: Migration journal timestamps are not monotonically increasing

**File:** `mobile/drizzle/meta/_journal.json:64-80`
**Issue:** Entries idx 8 (`0008_add_foto_synced`, when: 1744500000000) and idx 9 (`0009_add_subgroup_pending_sync`, when: 1744900000000) have timestamps earlier than entries idx 6 and 7 (1774100000000 and 1774200000000). While Drizzle uses `idx` for ordering (not `when`), non-monotonic timestamps could cause confusion during debugging.
**Fix:** No functional impact, but consider using current timestamps for new entries.

### IN-02: console.log statements in SyncService

**File:** `mobile/src/services/SyncService.ts:337,379,411,452,481,484,496`
**Issue:** Multiple `console.log` calls remain in the sync flow. While useful during development, these should be gated behind a debug flag or removed before production to avoid log noise.
**Fix:** Consider a debug logger utility that can be disabled in production builds.

### IN-03: Type assertion `as unknown as SubGroup[]` in SubGroupRepository

**File:** `mobile/src/repositories/SubGroupRepository.ts:293,309`
**Issue:** The `getFinalizadaSubGroups` and `getSyncableSubGroups` functions cast their return type through `as unknown as SubGroup[]`. This bypasses type safety. The Drizzle select should already return the correct shape.
**Fix:** Define a proper return type or use `.then()` to map the result, avoiding the double cast.

---

_Reviewed: 2026-04-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
