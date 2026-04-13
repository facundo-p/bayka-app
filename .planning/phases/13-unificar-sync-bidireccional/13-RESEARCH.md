# Phase 13: Unificar sync bidireccional - Research

**Researched:** 2026-04-13
**Domain:** React Native / Drizzle SQLite / Sync UX / State management
**Confidence:** HIGH

## Summary

This phase consolidates two separate sync actions (Descargar / Subir) into a single bidirectional "Sincronizar" button, introduces a `pendingSync` boolean flag at the subgroup level for granular dirty tracking, replaces the "Sincronizado" chip with an orange dot indicator, and adds a persistent photo-inclusion setting.

The codebase already has a solid foundation: `SyncService.syncPlantation()` already does pull-then-push for a single plantation, `useSync` already has `startSync` and `startPull` as separate flows, and `usePendingSyncCount` already tracks pending subgroups. The main work is: (1) a Drizzle migration to add `pendingSync` to `subgroups`, (2) wiring all mutation paths to set `pendingSync = true`, (3) making `markAsSincronizada` set `pendingSync = false`, (4) removing the `sincronizada` state enum value and replacing all references with `pendingSync` semantics, (5) adding a global sync entry point in `PlantacionesScreen`, and (6) building the orange dot component and persisting the photo setting via SecureStore.

**Primary recommendation:** Start with the data model migration and mutation wiring (the irreversible foundation), then adapt the sync orchestration, then update UI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Boton unico "Sincronizar" reemplaza "Descargar datos" y "Subir datos". Ejecuta pull+push bidireccional en una sola operacion.
- **D-02:** Sync solo sincroniza plantaciones ya descargadas localmente. El CatalogScreen y su flujo de descarga inicial se mantienen completamente separados e independientes.
- **D-03:** Dos puntos de entrada: boton global en header de PlantacionesScreen (sincroniza TODAS las plantaciones locales) + opcion por plantacion individual en el gear/bottom sheet.
- **D-04:** Setting persistente para incluir/excluir fotos en sync. Se configura una vez y aplica siempre (no preguntar cada vez). Debe haber forma de cambiar el setting (toggle en modal de sync o en perfil).
- **D-05:** Dirty flag a nivel subgrupo: `subgroups.pendingSync` (boolean). Cualquier mutacion local (crear arbol, editar arbol, crear subgrupo, finalizar, revertir orden, resolver N/N) marca `pendingSync = true`. Sync exitoso lo marca `false`.
- **D-06:** Fotos mantienen su flag independiente `fotoSynced` en la tabla trees. El dirty flag del subgrupo es ortogonal al sync de fotos.
- **D-07:** "Sincronizada" deja de existir como estado de subgrupo. Los estados son: `activa` y `finalizada`. La inmutabilidad se determina por el estado de la plantacion (finalizada), no del subgrupo.
- **D-08:** Orange dot como indicador de cambios pendientes. El color del dot DEBE estar centralizado en `theme.ts` (ej: `colors.syncPending`).
- **D-09:** Orange dot aparece en: PlantationCard (si alguno de sus subgrupos tiene pendingSync=true o fotos pendientes), SubGroupCard (si ese subgrupo tiene pendingSync=true), icono de sync global en header de PlantacionesScreen (si hay cualquier cosa pendiente de sync en cualquier plantacion).
- **D-10:** Cuando no hay nada pendiente, no se muestra dot (la ausencia de dot = todo al dia).
- **D-11:** Requiere migracion Drizzle: agregar columna `pendingSync` (boolean, default true) a tabla `subgroups`.
- **D-12:** Progreso y manejo de errores parciales a definir durante planning.

### Claude's Discretion

- Flujo exacto del SyncProgressModal para mostrar progreso bidireccional (fases pull/push)
- UX de la configuracion del setting de fotos (toggle en modal, en perfil, o ambos)
- Estrategia de rollback si falla a mitad de sync (continuar con el resto o parar)

### Deferred Ideas (OUT OF SCOPE)

- Sincronizar subgrupos activos y con N/N sin resolver (fase futura)
- Reapertura de plantacion finalizada por admin (quick task aparte)
- Cambios en CatalogScreen (flujo aparte)
</user_constraints>

---

## Standard Stack

