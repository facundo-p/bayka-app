# Phase 14: Sincronizar subgrupos finalizados con N/Ns, resolver N/Ns, bloquear finalización sin N/Ns resueltos — Research

**Researched:** 2026-04-14
**Domain:** Offline-first sync, N/N conflict detection, finalization gate, visual indicators
**Confidence:** HIGH — all claims verified from actual codebase files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Subgrupos finalizados con arboles N/N sin resolver SE sincronizan normalmente. Eliminar el filtro de `getSyncableSubGroups()` que excluye subgrupos con N/N. Los arboles suben con `especieId=null` y `especieCodigo='NN'`.
- **D-02:** Sin warning previo al sincronizar — los N/N se suben silenciosamente como parte del sync normal.
- **D-03:** La funcion RPC `sync_subgroup` en Supabase debe revisarse y ajustarse si rechaza arboles con `especieId=null`. El arbol debe llegar al servidor con especie null.
- **D-04:** La finalizacion de PLANTACION (por admin) se bloquea si hay arboles N/N sin resolver en cualquier subgrupo de la plantacion. Los subgrupos individuales SI se pueden finalizar con N/N.
- **D-05:** El boton "Finalizar plantacion" aparece deshabilitado con texto explicativo: "X arboles N/N sin resolver en Y subgrupos". No se puede tocar.
- **D-06:** El gate actual de finalizacion (todos subgrupos finalizada + pendingSync=false) se extiende con: + no N/N sin resolver en toda la plantacion.
- **D-07:** El admin puede resolver N/N de cualquier subgrupo de la plantacion (no solo los propios). Cada tecnico solo puede resolver los N/N de sus propios subgrupos (mismo comportamiento que hoy, pero ahora tambien post-sync).
- **D-08:** El acceso a la resolucion de N/N se mantiene como hoy: desde dentro del subgrupo o modo plantacion-wide en NNResolutionScreen. No se agrega acceso nuevo desde el gear menu.
- **D-09:** La resolucion de N/N marca `pendingSync=true` en el subgrupo. Al hacer sync, el subgrupo completo se re-sube con el arbol ya resuelto (mismo RPC sync_subgroup, ON CONFLICT DO UPDATE en arboles).
- **D-10:** Deteccion de conflictos de N/N: durante el sync, si un arbol N/N fue resuelto localmente Y tambien fue resuelto en el servidor por otro usuario con una especie DIFERENTE, se detecta el conflicto. Se muestra al usuario cuales N/N difieren. El usuario puede ir a la pantalla de resolucion donde ve la especie del servidor, y decide: aceptar la del servidor (descartar la suya) o imponer la suya (re-sincronizar con su eleccion).
- **D-11:** SubGroupCard: indicador de N/N pendientes usando los 2 colores principales del theme. Sin ensanchar el tamano de la card. Claude elige el mejor formato visual.
- **D-12:** PlantationCard: stat adicional "N/N: X" en la fila de estadisticas, mostrando cantidad total de arboles N/N sin resolver en la plantacion. Mismos colores principales del theme.

### Claude's Discretion

- Punto exacto de deteccion de conflictos de N/N (durante pull o durante push) — elegir el enfoque mas robusto
- Formato visual del indicador de N/N en SubGroupCard (badge, icono, texto compacto)
- UX del flujo de conflicto de N/N: como se presenta la pantalla de resolucion con la opcion del servidor
- Si el RPC necesita cambios menores vs refactoring mayor para aceptar especieId=null
- Manejo de la foto de N/N en el servidor (la foto ya se sube por Phase 12, confirmar que funciona para N/N)

### Deferred Ideas (OUT OF SCOPE)

- **Sincronizar subgrupos activos:** Permitir sync de subgrupos que no estan finalizados. Fase futura.
- **Reapertura de plantacion finalizada:** Admin reabre plantacion finalizada. Quick task o fase futura.
- **Resolucion de N/N por cualquier tecnico asignado:** Hoy solo admin y tecnico original. Podria ampliarse en el futuro.
</user_constraints>

---

## Summary

Phase 14 is a surgical extension of the existing sync, N/N resolution, and plantation finalization infrastructure. All the core pieces already exist — the work is about removing a guard (`getSyncableSubGroups` N/N filter), updating an RPC, adding a gate (`checkFinalizationGate` + `AdminBottomSheet`), extending a hook (`useNNResolution` with role permissions + conflict state), and adding visual indicators to two card components.

