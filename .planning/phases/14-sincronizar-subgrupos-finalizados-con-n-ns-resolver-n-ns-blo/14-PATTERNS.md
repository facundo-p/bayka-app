# Phase 14: Sincronizar subgrupos finalizados con N/Ns — Pattern Map

**Mapped:** 2026-04-14
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `mobile/src/repositories/SubGroupRepository.ts` | repository | CRUD | self (lines 299–317) | exact — modify existing function |
| `mobile/src/queries/adminQueries.ts` | query | CRUD | self (lines 22–37) + `plantationDetailQueries.ts:getNNTreesForPlantation` | exact — extend existing function |
| `mobile/src/queries/plantationDetailQueries.ts` | query | CRUD | self (lines 96–114) | exact — add new count variant |
| `mobile/src/queries/dashboardQueries.ts` | query | CRUD | self (lines 78–87 `getPendingSyncCounts`) | role-match — add N/N count per plantation |
| `mobile/src/services/SyncService.ts` | service | request-response | self (lines 483–514 `pullFromServer`) | exact — extend conflict detection inline |
| `mobile/src/hooks/useNNResolution.ts` | hook | event-driven | self + `useCurrentUserId.ts` + `useProfileData.ts` | exact — extend with role filter + conflict state |
| `mobile/src/hooks/usePlantationAdmin.ts` | hook | request-response | self (lines 73–120 `handleFinalize`) | exact — extend finalize gate |
| `mobile/src/components/AdminBottomSheet.tsx` | component | request-response | self (lines 105–114) | exact — extend disabled state |
| `mobile/src/components/PlantationCard.tsx` | component | request-response | self (lines 71–84 `statsRow`) | exact — add stat item |
| `mobile/drizzle/` (new migration 0010) + `mobile/src/database/schema.ts` | migration | batch | `drizzle/0009_add_subgroup_pending_sync.sql` + `drizzle/meta/_journal.json` + `drizzle/migrations.js` | exact — same 3-file pattern |
| `supabase/migrations/009_sync_subgroup_update_trees.sql` | migration | batch | `supabase/migrations/002_sync_rpc.sql` lines 39–52 | exact — modify RPC trees insert |

---

## Pattern Assignments

### `mobile/src/repositories/SubGroupRepository.ts` — remove N/N filter

**Analog:** self, lines 299–317

**Current pattern to replace** (`mobile/src/repositories/SubGroupRepository.ts` lines 299–317):
```typescript
export async function getSyncableSubGroups(plantacionId: string, userId?: string): Promise<SubGroup[]> {
  const finalizada = await getFinalizadaSubGroups(plantacionId, userId);
  if (finalizada.length === 0) return [];

  // Get N/N counts per subgroup
  const nnCounts = await db.select({
    subgrupoId: trees.subgrupoId,
    nnCount: count(),
  })
    .from(trees)
    .where(and(
      isNull(trees.especieId),
      sql`${trees.subgrupoId} IN (${sql.join(finalizada.map(sg => sql`${sg.id}`), sql`, `)})`
    ))
    .groupBy(trees.subgrupoId);

  const nnMap = new Map(nnCounts.map(r => [r.subgrupoId, r.nnCount]));
  return finalizada.filter(sg => (nnMap.get(sg.id) ?? 0) === 0);
}
```

**Required change — new implementation pattern** (copy from `getFinalizadaSubGroups` at lines 284–294 but add `pendingSync=true` condition):
```typescript
// Copy the conditions-array pattern from getFinalizadaSubGroups (lines 285-293)
// and add eq(subgroups.pendingSync, true) as a third condition.
// Remove the entire NN count query and filter entirely.
export async function getSyncableSubGroups(plantacionId: string, userId?: string): Promise<SubGroup[]> {
  const conditions = [
    eq(subgroups.plantacionId, plantacionId),
    eq(subgroups.estado, 'finalizada'),
    eq(subgroups.pendingSync, true),   // ADD: was previously implicit via N/N filter
  ];
  if (userId) {
    conditions.push(eq(subgroups.usuarioCreador, userId));
  }
  return db.select().from(subgroups)
    .where(and(...conditions)) as unknown as SubGroup[];
}
```