No new libraries are needed. The phase uses the existing stack exclusively.

### Core (already installed)
| Library | Purpose | Used In |
|---------|---------|---------|
| drizzle-orm / expo-sqlite | Local SQLite mutations and schema migrations | Schema, repositories |
| expo-secure-store | Persist photo-inclusion setting | useSync / new hook |
| react-native (useState, useCallback) | Hook state management | useSync, PlantationDetailHeader |
| @expo/vector-icons / Ionicons | Orange dot icon or View dot | OrangeDot component |

**No new npm installs required.**

---

## Architecture Patterns

### Recommended Project Structure (new/changed files)

```
mobile/drizzle/
├── 0009_add_subgroup_pending_sync.sql     # ALTER TABLE subgroups ADD COLUMN
mobile/drizzle/meta/
├── _journal.json                           # append entry idx:9
mobile/drizzle/migrations.js               # import m0009, add to migrations map

mobile/src/database/schema.ts              # add pendingSync to subgroups table
mobile/src/repositories/SubGroupRepository.ts   # markAsSincronizada -> markPendingSyncFalse,
                                               # all mutations call markPendingSync(id, true),
                                               # remove 'sincronizada' from SubGroupEstado,
                                               # canEdit now checks plantacion estado not subgrupo estado
mobile/src/services/SyncService.ts         # syncPlantation calls markPendingSync(false) on success,
                                           # new syncAllLocal() for global sync,
                                           # photo setting read from SecureStore
mobile/src/hooks/useSync.ts                # unify startSync + startPull into startBidirectionalSync,
                                           # accept plantacionId array for global sync,
                                           # read/write photo setting from SecureStore
mobile/src/hooks/useSyncSetting.ts         # NEW: persist incluirFotos to SecureStore
mobile/src/hooks/usePendingSyncCount.ts    # adapt to use pendingSync boolean instead of estado='finalizada'
mobile/src/components/OrangeDot.tsx        # NEW: small colored dot component
mobile/src/components/PlantationDetailHeader.tsx  # replace two buttons with one "Sincronizar"
mobile/src/components/SyncProgressModal.tsx       # show pull phase then push phase
mobile/src/components/PlantationCard.tsx          # add OrangeDot when has pending subgroups
mobile/src/screens/PlantacionesScreen.tsx          # add global sync button + orange dot in header
mobile/src/screens/PlantationDetailScreen.tsx      # update onStartSync handler for new unified flow
mobile/src/queries/adminQueries.ts                 # checkFinalizationGate: 'sincronizada' -> pendingSync=false
mobile/src/queries/dashboardQueries.ts             # syncedCount: use pendingSync=false not estado='sincronizada'
mobile/src/queries/plantationDetailQueries.ts      # unsynced count: use pendingSync=true not estado!='sincronizada'
mobile/src/queries/catalogQueries.ts               # remove sincronizada filter
mobile/src/theme.ts                                # add colors.syncPending (orange dot color)
```

### Pattern 1: Drizzle Migration (3-file rule)

The project has a strict rule: every migration MUST update exactly 3 files. Current last migration is `0008_add_foto_synced`. Next must be `0009_add_subgroup_pending_sync`.

**File 1 — SQL:**
```sql
-- mobile/drizzle/0009_add_subgroup_pending_sync.sql
ALTER TABLE `subgroups` ADD `pending_sync` integer DEFAULT 1 NOT NULL;
```
Note: default 1 (true) — every existing subgroup starts as "needs sync check". This is safe because sync only processes `finalizada` subgroups; existing `activa` and `sincronizada` rows will have a dot but the next sync will set them to false.

Actually the correct default depends on subgroup state. Existing subgroups in `sincronizada` state should have `pending_sync = 0`. However D-07 removes the `sincronizada` state entirely. The migration must run BEFORE the state enum change — so for the migration, default=0 is safer (no dot for existing synced subgroups). Then when `sincronizada` state is removed, subgroups that WERE sincronizada (pendingSync=0) keep pendingSync=0, which means no orange dot. Correct.

```sql
ALTER TABLE `subgroups` ADD `pending_sync` integer DEFAULT 0 NOT NULL;
```

**File 2 — journal:**
```json
{
  "idx": 9,
  "version": "6",
  "when": 1744900000000,
  "tag": "0009_add_subgroup_pending_sync",
  "breakpoints": true
}
```