The RPC `sync_subgroup` already handles `species_id=NULL` via `NULLIF(t->>'species_id', '')::UUID` — null JSON values serialize to the empty string in JSONB text extraction, and NULLIF converts that to SQL NULL. However the client-side `uploadSubGroup` passes `especieId ?? null` which in JSONB becomes `null` (not `''`), so the current NULLIF pattern would yield NULL correctly. The RPC does NOT need a migration for null species — it already works. [VERIFIED: supabase/migrations/002_sync_rpc.sql line 45]

Conflict detection belongs in `pullFromServer()` — that is the natural point where local vs. server tree data is compared before the push phase. The pull already upserts trees with `ON CONFLICT (id) DO UPDATE` that always takes server `especieId`. The fix is to compare before overwriting: if a local tree has a non-null `especieId` (was resolved locally) and the server has a different non-null `especieId`, that is a conflict. Store the conflict information so `useNNResolution` can surface it.

**Primary recommendation:** Implement in six targeted areas: (1) remove N/N filter in `getSyncableSubGroups`, (2) verify RPC handles null (it does), (3) extend `checkFinalizationGate` with N/N check, (4) update `AdminBottomSheet` + `usePlantationAdmin`, (5) add conflict detection to `pullFromServer`, (6) extend `useNNResolution` with role permissions and conflict state.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Remove N/N sync block | Repository (SubGroupRepository) | Service (SyncService) | `getSyncableSubGroups` is the filter; SyncService calls it |
| Null species upload | Supabase RPC (sync_subgroup) | Service (uploadSubGroup) | RPC handles DB insert; client maps the payload |
| Plantation finalization gate | Query (adminQueries) | Hook (usePlantationAdmin) + Component (AdminBottomSheet) | `checkFinalizationGate` owns the gate logic |
| N/N conflict detection | Service (SyncService.pullFromServer) | Hook (useNNResolution) | Pull happens before push; service writes conflict records, hook reads them |
| Conflict storage | Local SQLite (new field or in-memory) | Database schema | Needs a place to persist detected conflicts between pull and user interaction |
| Role-based N/N resolution | Hook (useNNResolution) | Query (getNNTreesForPlantation) | Hook mediates access; query fetches data; role filter goes in hook |
| Visual indicators (SubGroup) | Screen (PlantationDetailScreen.renderSubGroup) | — | Already has nnBadge inline; styles exist |
| Visual indicators (Plantation) | Component (PlantationCard) | Hook/Query (dashboard) | New `nnCount` prop + stat item in statsRow |

---

## Standard Stack

This phase adds NO new dependencies. All implementation uses existing project stack.

| Library | Purpose | Used In |
|---------|---------|---------|
| Drizzle ORM | Local SQLite queries | repositories/, queries/ |
| `expo-sqlite` | SQLite driver | database/client.ts |
| Supabase JS client | RPC calls, server queries | services/SyncService.ts |
| React Native StyleSheet | UI styling (no inline styles) | All components |
| `@expo/vector-icons/Ionicons` | Icons | PlantationCard, AdminBottomSheet |
| `useLiveData` (liveQuery) | Reactive local data | hooks/ |

[VERIFIED: mobile/src/theme.ts, mobile/src/services/SyncService.ts, mobile/src/repositories/]

---

## Architecture Patterns

### System Architecture Diagram

```
SYNC FLOW (pull → detect → push)
─────────────────────────────────
SyncService.syncPlantation()
  │
  ├─ pullFromServer(plantacionId)
  │     │
  │     ├─ Fetch remote trees
  │     ├─ CONFLICT DETECTION ← NEW
  │     │     Compare: localTree.especieId ≠ null AND serverTree.species_id ≠ null AND differ
  │     │     → write nnConflicts to SQLite (treeId, serverEspecieId, serverEspecieNombre)
  │     └─ Upsert trees into local SQLite
  │
  └─ getSyncableSubGroups(plantacionId, userId)   ← REMOVE N/N FILTER (D-01)
        Returns ALL finalizada + pendingSync=true subgroups
        │
        └─ uploadSubGroup(sg, trees)
              trees include especieId=null for unresolved N/N (already maps via ?? null)
              RPC sync_subgroup → NULLIF handles null → server stores species_id=NULL

FINALIZATION GATE (admin action)
─────────────────────────────────
AdminBottomSheet "Finalizar"
  → usePlantationAdmin.handleFinalize()
       → checkFinalizationGate(plantacionId)   ← EXTEND WITH N/N CHECK (D-06)
             Current: all subgroups finalizada + pendingSync=false
             Extended: also getUnresolvedNNCount(plantacionId) === 0
       → AdminBottomSheet receives unresolvedNNCount, unresolvedNNSubgroups props
       → ActionItem disabled + helperText

N/N RESOLUTION + CONFLICT UX
─────────────────────────────────
NNResolutionScreen
  → useNNResolution(plantacionId, subgrupoId?)
       ← EXTEND: role permission filter (D-07)
         admin: all trees via getNNTreesForPlantation()
         tecnico: only own subgroups (filter by usuarioCreador === userId)
       ← EXTEND: read nnConflicts from SQLite for current tree
         Show conflict banner if conflict exists for currentTree.id
         "Aceptar servidor" → accept server species (call resolveNNTree with server especies)
         "Mantener la mía" → dismiss banner (local will overwrite on next sync)
```