**Import pattern** (existing, no change needed — lines 1–15 of SubGroupRepository.ts already import `eq`, `and`, `isNull`, `count`, `sql` from drizzle-orm).

---

### `mobile/src/queries/adminQueries.ts` — extend `checkFinalizationGate`

**Analog:** self lines 22–37 + `plantationDetailQueries.ts` lines 32–43 (`getNNCountsPerSubgroup`)

**Existing function signature to extend** (`adminQueries.ts` lines 22–37):
```typescript
export async function checkFinalizationGate(
  plantacionId: string
): Promise<{ canFinalize: boolean; blocking: Array<{ nombre: string; estado: string; pendingSync: boolean }>; hasSubgroups: boolean }> {
  const allSubgroups = await db
    .select({ nombre: subgroups.nombre, estado: subgroups.estado, pendingSync: subgroups.pendingSync })
    .from(subgroups)
    .where(eq(subgroups.plantacionId, plantacionId));

  const blocking = allSubgroups.filter(s => s.estado !== 'finalizada' || s.pendingSync);

  return {
    canFinalize: allSubgroups.length > 0 && blocking.length === 0,
    blocking,
    hasSubgroups: allSubgroups.length > 0,
  };
}
```

**Pattern to copy for N/N count subquery** (from `plantationDetailQueries.ts` lines 32–43):
```typescript
// Copy this groupBy count pattern to build unresolvedNN per subgroup map
return db.select({
  subgrupoId: trees.subgrupoId,
  nnCount: count(),
})
  .from(trees)
  .where(and(
    isNull(trees.especieId),
    sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`
  ))
  .groupBy(trees.subgrupoId);