**File 3 — migrations.js:**
```js
import m0009 from './0009_add_subgroup_pending_sync.sql';
// add m0009 to migrations map
```

### Pattern 2: SubGroup Estado Refactor (D-07)

The `sincronizada` state is being removed. Its role (immutability gate) moves to the plantation's `estado === 'finalizada'`.

**What changes:**

| Before | After |
|--------|-------|
| `estado: 'sincronizada'` = immutable | `pendingSync = false` = data is synced, but still mutable (unless plantation finalizada) |
| `canEdit` checks `estado !== 'sincronizada'` | `canEdit` checks plantation.estado === 'activa' AND ownership |
| `markAsSincronizada()` sets estado='sincronizada' | `markPendingSyncFalse()` sets pendingSync=false |
| Finalization gate: all subgroups must be 'sincronizada' | Finalization gate: all subgroups must have pendingSync=false |

**Immutability rule after D-07:** A subgroup is immutable only when the parent plantation is `finalizada`. A subgroup with `pendingSync=false` in an `activa` plantation is still editable (but has no orange dot = it is synced).

**Critical:** The `SubGroupEstado` type in `SubGroupRepository.ts` currently exports `'activa' | 'finalizada' | 'sincronizada'`. It must become `'activa' | 'finalizada'`. All files that compare `item.estado === 'sincronizada'` must be updated.

### Pattern 3: Mutation Wiring for pendingSync

Every write operation on a subgroup or its trees must set `subgroups.pendingSync = true`. The pattern is a helper:

```typescript
// mobile/src/repositories/SubGroupRepository.ts
export async function markSubGroupPendingSync(subgrupoId: string): Promise<void> {
  await db.update(subgroups)
    .set({ pendingSync: true })
    .where(eq(subgroups.id, subgrupoId));
}
```

Operations that must call this (with their subgrupo ID):
- `createSubGroup` — on the new subgroup itself (insert with pendingSync=true by default)
- `finalizeSubGroup` — on the subgroup being finalized
- `updateSubGroup` — on the subgroup being edited
- `updateSubGroupCode` — on the subgroup whose code changed
- `reactivateSubGroup` — on the subgroup being reactivated
- `insertTree` — on `tree.subgrupoId`
- `deleteLastTree` — on `tree.subgrupoId`
- `reverseTreeOrder` — on `subgrupoId`
- `resolveNNTree` — on `tree.subgrupoId` (need to fetch subgrupoId first)
- `updateTreePhoto` — on `tree.subgrupoId`
- `deleteTreeAndRecalculate` — on `subgrupoId`

For `createSubGroup`: pass `pendingSync: true` directly in the INSERT values (already the default in the migration, but explicit is clearer).

For tree operations: the tree repos don't have access to the subgrupoId directly in all cases. `insertTree` receives subgrupoId. `updateTreePhoto` and `deleteLastTree` take treeId — they'll need to fetch the subgrupoId before marking.

### Pattern 4: Persistent Photo Setting via SecureStore

The project already uses `expo-secure-store` for persisting session tokens, role, and profile. A new `useSyncSetting` hook follows the same cache-first pattern as `useProfileData`:

```typescript
// mobile/src/hooks/useSyncSetting.ts
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect, useCallback } from 'react';

const SYNC_PHOTOS_KEY = 'sync_include_photos';

export function useSyncSetting() {
  const [incluirFotos, setIncluirFotos] = useState(true); // default = include

  useEffect(() => {
    SecureStore.getItemAsync(SYNC_PHOTOS_KEY).then(val => {
      if (val !== null) setIncluirFotos(val === 'true');
    });
  }, []);

  const toggleIncluirFotos = useCallback(async (value: boolean) => {
    setIncluirFotos(value);
    await SecureStore.setItemAsync(SYNC_PHOTOS_KEY, String(value));
  }, []);

  return { incluirFotos, toggleIncluirFotos };
}
```

This hook is used by `PlantationDetailHeader` (now simplified to a single toggle) and potentially the profile screen.

### Pattern 5: Unified Sync Entry Points

**Per-plantation (PlantationDetailHeader):**
- Single "Sincronizar" button replaces Descargar + Subir
- Calls `startBidirectionalSync(plantacionId, { incluirFotos })`
- The sync is always pull-first, then push