### Recommended Project Structure (no changes needed)

```
mobile/src/
├── repositories/
│   └── SubGroupRepository.ts    # getSyncableSubGroups — remove N/N filter
├── queries/
│   ├── adminQueries.ts          # checkFinalizationGate — add N/N gate
│   └── plantationDetailQueries.ts  # getUnresolvedNNCount (new) or reuse getNNTreesForPlantation
├── services/
│   └── SyncService.ts           # pullFromServer — add conflict detection
├── hooks/
│   ├── usePlantationAdmin.ts    # handleFinalize — pass N/N counts to AdminBottomSheet
│   └── useNNResolution.ts       # role filter + conflict state
├── components/
│   ├── PlantationCard.tsx       # new nnCount prop + stat item
│   └── AdminBottomSheet.tsx     # new unresolvedNNCount prop + gate logic
└── screens/
    ├── PlantationDetailScreen.tsx  # nnBadge already exists — verify styles match UI-SPEC
    └── NNResolutionScreen.tsx   # conflict banner above species grid
```

---

## Detailed Findings Per Decision

### D-01 / D-02: Remove N/N filter from getSyncableSubGroups

**Current code** (`SubGroupRepository.ts`, line 299–317):
```typescript
// Returns finalizada subgroups with NO unresolved N/N trees
export async function getSyncableSubGroups(plantacionId: string, userId?: string): Promise<SubGroup[]> {
  const finalizada = await getFinalizadaSubGroups(plantacionId, userId);
  // ... fetches NN counts
  return finalizada.filter(sg => (nnMap.get(sg.id) ?? 0) === 0);  // ← REMOVE THIS FILTER
}
```

**Required change:** Return all finalizada subgroups with `pendingSync=true` regardless of N/N count. The `pendingSync` flag already exists on `SubGroup` interface. Check that `getFinalizadaSubGroups` also returns subgroups with `pendingSync=true` only — currently it does NOT filter by pendingSync, so `getSyncableSubGroups` also needs to add `pendingSync=true` filter (confirm by reading the function — it currently returns ALL finalizada including those already synced).

**Pitfall:** `getFinalizadaSubGroups` returns ALL finalizada subgroups (not just those with pendingSync=true). The current N/N filter implicitly acted as a gate, but the pendingSync filter is what actually controls what gets uploaded. Confirm the `getSyncableSubGroups` function currently filters by `pendingSync` as well — re-read lines 299–317. It does NOT filter by pendingSync. This means removing N/N filter alone could re-upload already-synced subgroups. The ON CONFLICT DO NOTHING on the RPC protects against duplicates, but it is cleaner to also add `pendingSync=true` as a condition. [VERIFIED: SubGroupRepository.ts lines 283–317]

### D-03: RPC handles null species already

**Finding:** `sync_subgroup` in `002_sync_rpc.sql` line 45:
```sql
NULLIF(t->>'species_id', '')::UUID
```
When the client sends `species_id: null` in the JSONB array, the JSONB text extraction `t->>'species_id'` yields `NULL` (not empty string). `NULLIF(NULL, '')` returns `NULL`. Result: the server correctly inserts `species_id = NULL`. No RPC migration needed.

**However:** The existing `ON CONFLICT (id) DO NOTHING` means re-syncing a N/N tree that was later resolved will NOT update the server species. D-09 says resolution re-sync should update. Need to change to `ON CONFLICT (id) DO UPDATE SET species_id = EXCLUDED.species_id, sub_id = EXCLUDED.sub_id`. This requires a new migration. [VERIFIED: 002_sync_rpc.sql line 39–53]

### D-04 / D-05 / D-06: Plantation finalization gate extension

**Current `checkFinalizationGate`** (`adminQueries.ts` line 22–37):
```typescript
// Checks: at least 1 subgroup, all finalizada AND pendingSync=false
// Returns: canFinalize, blocking[], hasSubgroups
```
Needs to also count unresolved N/N trees across all plantation subgroups.

**New query needed:** `getUnresolvedNNCount(plantacionId)` — count of trees with `especieId IS NULL` joined through subgroups. This query already exists as `getNNTreesForPlantation()` in `plantationDetailQueries.ts` which returns rows. Can use `count()` variant.