```

**Extended return type** — add `unresolvedNNCount: number` and `unresolvedNNSubgroups: number` to the return. Add `isNull` to imports from drizzle-orm (check if already present — it is in `plantationDetailQueries.ts` but may not be in `adminQueries.ts` line 11).

**Import additions required** (`adminQueries.ts` line 11 currently):
```typescript
import { eq, and, isNotNull, sql, count, asc } from 'drizzle-orm';
// Add: isNull
import { eq, and, isNotNull, isNull, sql, count, asc } from 'drizzle-orm';
// Also add: trees to schema imports (line 10 already includes it)
```

---

### `mobile/src/queries/plantationDetailQueries.ts` — add `getNNTreesForPlantationByUser`

**Analog:** self lines 96–114 (`getNNTreesForPlantation`)

**Existing function to copy and filter** (`plantationDetailQueries.ts` lines 96–114):
```typescript
export async function getNNTreesForPlantation(plantacionId: string) {
  return db.select({
    id: trees.id,
    posicion: trees.posicion,
    subId: trees.subId,
    fotoUrl: trees.fotoUrl,
    especieId: trees.especieId,
    subgrupoId: trees.subgrupoId,
    subgrupoCodigo: subgroups.codigo,
    subgrupoNombre: subgroups.nombre,
  })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(and(
      isNull(trees.especieId),
      eq(subgroups.plantacionId, plantacionId)
    ))
    .orderBy(asc(subgroups.nombre), asc(trees.posicion));
}
```

**New variant — copy entire function, add userId filter:**
```typescript
// Add eq(subgroups.usuarioCreador, userId) to the where clause
export async function getNNTreesForPlantationByUser(plantacionId: string, userId: string) {
  return db.select({ /* same fields */ })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(and(
      isNull(trees.especieId),
      eq(subgroups.plantacionId, plantacionId),
      eq(subgroups.usuarioCreador, userId),   // role filter
    ))
    .orderBy(asc(subgroups.nombre), asc(trees.posicion));
}
```

---

### `mobile/src/queries/dashboardQueries.ts` — add `getUnresolvedNNCountsPerPlantation`

**Analog:** self lines 78–87 (`getPendingSyncCounts`) — same shape: count per plantacion grouped

**Pattern to copy** (`dashboardQueries.ts` lines 78–87):
```typescript
export async function getPendingSyncCounts() {
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      pendingCount: count(),
    })
    .from(subgroups)
    .where(eq(subgroups.pendingSync, true))
    .groupBy(subgroups.plantacionId);
}
```

**New function — copy shape, join through subgroups to trees, filter isNull(especieId):**
```typescript
// Copy getPendingSyncCounts shape exactly, but join trees
export async function getUnresolvedNNCountsPerPlantation() {
  return db
    .select({
      plantacionId: subgroups.plantacionId,
      nnCount: count(),
    })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(isNull(trees.especieId))
    .groupBy(subgroups.plantacionId);
}
```

**Import additions required:** Add `isNull` and `trees` to `dashboardQueries.ts` imports (line 8–9 currently has `trees` already in schema import; `isNull` is not in drizzle-orm import on line 9).

---

### `mobile/src/services/SyncService.ts` — conflict detection in `pullFromServer`

**Analog:** self lines 483–514 (tree upsert loop inside `pullFromServer`)

**Existing upsert pattern to modify** (`SyncService.ts` lines 488–512):
```typescript
for (const t of remoteTrees) {
  const hasFotoOnServer = !!t.foto_url;
  await db.insert(trees).values({ ... })
    .onConflictDoUpdate({
      target: trees.id,
      set: {
        especieId: sql`excluded.especie_id`,    // ← server ALWAYS wins today
        ...
      },
    });
}
```

**Conflict detection pattern — insert BEFORE the upsert loop, read local first:**
```typescript
// Pattern: read local before upsert (same approach as fotoUrl CASE WHEN on line 508)
// Use SQL CASE WHEN to preserve local especieId when conflict detected,
// and write conflictEspecieId to new column on trees table.
// The fotoUrl CASE WHEN on line 508 shows the exact SQL pattern for conditional column update:
fotoUrl: sql`CASE WHEN ${trees.fotoUrl} LIKE 'file://%' THEN ${trees.fotoUrl} ELSE excluded.foto_url END`,
// Mirror this for conflict detection:
especieId: sql`CASE WHEN ${trees.especieId} IS NOT NULL AND excluded.especie_id IS NOT NULL AND ${trees.especieId} <> excluded.especie_id THEN ${trees.especieId} ELSE excluded.especie_id END`,
conflictEspecieId: sql`CASE WHEN ${trees.especieId} IS NOT NULL AND excluded.especie_id IS NOT NULL AND ${trees.especieId} <> excluded.especie_id THEN excluded.especie_id ELSE NULL END`,
```

**Note:** This requires adding `conflictEspecieId` and `conflictEspecieNombre` columns to the `trees` table via a new Drizzle migration (see migration pattern below), and to `schema.ts`.

---

### `mobile/src/hooks/useNNResolution.ts` — role filter + conflict state

**Analog:** self (entire file) + `useCurrentUserId.ts` + `useProfileData.ts`

**Existing params interface** (lines 28–34):
```typescript
export function useNNResolution(params: {
  plantacionId: string;
  subgrupoId?: string;
  subgrupoCodigo?: string;
}) {
```

**Role derivation pattern** (copy from `usePlantationAdmin.ts` lines 55–57):
```typescript
const userId = useCurrentUserId();
const { profile } = useProfileData();
// isAdmin derived from profile:
const isAdmin = profile?.rol === 'admin';
```

**Existing plantation-mode data loading pattern** (lines 39–45 of `useNNResolution.ts`):
```typescript
const { data: plantationNNTrees } = useLiveData(
  () => {
    if (!isPlantationMode) return Promise.resolve([]);
    return getNNTreesForPlantation(plantacionId ?? '');
  },
  [plantacionId, isPlantationMode]
);
```

**Extended pattern — role-gated query selection:**
```typescript
// Add userId and isAdmin to params OR derive them internally (prefer internal for encapsulation)
// Replace getNNTreesForPlantation call with conditional:
const { data: plantationNNTrees } = useLiveData(
  () => {
    if (!isPlantationMode) return Promise.resolve([]);
    if (isAdmin) return getNNTreesForPlantation(plantacionId ?? '');
    if (userId) return getNNTreesForPlantationByUser(plantacionId ?? '', userId);
    return Promise.resolve([]);
  },
  [plantacionId, isPlantationMode, isAdmin, userId]
);
```

**Conflict state pattern** — add to existing useState block (lines 58–62):
```typescript
// Copy the saving/zoomPhotoUri useState pattern at lines 61-62
const [conflictMap, setConflictMap] = useState<Record<string, { serverEspecieId: string; serverEspecieNombre: string }>>({});
```

**Import additions required:**
```typescript
import { getNNTreesForPlantationByUser } from '../queries/plantationDetailQueries';
import { useCurrentUserId } from './useCurrentUserId';
import { useProfileData } from './useProfileData';
```

---

### `mobile/src/hooks/usePlantationAdmin.ts` — extend `handleFinalize` with N/N gate

**Analog:** self lines 73–120 (`handleFinalize`)

**`ExpandedMeta` type to extend** (lines 30–33):
```typescript
export type ExpandedMeta = {
  canFinalize: boolean;
  idsGenerated: boolean;
  // ADD:
  unresolvedNNCount: number;
  unresolvedNNSubgroups: number;
};
```

**`fetchPlantationMeta` to extend** (lines 37–52):
```typescript
// Add unresolvedNNCount/Subgroups to the returned object
// Pattern: same try/catch wrapping as the existing gate call at lines 42-45
if (plantation.estado === 'activa') {
  try {
    const gate = await checkFinalizationGate(plantation.id);
    canFinalize = gate.canFinalize;
    unresolvedNNCount = gate.unresolvedNNCount;    // ADD
    unresolvedNNSubgroups = gate.unresolvedNNSubgroups;  // ADD
  } catch { /* ignore */ }
}
```

**`handleFinalize` guard pattern** (lines 73–80 show the pending sync guard):
```typescript
// Copy the pendingSync guard shape (lines 76-79) for the N/N guard:
if (plantation?.pendingSync || plantation?.pendingEdit) {
  showInfoDialog(showConfirm, 'Sincroniza primero', '...', 'cloud-upload-outline', colors.info);
  return;
}
// Add N/N guard after gate check — inside the `gate.canFinalize` branch at line 83:
// if gate.unresolvedNNCount > 0 → show blocking dialog instead of confirm
```

---

### `mobile/src/components/AdminBottomSheet.tsx` — extend finalization disabled state

**Analog:** self lines 105–114

**Existing finalization disabled logic** (lines 105–114):
```typescript
const hasPendingIssues = !!(plantation.pendingSync || plantation.pendingEdit);

const finalizeDisabled = !meta.canFinalize || hasPendingIssues;
const finalizeColor =
  meta.canFinalize && !hasPendingIssues ? colors.danger : colors.textMuted;
const finalizeHelperText = hasPendingIssues
  ? 'Sincroniza los cambios antes de finalizar'
  : !meta.canFinalize
    ? 'Para finalizar, todos los subgrupos deben estar sincronizados'
    : undefined;
```

**Extended pattern — third case for N/N:**
```typescript
// ExpandedMeta now has unresolvedNNCount and unresolvedNNSubgroups
const hasUnresolvedNN = (meta.unresolvedNNCount ?? 0) > 0;

const finalizeDisabled = !meta.canFinalize || hasPendingIssues || hasUnresolvedNN;
const finalizeColor =
  meta.canFinalize && !hasPendingIssues && !hasUnresolvedNN ? colors.danger : colors.textMuted;
const finalizeHelperText = hasPendingIssues
  ? 'Sincroniza los cambios antes de finalizar'
  : hasUnresolvedNN
    ? `${meta.unresolvedNNCount} árbol${meta.unresolvedNNCount !== 1 ? 'es' : ''} N/N sin resolver en ${meta.unresolvedNNSubgroups} subgrupo${meta.unresolvedNNSubgroups !== 1 ? 's' : ''}`
    : !meta.canFinalize
      ? 'Para finalizar, todos los subgrupos deben estar sincronizados'
      : undefined;
```

**ActionItem disabled+helperText pattern** (already used at lines 51–80 — copy as-is, no change needed in ActionItem component itself).

---

### `mobile/src/components/PlantationCard.tsx` — add N/N stat

**Analog:** self lines 14–28 (Props type) and lines 71–84 (statsRow)

**Props type to extend** (lines 14–28):
```typescript
type Props = {
  ...existing props...
  nnCount?: number;   // ADD — optional, 0 if not provided
};
```

**Existing statsRow pattern** (lines 71–84):
```typescript
<View style={styles.statsRow}>
  <View style={styles.statItem}>
    <Ionicons name="leaf-outline" size={14} color={colors.statTotal} />
    <Text style={[styles.statValue, { color: colors.statTotal }]}>{totalCount}</Text>
  </View>
  <View style={styles.statItem}>
    <Ionicons name="cloud-done-outline" size={14} color={colors.statSynced} />
    <Text style={[styles.statValue, { color: colors.statSynced }]}>{syncedCount}</Text>
  </View>
  <View style={styles.statItem}>
    <Ionicons name="today-outline" size={14} color={colors.statToday} />
    <Text style={[styles.statValue, { color: colors.statToday }]}>{todayCount}</Text>
  </View>
</View>
```

**Fourth stat item to add — copy statItem shape exactly, use yellow N/N color:**
```typescript
{(nnCount ?? 0) > 0 && (
  <View style={styles.statItem}>
    <Ionicons name="help-circle-outline" size={14} color={colors.secondaryYellowDark} />
    <Text style={[styles.statValue, { color: colors.secondaryYellowDark }]}>{nnCount}</Text>
  </View>
)}
```

**Colors to use** (from `theme.ts` lines 43–46):
- Icon + text color: `colors.secondaryYellowDark` (`#ffb300`)
- No new styles needed — `styles.statItem` and `styles.statValue` already defined

**Callers need updating** — screens that render PlantationCard must pass `nnCount`. The hook/screen that consumes `getPlantationsForRole` and dashboard queries must compute `nnCount` per plantation from `getUnresolvedNNCountsPerPlantation()`.

---

### Drizzle migration 0010 — add `conflict_especie_id` and `conflict_especie_nombre` to `trees`

**Analog:** `mobile/drizzle/0009_add_subgroup_pending_sync.sql` (single ALTER TABLE)

**SQL file pattern** (copy from `0009_add_subgroup_pending_sync.sql`):
```sql
ALTER TABLE `trees` ADD `conflict_especie_id` text;
ALTER TABLE `trees` ADD `conflict_especie_nombre` text;
```

**Journal entry pattern** (copy last entry from `mobile/drizzle/meta/_journal.json` lines 67–73):
```json
{
  "idx": 10,
  "version": "6",
  "when": 1745000000000,
  "tag": "0010_add_tree_conflict_columns",
  "breakpoints": true
}
```

**migrations.js pattern** (copy from `mobile/drizzle/migrations.js` lines 13 and 27):
```javascript
import m0010 from './0010_add_tree_conflict_columns.sql';
// ...add m0010 to migrations object
```

**Schema addition** (`mobile/src/database/schema.ts` lines 40–52 — trees table):
```typescript
// Add after fotoSynced:
conflictEspecieId: text('conflict_especie_id'),
conflictEspecieNombre: text('conflict_especie_nombre'),
```

**CRITICAL: Must update all 3 files** (from `feedback_drizzle_migrations.md`): `.sql` file + `_journal.json` + `migrations.js`. Missing `migrations.js` causes silent splash hang.

---

### Supabase migration `009_sync_subgroup_update_trees.sql`

**Analog:** `supabase/migrations/002_sync_rpc.sql` lines 39–52

**Existing tree insert in RPC** (lines 41–52 of `002_sync_rpc.sql`):
```sql
INSERT INTO trees (id, subgroup_id, species_id, posicion, sub_id, foto_url, usuario_registro, created_at)
SELECT
  (t->>'id')::UUID,
  (t->>'subgroup_id')::UUID,
  NULLIF(t->>'species_id', '')::UUID,
  (t->>'posicion')::INTEGER,
  t->>'sub_id',
  t->>'foto_url',
  (t->>'usuario_registro')::UUID,
  (t->>'created_at')::TIMESTAMPTZ
FROM jsonb_array_elements(p_trees) AS t
ON CONFLICT (id) DO NOTHING;  -- ← CHANGE THIS
```

**Required change — new migration replaces with DO UPDATE:**
```sql
-- 009_sync_subgroup_update_trees.sql
-- Changes tree insert in sync_subgroup RPC from DO NOTHING to DO UPDATE
-- to support re-upload of N/N trees after local resolution.

CREATE OR REPLACE FUNCTION sync_subgroup(p_subgroup JSONB, p_trees JSONB)
-- ... (copy full function from 002_sync_rpc.sql, change only the ON CONFLICT clause)
ON CONFLICT (id) DO UPDATE SET
  species_id = EXCLUDED.species_id,
  sub_id = EXCLUDED.sub_id;
```

**Note:** This is a `CREATE OR REPLACE FUNCTION` — the entire RPC must be redeclared. Copy the full function body from `002_sync_rpc.sql` and change only the `ON CONFLICT` line for trees.

---

## Shared Patterns

### Role derivation (admin vs tecnico)
**Source:** `mobile/src/hooks/usePlantationAdmin.ts` lines 55–57 + `useProfileData.ts`
**Apply to:** `useNNResolution.ts`
```typescript
const userId = useCurrentUserId();
const { profile } = useProfileData();
const isAdmin = profile?.rol === 'admin';
```

### useLiveData reactive query pattern
**Source:** `mobile/src/hooks/useNNResolution.ts` lines 39–45
**Apply to:** any new reactive data in hooks
```typescript
const { data: result } = useLiveData(
  () => someQueryFunction(param),
  [param]
);
```

### Drizzle count with groupBy per entity
**Source:** `mobile/src/queries/dashboardQueries.ts` lines 78–87 (`getPendingSyncCounts`)
**Apply to:** `getUnresolvedNNCountsPerPlantation` in `dashboardQueries.ts`
```typescript
return db
  .select({ plantacionId: subgroups.plantacionId, pendingCount: count() })
  .from(subgroups)
  .where(eq(subgroups.pendingSync, true))
  .groupBy(subgroups.plantacionId);
```

### ActionItem disabled + helperText pattern
**Source:** `mobile/src/components/AdminBottomSheet.tsx` lines 36–80
**Apply to:** finalization gate N/N case in `AdminBottomSheet.tsx`
```typescript
{helperText && disabled && (
  <Text style={styles.helperText}>{helperText}</Text>
)}
```

### nnBadge in SubGroupCard (already exists — verify only)
**Source:** `mobile/src/screens/PlantationDetailScreen.tsx` lines 93, 178–179
```typescript
// Inline card badge — styles already defined:
{nnCount > 0 && <View style={styles.nnBadge}><Text style={styles.nnBadgeText}>{nnCount} N/N</Text></View>}
// styles:
nnBadge: { backgroundColor: colors.secondaryBg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.secondaryBorder },
nnBadgeText: { color: colors.secondary, fontSize: fontSize.xs, fontFamily: fonts.semiBold },
```
Note: The nnBadge in PlantationDetailScreen uses `colors.secondary` (olive green). D-11 says use the 2 main theme colors. Confirm with UI-SPEC whether yellow (`secondaryYellowDark`) or olive green (`secondary`) is preferred for the badge — or keep as-is since it already exists.

### Try/catch with showInfoDialog error pattern
**Source:** `mobile/src/hooks/usePlantationAdmin.ts` lines 115–117
**Apply to:** all new async error paths
```typescript
} catch (e: any) {
  showInfoDialog(showConfirm, 'Error', e?.message ?? 'No se pudo verificar el estado.', 'alert-circle-outline', colors.danger);
}
```

---

## No Analog Found

All files have close analogs in the codebase. No files require pure greenfield implementation.

---

## Metadata

**Analog search scope:** `mobile/src/repositories/`, `mobile/src/queries/`, `mobile/src/services/`, `mobile/src/hooks/`, `mobile/src/components/`, `mobile/src/screens/`, `mobile/drizzle/`, `supabase/migrations/`
**Files scanned:** 18
**Pattern extraction date:** 2026-04-14