**Global (PlantacionesScreen header):**
- New sync icon button with orange dot overlay
- Calls `startGlobalSync({ incluirFotos })` which iterates all local plantations
- Uses a new `syncAllPlantations()` in SyncService

**Per-plantation in AdminBottomSheet:**
- The existing Descargar/Subir buttons (or their replacements) in `AdminBottomSheet` are REMOVED
- D-03 says the per-plantation entry point is from the gear/bottom sheet — add a "Sincronizar" ActionItem to AdminBottomSheet
- Tecnico users: the unified button is in PlantationDetailHeader only

### Pattern 6: OrangeDot Component

```typescript
// mobile/src/components/OrangeDot.tsx
import { View } from 'react-native';
import { colors } from '../theme';

type Props = { size?: number };

export default function OrangeDot({ size = 8 }: Props) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.syncPending,
    }} />
  );
}
```

Color must be added to `theme.ts`:
```typescript
syncPending: '#F97316', // orange-500 — distinct from stateFinalizada (#F59E0B amber)
```

Placement:
- **PlantationCard:** absolute-positioned over the sidebar leaf icon, top-right corner (pattern mirrors the existing photo sync dot on TreeRow)
- **SubGroupCard (in PlantationDetailScreen):** inline in the cardRow after the name, before the chip
- **Header sync icon (PlantacionesScreen):** absolute-positioned over the cloud-sync icon, top-right

### Pattern 7: Global Sync in SyncService

```typescript
// mobile/src/services/SyncService.ts
export async function syncAllPlantations(
  onProgress?: (plantation: string, done: number, total: number) => void,
  incluirFotos: boolean = true
): Promise<{ plantation: string; results: SyncSubGroupResult[] }[]> {
  const localPlantations = await db.select({ id: plantations.id, lugar: plantations.lugar }).from(plantations);
  const allResults = [];
  for (let i = 0; i < localPlantations.length; i++) {
    const p = localPlantations[i];
    onProgress?.(p.lugar, i, localPlantations.length);
    const results = await syncPlantation(p.id);
    if (incluirFotos) await uploadPendingPhotos(p.id);
    allResults.push({ plantation: p.lugar, results });
  }
  notifyDataChanged();
  return allResults;
}
```

### Pattern 8: SyncProgressModal Bidirectional Flow

The modal currently handles `'syncing' | 'pulling' | 'uploading-photos' | 'downloading-photos' | 'done'`.

For the unified bidirectional flow, the new `SyncState` should be:
```typescript
export type SyncState = 
  | 'idle'
  | 'pulling'          // Phase 1: downloading from server
  | 'pushing'          // Phase 2: uploading subgroups 
  | 'uploading-photos' // Phase 3: uploading photos (if enabled)
  | 'downloading-photos' // Phase 3 alt: downloading photos during pull
  | 'done';
```

The modal shows a two-phase progress: first a "Descargando..." spinner, then "Subiendo subgrupos..." with per-subgroup progress. The `'syncing'` state label is renamed to `'pushing'` for clarity.

### Anti-Patterns to Avoid

- **Don't filter pending subgroups by `estado = 'finalizada'` for the orange dot** — after D-07, the dot should be shown for `pendingSync = true` regardless of state. However, sync still only uploads `finalizada` subgroups. These are orthogonal: a subgroup can have `pendingSync=true AND estado='activa'` (edited but not ready to upload yet — show dot but don't sync).
- **Don't call `notifyDataChanged()` inside the mutation loop** — call once at the end per established pattern (Phase 03 decision).
- **Don't import `db` in screens or components** — per CLAUDE.md rule 9. New pendingSync queries must go in `queries/` or `repositories/`.
- **Don't add inline styles** — orange dot must use `StyleSheet.create()` or the component's stylesheet, referencing `colors.syncPending`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persist photo setting | Custom SQLite table | `SecureStore.setItemAsync` | Already used for role, profile, tokens. Lightweight for a single boolean. |
| Global sync progress UI | Custom multi-plantation modal | Adapt existing `SyncProgressModal` | Already has the progress pattern; add plantation name to SyncProgress type |
| Sync atomicity | Custom transaction wrapper | Existing `ON CONFLICT DO NOTHING` RPC | Already idempotent — retry-safe by design |