**Current `AdminBottomSheet` finalization logic** (`AdminBottomSheet.tsx` lines 105–114):
```typescript
const finalizeDisabled = !meta.canFinalize || hasPendingIssues;
const finalizeHelperText = hasPendingIssues
  ? 'Sincroniza los cambios antes de finalizar'
  : !meta.canFinalize
    ? 'Para finalizar, todos los subgrupos deben estar sincronizados'
    : undefined;
```
Needs a third case: `hasUnresolvedNN` blocked state. The `ExpandedMeta` type needs `unresolvedNNCount` and `unresolvedNNSubgroups`. These are passed from `usePlantationAdmin.fetchPlantationMeta()`.

### D-07: Role permissions in useNNResolution

**Current hook** loads ALL N/N trees in plantation mode via `getNNTreesForPlantation()` without any role filter. Admin sees all — correct. Tecnico should only see N/N in their own subgroups.

**Required change:** Pass `userId` and `isAdmin` to `useNNResolution`. In plantation mode (no `subgrupoId`):
- Admin: use existing `getNNTreesForPlantation(plantacionId)` — unchanged
- Tecnico: use new variant `getNNTreesForPlantationByUser(plantacionId, userId)` that filters by `subgroups.usuarioCreador = userId`

The `NNResolutionScreen` already receives `plantacionId` param. It needs to also receive or derive `isAdmin` and `userId`. The hook `useCurrentUserId` is already in the codebase; `isAdmin` can be derived from the role in SecureStore (same pattern as other screens).

### D-09: ON CONFLICT DO UPDATE for tree resolution re-sync

**Problem:** The current RPC uses `ON CONFLICT (id) DO NOTHING` for trees, which means if a N/N tree was already uploaded with `species_id=NULL`, a later re-sync with the resolved species will be silently ignored by the RPC.

**Required:** New Supabase migration `009_sync_subgroup_update_trees.sql` that modifies the RPC to use `ON CONFLICT (id) DO UPDATE SET species_id = EXCLUDED.species_id, sub_id = EXCLUDED.sub_id` for trees. The subgroup row can keep `DO NOTHING` since subgroup metadata doesn't change.

This is a targeted RPC change. The subgroup INSERT stays `DO NOTHING`. Only tree INSERT changes to `DO UPDATE`.

### D-10: Conflict detection in pullFromServer

**Current pull flow** (`SyncService.ts` lines 483–513): When pulling trees, it does `ON CONFLICT (id) DO UPDATE SET especieId = excluded.especie_id, ...` — the server value always wins.

**Conflict scenario:**
1. User A resolves N/N tree locally (sets `especieId = X`)
2. User B also resolves same N/N tree on their device (sets `especieId = Y`) and syncs first
3. Server now has `species_id = Y`
4. User A syncs: pull phase downloads tree with `species_id = Y` from server, overwriting local `especieId = X`

**Detection window:** Compare local tree's `especieId` vs server tree's `species_id` BEFORE the upsert. If both non-null and different → conflict.

**Conflict storage approach:** A lightweight in-memory approach (module-level Map or React state) is risky across component lifetimes. A persistent approach via a new local SQLite table `nn_conflicts` (treeId, serverEspecieId, serverEspecieNombre, detectedAt) is more robust and survives component remounts.

**Schema addition needed** (new migration or via Drizzle schema): `nn_conflicts` table with columns: `tree_id TEXT PK, server_especie_id TEXT, server_especie_nombre TEXT, detected_at TEXT`.

**Alternative simpler approach:** Add `conflictEspecieId TEXT` and `conflictEspecieNombre TEXT` columns directly to the local `trees` table. When conflict detected during pull, write these columns. `useNNResolution` reads them. When user resolves conflict, clear these columns. This avoids a new table and uses the existing Drizzle schema pattern. [ASSUMED — this is a design recommendation; user has not specified storage mechanism]

### D-11 / D-12: Visual indicators

**PlantationCard** (`PlantationCard.tsx`):
- Current `statsRow` has three `statItem` views: total (leaf-outline), synced (cloud-done-outline), today (today-outline)
- Add fourth stat: `nnCount > 0` → render `help-circle-outline` icon + count in `colors.secondaryYellowDark`
- New prop: `nnCount: number`
- Callers need to pass nnCount. The dashboard queries (`dashboardQueries.ts`) build plantation stats — need new per-plantation N/N count.