---

## Common Pitfalls

### Pitfall 1: Missing the 3-file Drizzle migration rule
**What goes wrong:** Adding `pendingSync` to `schema.ts` but forgetting `_journal.json` or `migrations.js`. The app will silently hang at splash (useMigrations never resolves).
**Why it happens:** Developers update schema.ts and assume drizzle-kit handles the rest, but in Expo SQLite migrations must be manually registered.
**How to avoid:** Always update all 3 files atomically: `.sql` + `_journal.json` + `migrations.js`.
**Warning signs:** App hangs at splash screen after schema change.

### Pitfall 2: The `sincronizada` state is referenced in 5+ files
**What goes wrong:** Removing the `sincronizada` state from SubGroupRepository.ts but missing references in `adminQueries.ts`, `dashboardQueries.ts`, `plantationDetailQueries.ts`, `catalogQueries.ts`, and the filter chips in PlantationDetailScreen.
**Why it happens:** It's a string literal scattered across the codebase.
**How to avoid:** Grep for `'sincronizada'` before and after the change.
**Current locations (verified):**
- `SubGroupRepository.ts`: type def, `canEdit`, `markAsSincronizada`, `getFinalizadaSubGroups` (used in `getSyncableSubGroups`)
- `adminQueries.ts`: `checkFinalizationGate` checks `estado !== 'sincronizada'`; `getUnsyncedSubgroupSummary` uses `ne(subgroups.estado, 'sincronizada')`
- `dashboardQueries.ts`: synced count query filters `eq(subgroups.estado, 'sincronizada')`
- `plantationDetailQueries.ts`: unsynced count excludes `sincronizada`
- `catalogQueries.ts`: filter excludes `sincronizada`
- `PlantationDetailScreen.tsx`: filter chip `{ key: 'sincronizada', label: 'Sincronizadas', ... }`
- `usePendingSyncCount.ts`: queries `estado = 'finalizada'` (this changes too)

### Pitfall 3: canEdit immutability semantics break
**What goes wrong:** After removing `sincronizada`, `canEdit()` returns `true` for previously-synced subgroups, allowing edits on data the server already has.
**Why it happens:** The old guard was `estado === 'sincronizada'`. After D-07, the guard changes to plantation state.
**How to avoid:** Update `canEdit()` to accept `plantacionEstado` and check `plantacionEstado === 'finalizada'`. The function signature must change.
**New signature:**
```typescript
export function canEdit(
  subgroup: { usuarioCreador: string },
  userId: string,
  plantacionEstado: string
): boolean {
  if (plantacionEstado === 'finalizada') return false;
  return subgroup.usuarioCreador === userId;
}
```

### Pitfall 4: checkFinalizationGate breaks after removing sincronizada
**What goes wrong:** `checkFinalizationGate` checks `estado !== 'sincronizada'`. After D-07, it must check `pendingSync = true OR estado = 'activa'` instead. If not updated, admin can never finalize a plantation.
**How to avoid:** Update to check `pendingSync = false AND estado = 'finalizada'` for all subgroups.
**New gate:** All subgroups must have `estado = 'finalizada' AND pendingSync = false`.

### Pitfall 5: pullFromServer sets subgroups from server without touching pendingSync
**What goes wrong:** During a pull, remote subgroups are upserted. The upsert sets `estado` but not `pendingSync`. A pulled subgroup (from another device) should have `pendingSync = false`.
**How to avoid:** Add `pendingSync: false` to the upsert SET clause in `pullFromServer`:
```typescript
.onConflictDoUpdate({
  target: subgroups.id,
  set: {
    estado: sql`excluded.estado`,
    nombre: sql`excluded.nombre`,
    pendingSync: false,  // server data is already synced
  },
});
```

### Pitfall 6: Global sync button — "ALL plantations" includes recently-downloaded ones with server data
**What goes wrong:** A plantation just downloaded from catalog has subgroups with `pendingSync = true` (migration default). Global sync will try to upload them, but they have no local `finalizada` subgroups, so sync is a no-op — but it's still wasteful.
**How to avoid:** The migration default should be `0` (false), not `1` (true). Existing subgroups are server data. See Pattern 1 for the correct default.