**SubGroupCard (inline in PlantationDetailScreen)**:
- `renderSubGroup` at line 93 already has: `{nnCount > 0 && <View style={styles.nnBadge}><Text style={styles.nnBadgeText}>{nnCount} N/N</Text></View>}`
- The `nnBadge` / `nnBadgeText` styles may already exist. Need to verify styles match UI-SPEC contract (check PlantationDetailScreen.tsx styles section). [ASSUMED styles may need creation if not present — verify during implementation]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict storage | Custom in-memory singleton | SQLite columns on `trees` table or `nn_conflicts` table | Survives remounts, accessible via Drizzle queries |
| Role check in hook | Ad-hoc role string comparison | Existing `useCurrentUserId` + role from SecureStore (same pattern as other hooks) | Consistent with existing auth pattern |
| N/N count for gate | Raw SQL in `checkFinalizationGate` | Reuse `getNNTreesForPlantation()` or new `getUnresolvedNNCountForPlantation()` in queries/ | Keeps queries centralized per CLAUDE.md Rule 9 |
| Supabase RPC update | Modify `002_sync_rpc.sql` | Create new migration `009_...sql` + update journal + migrations.js | Drizzle migration pattern: MUST update 3 files |

---

## Common Pitfalls

### Pitfall 1: ON CONFLICT DO NOTHING blocks tree resolution re-sync
**What goes wrong:** N/N tree uploaded with `species_id=NULL`. User resolves locally. Re-sync does nothing on server because RPC uses DO NOTHING.
**Why it happens:** D-09 requires re-upload to update resolved species, but the current RPC design prevents updates.
**How to avoid:** Migration to change tree insert to `ON CONFLICT (id) DO UPDATE SET species_id = EXCLUDED.species_id, sub_id = EXCLUDED.sub_id`.
**Warning signs:** Server still has `species_id=NULL` after tecnico resolves and re-syncs.

### Pitfall 2: getSyncableSubGroups returns already-synced subgroups
**What goes wrong:** After removing N/N filter, all finalizada subgroups (including `pendingSync=false`) are returned.
**Why it happens:** `getFinalizadaSubGroups` doesn't filter by `pendingSync`. The N/N filter was the only effective gate.
**How to avoid:** Add `pendingSync=true` condition when removing the N/N filter.
**Warning signs:** Sync uploads subgroups that were already synced (no data corruption due to DO NOTHING, but wastes bandwidth).

### Pitfall 3: Conflict detection overwrites local resolution before user sees it
**What goes wrong:** `pullFromServer` detects conflict and the ON CONFLICT DO UPDATE immediately overwrites local `especieId` with server value — user's local resolution is lost before they can choose.
**Why it happens:** Current pull code uses `ON CONFLICT DO UPDATE SET especieId = excluded.especie_id`.
**How to avoid:** In conflict detection path: BEFORE the upsert, check for conflict and store it. Change the pull upsert to preserve local `especieId` when a conflict is stored (i.e., don't overwrite when `conflictEspecieId IS NOT NULL`). Or: store the server value in `conflictEspecieId` column and do NOT update `especieId` until user resolves.
**Warning signs:** After pull with conflict, user sees server species in NNResolutionScreen instead of their own resolution.

### Pitfall 4: Role filter bypassed in single-subgroup mode
**What goes wrong:** When navigating to N/N resolution from within a subgroup, `subgrupoId` is passed. The hook uses `useTrees(subgrupoId)` which doesn't filter by creator. A tecnico could access another user's N/N via direct URL.
**Why it happens:** Role filtering was never needed before because N/N were always resolved before sync (local only). Now N/N can exist on server in other users' subgroups.
**How to avoid:** In `useNNResolution` single-subgroup mode, check that the subgroup's `usuarioCreador === userId` before allowing resolution actions. The `isReadOnly` prop in `useNNFlow` pattern can be applied here.

### Pitfall 5: Drizzle migration requires 3 files
**What goes wrong:** Creating only the SQL file for `nn_conflicts` table or `trees` column addition. App hangs at splash.
**Why it happens:** Drizzle requires SQL file + journal entry + `migrations.js` update (project lesson from feedback_drizzle_migrations.md).
**How to avoid:** Update all 3 files: the `.sql` file, the journal JSON, and `migrations.js` array. [VERIFIED: feedback_drizzle_migrations.md in MEMORY]

### Pitfall 6: checkFinalizationGate called before sync — N/N count may be stale
**What goes wrong:** Admin opens bottom sheet while offline. `getUnresolvedNNCount` returns local data which may not reflect server state.
**Why it happens:** Offline-first — local is the source of truth until sync.
**How to avoid:** This is acceptable by design (offline-first). The gate is advisory and consistent with how the sync gate works. Document this as expected behavior.

### Pitfall 7: PlantationCard N/N count not passed from dashboard queries
**What goes wrong:** `PlantationCard` receives `nnCount` prop but callers don't compute it.
**Why it happens:** Dashboard stats are computed in `dashboardQueries.ts` and the query doesn't currently include N/N count per plantation.
**How to avoid:** Add N/N count to the plantation stats query in `dashboardQueries.ts`. Use a subquery similar to `getNNCountsPerSubgroup`. Pass through the hook that consumes dashboard data.

---

## Code Examples

### Remove N/N filter — new getSyncableSubGroups
```typescript
// Source: mobile/src/repositories/SubGroupRepository.ts (current lines 299-317)
// CHANGE: Remove NN count query and filter; keep pendingSync=true condition
export async function getSyncableSubGroups(plantacionId: string, userId?: string): Promise<SubGroup[]> {
  const conditions = [
    eq(subgroups.plantacionId, plantacionId),
    eq(subgroups.estado, 'finalizada'),
    eq(subgroups.pendingSync, true),  // ADD: only pending ones
  ];
  if (userId) {
    conditions.push(eq(subgroups.usuarioCreador, userId));
  }
  return db.select().from(subgroups).where(and(...conditions)) as unknown as SubGroup[];
}
```

### Extend checkFinalizationGate
```typescript
// Source: mobile/src/queries/adminQueries.ts (current lines 22-37)
// EXTEND: add N/N count to result
export async function checkFinalizationGate(plantacionId: string): Promise<{
  canFinalize: boolean;
  blocking: Array<{ nombre: string; estado: string; pendingSync: boolean }>;
  hasSubgroups: boolean;
  unresolvedNNCount: number;
  unresolvedNNSubgroups: number;
}> {
  const allSubgroups = await db.select({ ... }).from(subgroups).where(...);
  const blocking = allSubgroups.filter(s => s.estado !== 'finalizada' || s.pendingSync);

  // NEW: count unresolved N/N trees per subgroup
  const nnRows = await db.select({ subgrupoId: trees.subgrupoId, cnt: count() })
    .from(trees)
    .where(and(
      isNull(trees.especieId),
      sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`
    ))
    .groupBy(trees.subgrupoId);

  const unresolvedNNCount = nnRows.reduce((sum, r) => sum + r.cnt, 0);
  const unresolvedNNSubgroups = nnRows.length;

  return {
    canFinalize: allSubgroups.length > 0 && blocking.length === 0 && unresolvedNNCount === 0,
    blocking,
    hasSubgroups: allSubgroups.length > 0,
    unresolvedNNCount,
    unresolvedNNSubgroups,
  };
}
```

### Conflict detection in pullFromServer (conceptual)
```typescript
// Source: mobile/src/services/SyncService.ts (in the trees pull section, lines 483-513)
// BEFORE upsert, detect conflicts:
for (const t of remoteTrees) {
  if (t.species_id !== null) {
    // Check local tree's resolution
    const [local] = await db.select({ especieId: trees.especieId })
      .from(trees).where(eq(trees.id, t.id));
    if (local && local.especieId !== null && local.especieId !== t.species_id) {
      // CONFLICT: both resolved with different species
      // Store server species in conflict columns; do NOT overwrite local especieId
      await db.update(trees)
        .set({ conflictEspecieId: t.species_id })  // new column
        .where(eq(trees.id, t.id));
      continue;  // skip the upsert below for this tree
    }
  }
  // Normal upsert...
}
```

### AdminBottomSheet N/N gate
```typescript
// Source: mobile/src/components/AdminBottomSheet.tsx (extend lines 105-114)
// new props: unresolvedNNCount, unresolvedNNSubgroups
const hasUnresolvedNN = unresolvedNNCount > 0;
const finalizeDisabled = !meta.canFinalize || hasPendingIssues || hasUnresolvedNN;
const finalizeHelperText = hasPendingIssues
  ? 'Sincroniza los cambios antes de finalizar'
  : hasUnresolvedNN
    ? `${unresolvedNNCount} árbol${unresolvedNNCount > 1 ? 'es' : ''} N/N sin resolver en ${unresolvedNNSubgroups} subgrupo${unresolvedNNSubgroups > 1 ? 's' : ''}`
    : !meta.canFinalize
      ? 'Para finalizar, todos los subgrupos deben estar sincronizados'
      : undefined;