### Pitfall 7: usePendingSyncCount becomes inconsistent
**What goes wrong:** The hook currently counts `estado = 'finalizada'` as the pending indicator. After this phase, the badge should reflect `pendingSync = true` across all states. The `syncableCount` must still filter for `estado = 'finalizada' AND pendingSync = true` (only finalizada can actually be uploaded).
**How to avoid:** Carefully separate:
- **Orange dot trigger:** `pendingSync = true` (any estado)
- **Syncable count:** `estado = 'finalizada' AND pendingSync = true AND no unresolved N/N`

---

## Code Examples

### Migration SQL
```sql
-- mobile/drizzle/0009_add_subgroup_pending_sync.sql
ALTER TABLE `subgroups` ADD `pending_sync` integer DEFAULT 0 NOT NULL;
```

### Schema addition
```typescript
// mobile/src/database/schema.ts — subgroups table
export const subgroups = sqliteTable('subgroups', {
  // ... existing columns ...
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
});
```

### Updated markAsSincronizada -> renamed to markSubGroupSynced
```typescript
// Replaces markAsSincronizada — does NOT change estado
export async function markSubGroupSynced(subgrupoId: string): Promise<void> {
  await db.update(subgroups)
    .set({ pendingSync: false })
    .where(eq(subgroups.id, subgrupoId));
  notifyDataChanged();
}
```

### Updated checkFinalizationGate
```typescript
export async function checkFinalizationGate(plantacionId: string) {
  const allSubgroups = await db
    .select({ nombre: subgroups.nombre, estado: subgroups.estado, pendingSync: subgroups.pendingSync })
    .from(subgroups)
    .where(eq(subgroups.plantacionId, plantacionId));

  // All must be finalizada with no pending sync
  const blocking = allSubgroups.filter(s => s.estado !== 'finalizada' || s.pendingSync);

  return {
    canFinalize: allSubgroups.length > 0 && blocking.length === 0,
    blocking,
    hasSubgroups: allSubgroups.length > 0,
  };
}
```

### Global sync in PlantacionesScreen header
```typescript
// PlantacionesScreen.tsx
// New header button (alongside existing add + catalog buttons)
<Pressable onPress={handleGlobalSync} style={styles.syncIconButton}>
  <Ionicons name="sync-outline" size={18} color={colors.white} />
  {hasAnyPending && (
    <OrangeDot size={8} style={styles.syncDotOverlay} />
  )}
</Pressable>
```