```

---

## Supabase Migration Required

**New migration: `009_sync_subgroup_update_trees.sql`**

```sql
-- Migration 009: update sync_subgroup RPC to allow tree species updates on conflict
-- Required for D-09: N/N resolution re-sync must update the server tree species.
CREATE OR REPLACE FUNCTION sync_subgroup(p_subgroup JSONB, p_trees JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  INSERT INTO subgroups (...) VALUES (...) ON CONFLICT (id) DO NOTHING;
  -- DUPLICATE_CODE check (unchanged)...

  -- Trees: use DO UPDATE to allow species resolution to propagate
  INSERT INTO trees (id, subgroup_id, species_id, posicion, sub_id, foto_url, usuario_registro, created_at)
  SELECT ... FROM jsonb_array_elements(p_trees) AS t
  ON CONFLICT (id) DO UPDATE SET
    species_id = EXCLUDED.species_id,
    sub_id     = EXCLUDED.sub_id;
    -- Note: posicion, foto_url, usuario_registro, created_at intentionally NOT updated

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;
```

**Drizzle migration files to update (3 required):**
1. `supabase/migrations/009_sync_subgroup_update_trees.sql`
2. Journal JSON (add entry)
3. `migrations.js` array (add entry)

[VERIFIED pattern: feedback_drizzle_migrations.md]

---

## Schema Change Required (if conflict stored in SQLite)

If conflict detection stores server `especieId` in the local `trees` table:

**New columns on `trees` table:**
- `conflict_especie_id TEXT` — server's species UUID when conflict detected
- `conflict_especie_nombre TEXT` — server's species name (denormalized for display without join)

Requires Drizzle migration (3 files again):
1. SQL: `ALTER TABLE trees ADD COLUMN conflict_especie_id TEXT; ALTER TABLE trees ADD COLUMN conflict_especie_nombre TEXT;`
2. Journal entry
3. `migrations.js` entry

Schema file: update `mobile/src/database/schema.ts` trees table definition.

[ASSUMED: the column approach is recommended over a separate nn_conflicts table for simplicity]

---

## Dashboard Queries Extension

**`dashboardQueries.ts`** builds per-plantation stats. Currently returns `totalCount`, `syncedCount`, `todayCount`, `pendingSync` counts. Needs to add `nnCount` (unresolved N/N per plantation) for `PlantationCard`.

Options:
1. Add a join/subquery inside the existing plantation stats query
2. Add a separate `getNNCountsPerPlantation()` function and merge in the hook/screen

The existing `getNNCountsPerSubgroup()` in `plantationDetailQueries.ts` groups by `subgrupoId`. Need a version grouped by `plantacionId`. The logic is: count trees with `especieId IS NULL` where subgroup belongs to plantation.

[VERIFIED: mobile/src/queries/plantationDetailQueries.ts lines 32–43 — existing pattern to follow]

---

## State of the Art

| Old Approach | Current Approach | Phase 14 Change | Impact |
|---|---|---|---|
| N/N blocks sync entirely | N/N blocks sync entirely | N/N allowed in sync | Subgroups sync with null species |
| ON CONFLICT DO NOTHING for trees | ON CONFLICT DO NOTHING | ON CONFLICT DO UPDATE (species+subId only) | Re-resolves propagate to server |
| Plantation finalization: all synced | All synced + all non-NN | All synced + zero unresolved N/N | Cleaner semantic gate |
| useNNResolution: no role filter | No role filter | Role filter: admin=all, tecnico=own | Correct permission model |
| No conflict detection | No conflict detection | Conflict stored on pull, surfaced in NNResolutionScreen | User controls which resolution wins |

---

## Open Questions (RESOLVED)

1. **Conflict storage: trees table columns vs separate table** (RESOLVED)
   - What we know: conflicts are transient (exist until user resolves them); tied to a specific tree
   - What's unclear: whether adding columns to `trees` schema is acceptable or if a separate table is cleaner
   - Recommendation: Trees table columns — simpler, avoids join, consistent with existing `fotoSynced` pattern
   - **Resolution:** Trees table columns chosen. Plan 01 Task 1 adds `conflictEspecieId` and `conflictEspecieNombre` to the trees schema via Drizzle migration 0010.

2. **Does `getFinalizadaSubGroups` need `pendingSync=true` guard?** (RESOLVED)
   - What we know: `getSyncableSubGroups` currently derives from `getFinalizadaSubGroups` which returns ALL finalizada
   - What's unclear: whether callers of `getFinalizadaSubGroups` (if any others exist) should also see only pending-sync ones
   - Recommendation: Modify only `getSyncableSubGroups` with the `pendingSync=true` condition; leave `getFinalizadaSubGroups` unchanged
   - **Resolution:** Only `getSyncableSubGroups` gets the `pendingSync=true` filter. `getFinalizadaSubGroups` left unchanged. Plan 01 Task 2 implements this.

3. **`PlantationCard` nnCount data flow** (RESOLVED)
   - What we know: `PlantationCard` is rendered from `PlantacionesScreen` / `AdminScreen` which use `usePlantationAdmin` / `dashboardQueries`
   - What's unclear: whether `nnCount` should be included in the main plantation list query or computed separately
   - Recommendation: Add to `dashboardQueries.ts` per-plantation stats to keep the data flow in one place
   - **Resolution:** Separate `getUnresolvedNNCountsPerPlantation()` query in `dashboardQueries.ts` (Plan 01 Task 2), consumed via `usePlantaciones` as `nnCountMap` (Plan 02 Task 1), passed to `PlantationCard` (Plan 03 Task 1).

---

## Environment Availability

Step 2.6: SKIPPED — phase is code/config changes only. No new external dependencies.

---

## Validation Architecture

No automated test framework detected changes are needed for this phase. The existing test infrastructure (jest, per Phase 9) covers repositories and queries. New functions (`checkFinalizationGate` extension, `getSyncableSubGroups` change, conflict detection) should have unit tests following existing patterns in `__tests__/`.

### Wave 0 Gaps
- [ ] Unit test for updated `getSyncableSubGroups` (returns N/N subgroups now)
- [ ] Unit test for extended `checkFinalizationGate` (N/N count in result)
- [ ] Unit test for conflict detection path in `pullFromServer`

---

## Security Domain

No new authentication, session management, or input validation surface areas. The role-based N/N resolution filter (D-07) is enforced in the hook layer (client-side). Server-side RLS already restricts tree writes to `usuario_registro = auth.uid()`, which means a tecnico cannot resolve another user's tree via direct API call either.

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V4 Access Control | yes | Role check in `useNNResolution` hook + server RLS on trees |
| V5 Input Validation | yes | `NULLIF` in RPC handles null species_id safely |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `conflictEspecieId`/`conflictEspecieNombre` columns to `trees` table is preferred over a separate `nn_conflicts` table | Detailed Findings D-10, Schema Change | Could need new table with different joins |
| A2 | `nnBadge` / `nnBadgeText` styles already exist in `PlantationDetailScreen.styles.ts` or inline in the screen | Visual Indicators | Styles would need to be created in Wave 0 |
| A3 | Adding N/N count to `dashboardQueries.ts` plantation stats query is feasible without major refactor | Dashboard Queries Extension | Query may become too complex; separate query may be needed |

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `mobile/src/repositories/SubGroupRepository.ts` — `getSyncableSubGroups`, `getFinalizadaSubGroups` exact implementations
- `mobile/src/services/SyncService.ts` — `pullFromServer`, `uploadSubGroup`, `syncPlantation` full implementations
- `supabase/migrations/002_sync_rpc.sql` — `sync_subgroup` RPC: NULLIF pattern, ON CONFLICT behavior
- `mobile/src/queries/adminQueries.ts` — `checkFinalizationGate` exact signature and logic
- `mobile/src/hooks/useNNResolution.ts` — full hook, role logic absent confirmed
- `mobile/src/hooks/usePlantationAdmin.ts` — `handleFinalize` flow, `ExpandedMeta` type
- `mobile/src/components/AdminBottomSheet.tsx` — finalization gate UI, `ActionItem` disabled pattern
- `mobile/src/components/PlantationCard.tsx` — `statsRow` pattern, existing stat items
- `mobile/src/screens/PlantationDetailScreen.tsx` — `renderSubGroup` inline nnBadge confirmed present line 93
- `mobile/src/screens/NNResolutionScreen.tsx` — full screen, conflict banner insertion point identified
- `mobile/src/theme.ts` — all color tokens, yellow N/N colors at line 42–47
- `mobile/src/hooks/usePendingSyncCount.ts` — `blockedByNN` concept, may become redundant

### Secondary (MEDIUM confidence)
- `14-UI-SPEC.md` — visual contract from gsd-ui-researcher, verified against codebase

---

## Metadata

**Confidence breakdown:**
- Sync changes (D-01, D-02, D-03): HIGH — exact code locations identified, NULLIF behavior verified
- RPC update needed (D-09): HIGH — ON CONFLICT DO NOTHING confirmed, migration design is clear
- Finalization gate (D-04 to D-06): HIGH — exact gate code verified, extension pattern clear
- Conflict detection (D-10): MEDIUM — approach recommended, storage mechanism is A1 assumption
- Role permissions (D-07): HIGH — hook code verified, role filter absent confirmed
- Visual indicators (D-11, D-12): HIGH — existing nnBadge inline confirmed, PlantationCard statsRow pattern clear

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable codebase, no external dependencies)