### OrangeDot absolute overlay (same pattern as photo sync dot in TreeRowItem)
```typescript
// OrangeDot positioned over parent — parent must have position: 'relative'
<View style={styles.iconWrapper}>
  <Ionicons name="sync-outline" size={18} color={colors.white} />
  {hasAnyPending && (
    <View style={styles.dot} />
  )}
</View>
// styles.dot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8,
//   borderRadius: 4, backgroundColor: colors.syncPending }
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `estado = 'sincronizada'` as immutability gate | `pendingSync` flag + plantation estado = 'finalizada' as immutability gate | Simpler state, dot-based feedback, more granular |
| Two buttons Descargar / Subir | One button Sincronizar (pull+push) | Fewer decisions for user |
| `incluirFotos` asked on each sync | Persistent setting via SecureStore | Remembered across sessions |
| Estado chip "Sincronizado" in green | No chip — orange dot = pending, no dot = synced | Cleaner, less visual noise |

**Deprecated/outdated after this phase:**
- `markAsSincronizada` in SubGroupRepository: replaced by `markSubGroupSynced`
- `SubGroupEstado = 'sincronizada'` variant: removed entirely
- `startPull()` in useSync: merged into `startBidirectionalSync()`

---

## Open Questions

1. **What happens to `usePendingSyncCount.syncableCount` display?**
   - What we know: It currently drives the count badge on the "Subir" button
   - What's unclear: After unification, does the Sincronizar button show the syncable count badge or a combined pending count?
   - Recommendation: Show syncable count (subgroups ready to upload) in the badge. It's the most actionable number. Photos are secondary.

2. **Global sync entry point for tecnico role**
   - What we know: D-03 says global sync is in header of PlantacionesScreen for ALL plantations
   - What's unclear: Tecnico users also see PlantacionesScreen — does the global sync button appear for them too?
   - Recommendation: Yes, global sync is role-agnostic. Tecnico syncs their own subgroups across all downloaded plantations.

3. **AdminBottomSheet sync entry for per-plantation sync**
   - What we know: D-03 mentions "boton por plantacion individual en el gear/bottom sheet" but AdminBottomSheet currently has NO Descargar/Subir buttons (they're in PlantationDetailHeader, accessible to all)
   - What's unclear: Is the per-plantation sync button in the gear only for admin, or is PlantationDetailHeader the per-plantation entry for all roles?
   - Recommendation: PlantationDetailHeader's unified "Sincronizar" button serves all roles for per-plantation sync. AdminBottomSheet adds a redundant "Sincronizar" entry for admin convenience (consistent with D-03 wording about gear).

4. **syncAllPlantations progress reporting**
   - What's unclear: The global sync iterates all plantations — how does the modal show progress across multiple plantations?
   - Recommendation: Extend `SyncProgress` to include `plantationName` field. Modal shows "Sincronizando [Lugar]... (2 de 5 plantaciones)".

---

## Environment Availability

Step 2.6: SKIPPED — Phase is purely code/config changes. All required tools (Drizzle, Expo, SecureStore) are already installed and in use.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (configured in project) |
| Config file | mobile/jest.config.js or package.json jest key |
| Quick run command | `cd mobile && npx jest --testPathPattern="SubGroupRepository\|SyncService" --passWithNoTests` |
| Full suite command | `cd mobile && npx jest` |

### Phase Requirements → Test Map

| Area | Behavior | Test Type | Notes |
|------|----------|-----------|-------|
| D-05: pendingSync flag | createSubGroup sets pendingSync=true | unit | SubGroupRepository.test.ts |
| D-05: pendingSync flag | markSubGroupSynced sets pendingSync=false | unit | SubGroupRepository.test.ts |
| D-05: mutation wiring | insertTree marks subgroup pendingSync=true | unit | TreeRepository.test.ts |
| D-07: estado refactor | canEdit respects plantacionEstado not subgrupo estado | unit | SubGroupRepository.test.ts |
| checkFinalizationGate | Blocks when any subgroup has pendingSync=true | unit | adminQueries.test.ts |
| pullFromServer | Upserted subgroups get pendingSync=false | unit | SyncService.test.ts |
| Persistent setting | useSyncSetting reads/writes SecureStore | unit | useSyncSetting.test.ts (new) |

### Wave 0 Gaps

None if existing test files cover the touched functions. New functions (`markSubGroupSynced`, `syncAllPlantations`, `useSyncSetting`) need new test cases — these can be added to existing test files for their respective modules rather than new files.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading of all canonical refs listed in CONTEXT.md — all findings above are based on verified source code, not assumptions
- `mobile/drizzle/migrations.js` and `mobile/drizzle/meta/_journal.json` — migration pattern verified
- `mobile/src/database/schema.ts` — current schema verified (subgroups table has NO pendingSync yet)
- `mobile/src/repositories/SubGroupRepository.ts` — all mutation points verified
- `mobile/src/services/SyncService.ts` — full sync orchestration verified
- `mobile/src/hooks/useSync.ts` — state machine verified
- `mobile/src/theme.ts` — no `syncPending` color exists yet (verified)
- `mobile/src/components/PlantationDetailHeader.tsx` — current two-button layout verified
- `mobile/src/queries/adminQueries.ts` — finalization gate logic verified

### Secondary (MEDIUM confidence)
- SecureStore pattern for persistent setting: inferred from `useProfileData.ts` and `useCurrentUserId.ts` existing patterns (HIGH — verified in project)

---

## Metadata

**Confidence breakdown:**
- Schema migration: HIGH — pattern verified from 9 existing migrations
- Estado refactor scope: HIGH — grepped all 5+ files that reference 'sincronizada'
- Mutation wiring: HIGH — all 10 mutation points identified by reading source
- Persistent setting: HIGH — SecureStore pattern already used 5+ times in project
- Global sync orchestration: HIGH — existing `batchDownload` pattern maps directly
- Orange dot UX: HIGH — mirrors existing photo sync dot in TreeRowItem (absolute overlay pattern)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable stack, no fast-moving dependencies)
