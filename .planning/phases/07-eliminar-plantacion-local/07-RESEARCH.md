# Phase 6: Eliminar Plantacion Local - Research

**Researched:** 2026-04-05
**Domain:** SQLite local data deletion, unsynced data detection, confirmation UI
**Confidence:** HIGH (all findings based on direct codebase inspection)

---

## Summary

This phase adds the ability for users to remove a plantation from local SQLite storage — NOT from Supabase. The plantation remains on the server; only the local copy (plantation row + all related subgroups, trees, plantation_species, plantation_users, user_species_order) is deleted.

The critical safety requirement is: warn the user before deleting if there is locally-stored data that has NOT yet been uploaded to the server. Unsynced data means subgroups in `estado = 'activa'` or `estado = 'finalizada'` (only `sincronizada` subgroups have been successfully uploaded). If any subgroup in `activa` or `finalizada` state exists for the plantation, deletion must show a stronger warning before proceeding.

All infrastructure for this feature already exists: `deleteSubGroup` in SubGroupRepository demonstrates the delete-trees-then-delete-subgroup pattern; `ConfirmModal` + `useConfirm` + `showDoubleConfirmDialog` / `showConfirmDialog` are the established confirmation UI; `notifyDataChanged()` is the reactive update mechanism; `getLocalPlantationIds()` in catalogQueries already queries local plantation rows.

**Primary recommendation:** Add `deletePlantationLocally` to `PlantationRepository.ts`, add an unsynced-data query to `queries/plantationDetailQueries.ts` or a new `queries/catalogQueries.ts` addition, and surface the delete action from `CatalogScreen` (where downloaded plantations are listed with a "Ya descargada" badge) or from `PlantacionesScreen` via a long-press / action menu on `PlantationCard`.

---

## Project Constraints (from CLAUDE.md)

- **Centralized theme:** All colors, spacing, typography from `src/theme.ts`. Never hardcode.
- **Zero code duplication between roles:** admin and tecnico share the same screen components. Route files in `(admin)/` and `(tecnico)/` are thin wrappers only.
- **Separation of data and presentation:** Screens NEVER call `db` directly. All DB logic lives in `repositories/` (mutations) or `queries/` (reads). Hooks can call those functions.
- **No raw SQL in screens or components.**
- **One-place-change rule:** A style change must require editing only one file.
- **Functions >20 lines must be refactored.**
- **No inline styling.**

---

## Standard Stack

All libraries below are already installed and in use — no new dependencies required.

### Core
| Library | Purpose | Where Used |
|---------|---------|------------|
| `drizzle-orm` + `expo-sqlite` | Local SQLite queries and deletes | All repositories, queries |
| `react-native` `Modal` / `Pressable` | UI primitives | ConfirmModal, screens |
| `@expo/vector-icons` Ionicons | Icons (trash, warning, etc.) | All components |

### Already-present utilities used by this phase
| Utility | Purpose | File |
|---------|---------|------|
| `ConfirmModal` | Reusable modal for confirmations | `src/components/ConfirmModal.tsx` |
| `useConfirm` | Hook that drives ConfirmModal state | `src/hooks/useConfirm.ts` |
| `showConfirmDialog` | Single-step confirm helper | `src/utils/alertHelpers.ts` |
| `showDoubleConfirmDialog` | Two-step (dangerous) confirm | `src/utils/alertHelpers.ts` |
| `notifyDataChanged` | Triggers reactive UI refresh | `src/database/liveQuery.ts` |

---

## Local DB Schema — Complete Picture

### Tables and Relationships

```
plantations (id PK)
  └── subgroups (plantacion_id FK → plantations.id)
        └── trees (subgrupo_id FK → subgroups.id)
  └── plantation_species (plantacion_id FK → plantations.id)
  └── plantation_users (plantation_id FK → plantations.id)
  └── user_species_order (plantacion_id FK → plantations.id)
```

**IMPORTANT:** Drizzle schema uses `references()` for FK declarations but SQLite itself does NOT enforce cascade deletes by default unless `PRAGMA foreign_keys = ON` is set. The existing codebase does NOT rely on cascade — `deleteSubGroup` manually deletes trees first, then the subgroup. The same manual-cascade pattern MUST be used for plantation deletion.

### Deletion order (mandatory to avoid FK constraint errors if foreign_keys pragma is enabled, and correct regardless):

1. `trees` WHERE `subgrupo_id IN (SELECT id FROM subgroups WHERE plantacion_id = ?)`
2. `subgroups` WHERE `plantacion_id = ?`
3. `plantation_species` WHERE `plantacion_id = ?`
4. `plantation_users` WHERE `plantation_id = ?`  ← note: this table uses `plantation_id` (no 'c'), check schema column name
5. `user_species_order` WHERE `plantacion_id = ?`
6. `plantations` WHERE `id = ?`

### Schema column name audit (exact column names from `schema.ts`):

| Table | FK column (Drizzle field name) | SQLite column name |
|-------|-------------------------------|--------------------|
| `subgroups` | `plantacionId` | `plantacion_id` |
| `trees` | `subgrupoId` | `subgrupo_id` |
| `plantation_species` | `plantacionId` | `plantacion_id` |
| `plantation_users` | `plantationId` | `plantation_id` |
| `user_species_order` | `plantacionId` | `plantacion_id` |

All these must be deleted before the `plantations` row.

---

## Sync Status — How to Detect Unsynced Data

### SubGroup estados (source of truth: `SubGroupRepository.ts`)

| Estado | Meaning | Unsynced? |
|--------|---------|-----------|
| `activa` | Still being worked on, not finalized | YES — data never leaves device |
| `finalizada` | Finalized locally, not yet uploaded | YES — ready to sync but not uploaded |
| `sincronizada` | Successfully uploaded to Supabase | NO — server has this data |

### The detection query

To determine whether a plantation has unsynced local data, query:

```typescript
// Count subgroups that are NOT sincronizada (i.e., activa or finalizada)
SELECT count(*) FROM subgroups
WHERE plantacion_id = ? AND estado != 'sincronizada'
```

If count > 0: show the stronger "you have unsynced data" warning.
If count = 0: all local work has been uploaded; safe delete with simple confirmation.

A breakdown is more informative for the user message:

```typescript
// Count activa subgroups (still in progress — trees may not be final)
SELECT count(*) FROM subgroups WHERE plantacion_id = ? AND estado = 'activa'

// Count finalizada subgroups (ready to sync but not yet uploaded)
SELECT count(*) FROM subgroups WHERE plantacion_id = ? AND estado = 'finalizada'
```

These two queries are small and fast. Combine into a single query using conditional aggregation or run as two separate queries.

### Existing helper to reference

`plantationDetailQueries.ts` already has `getUnsyncedTreesForUser` which counts trees in non-sincronizada subgroups. However, for the plantation-delete warning we want subgroup counts (not tree counts), and not filtered by user — ALL subgroups in the plantation matter regardless of who created them.

---

## Architecture Patterns

### Where to put new code

Following CLAUDE.md's separation rules:

| What | Where | Why |
|------|-------|-----|
| `getUnsyncedSubgroupSummary(plantacionId)` | `src/queries/plantationDetailQueries.ts` OR a new export in `src/queries/catalogQueries.ts` | Read-only query, no mutation |
| `deletePlantationLocally(plantacionId)` | `src/repositories/PlantationRepository.ts` | Mutation (deletes) |
| UI for triggering delete | `src/screens/CatalogScreen.tsx` (preferred) or `src/screens/PlantacionesScreen.tsx` | Shared screen, role-agnostic |

### Recommended project structure additions

```
src/
  repositories/
    PlantationRepository.ts     ← ADD: deletePlantationLocally()
  queries/
    catalogQueries.ts           ← ADD: getUnsyncedSubgroupSummary()
    (or plantationDetailQueries.ts)
  screens/
    CatalogScreen.tsx           ← ADD: delete action on downloaded cards
    (PlantacionesScreen.tsx)    ← ALTERNATIVE or ADDITIONAL entry point
```

### Pattern 1: Repository delete with manual cascade

```typescript
// Source: src/repositories/SubGroupRepository.ts (deleteSubGroup pattern)
export async function deletePlantationLocally(plantacionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Delete trees (leaf nodes)
    await tx.delete(trees).where(
      sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`
    );
    // 2. Delete subgroups
    await tx.delete(subgroups).where(eq(subgroups.plantacionId, plantacionId));
    // 3. Delete plantation_species
    await tx.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));
    // 4. Delete plantation_users
    await tx.delete(plantationUsers).where(eq(plantationUsers.plantationId, plantacionId));
    // 5. Delete user_species_order
    await tx.delete(userSpeciesOrder).where(eq(userSpeciesOrder.plantacionId, plantacionId));
    // 6. Delete plantation row
    await tx.delete(plantations).where(eq(plantations.id, plantacionId));
  });
  notifyDataChanged();
}
```

Use `db.transaction()` so the delete is atomic — partial deletes do not occur on failure.

### Pattern 2: Unsynced data detection query

```typescript
// Source: pattern from plantationDetailQueries.ts
export async function getUnsyncedSubgroupSummary(plantacionId: string): Promise<{
  activaCount: number;
  finalizadaCount: number;
}> {
  const rows = await db
    .select({
      estado: subgroups.estado,
      cnt: count(),
    })
    .from(subgroups)
    .where(
      and(
        eq(subgroups.plantacionId, plantacionId),
        sql`${subgroups.estado} != 'sincronizada'`
      )
    )
    .groupBy(subgroups.estado);

  const activaCount = rows.find((r) => r.estado === 'activa')?.cnt ?? 0;
  const finalizadaCount = rows.find((r) => r.estado === 'finalizada')?.cnt ?? 0;
  return { activaCount, finalizadaCount };
}
```

### Pattern 3: Confirmation dialog — two paths

**Path A — No unsynced data (all sincronizada or no subgroups):**
Use `showConfirmDialog` (single step):
```
Title: "Eliminar del dispositivo"
Message: "La plantacion '[lugar]' sera eliminada de tu celular.
          Podras volver a descargarla desde el catalogo."
Confirm: "Eliminar" (danger style)
```

**Path B — Has unsynced data (activa or finalizada subgroups):**
Use `showDoubleConfirmDialog` (two steps):
```
Step 1:
  Title: "Atencion: datos sin sincronizar"
  Message: "Esta plantacion tiene X subgrupo(s) sin subir al servidor.
            Si eliminas ahora, esos datos se perderan permanentemente.
            Se recomienda sincronizar primero."
  Confirm label: "Eliminar de todas formas" (danger style)

Step 2:
  Title: "Estas seguro?"
  Message: "Los datos sin sincronizar se perderan para siempre.
            Esta accion no se puede deshacer."
  Confirm: "Si, eliminar" (danger style, trash icon)
```

### Pattern 4: Where to trigger the delete action

**Option A (Recommended): CatalogScreen — swipe/long-press on "Ya descargada" cards**

`CatalogScreen.tsx` already shows all server plantations and marks downloaded ones with `isDownloaded`. Currently those cards are `disabled={isDownloaded}` (no toggle). The delete action can be added as:
- A long-press handler on `CatalogPlantationCard` when `isDownloaded`
- OR a delete icon button visible only when `isDownloaded`

After deletion, `localIds` state in `CatalogScreen` must be refreshed (same pattern as `handleDismiss` which calls `getLocalPlantationIds().then(ids => setLocalIds(ids))`).

**Option B: PlantacionesScreen — long-press on PlantationCard**

`PlantacionesScreen.tsx` shows the local plantation list. A long-press on a `PlantationCard` could open an action dialog with a "Eliminar del dispositivo" option. This requires adding `onLongPress` to `PlantationCard` component.

**Decision guidance for planner:** Option A (CatalogScreen) is cleaner because:
1. The catalog is the natural place for download/remove actions
2. After removal, the card reverts to "not downloaded" state — consistent mental model
3. No navigation back required; the screen refreshes in place

### Anti-Patterns to Avoid

- **DO NOT call `db` directly from CatalogScreen or PlantationCard.** Always go through the repository function.
- **DO NOT delete without the transaction wrapper.** A partial delete (e.g., trees deleted but plantation row remains) would leave orphaned data invisible to the UI but consuming storage.
- **DO NOT skip the unsynced data check.** Even if `activaCount + finalizadaCount === 0`, still show a simple confirmation — never delete silently.
- **DO NOT navigate away automatically after delete.** Let `notifyDataChanged()` + state refresh handle the UI update reactively.
- **DO NOT add `onDelete` prop to PlantationCard if only catalog uses it** — keep the card component focused on display.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Confirmation dialog | Custom Modal | `ConfirmModal` + `useConfirm` + `showConfirmDialog` / `showDoubleConfirmDialog` |
| Reactive UI update after delete | Manual state management | `notifyDataChanged()` — already wires all `useLiveData` hooks |
| Cascaded delete ordering | Custom recursive delete | `db.transaction()` with explicit ordered deletes (same as `deleteSubGroup`) |
| Unsynced detection | Complex join | Simple GROUP BY query on `subgroups.estado` |

---

## Common Pitfalls

### Pitfall 1: Forgetting `user_species_order` table
**What goes wrong:** Delete fails silently or leaves orphaned rows because `user_species_order` has a FK to `plantations`.
**Why it happens:** The table is only written by `UserSpeciesOrderRepository` and is easy to miss in the cascade.
**How to avoid:** Explicitly delete `user_species_order WHERE plantacion_id = ?` before deleting the plantation row.

### Pitfall 2: Not using db.transaction()
**What goes wrong:** App crashes mid-delete (e.g., out of memory, navigation interrupt) leaves the database in an inconsistent state — some tables deleted, others not.
**How to avoid:** Wrap all 6 deletes in `db.transaction()`. This is the same approach used everywhere else for multi-step writes.

### Pitfall 3: localIds state not refreshed in CatalogScreen
**What goes wrong:** After delete, the card still shows "Ya descargada" because `localIds` state wasn't refreshed.
**Why it happens:** `localIds` is fetched once on load; deletion happens later.
**How to avoid:** After successful deletion, call `getLocalPlantationIds().then(ids => setLocalIds(ids))`. This exact pattern already exists in `handleDismiss` in `CatalogScreen`.

### Pitfall 4: Checking only the current user's unsynced data
**What goes wrong:** Plantation is deleted even though another technician's subgroups (activa/finalizada) exist locally but were created by a different user.
**Why it happens:** Some existing queries filter by `usuarioCreador = userId`. The deletion warning must count ALL non-sincronizada subgroups regardless of creator.
**How to avoid:** The `getUnsyncedSubgroupSummary` query must NOT filter by `usuarioCreador`.

### Pitfall 5: Stale router state after plantation deleted
**What goes wrong:** If the user is currently viewing `PlantationDetailScreen` for the plantation being deleted, and delete is triggered from CatalogScreen (opened in same session), the detail screen may crash trying to query a now-deleted plantation.
**Why it happens:** `useLiveData` queries will return empty arrays (not crash) but the screen may look blank.
**How to avoid:** The delete action should only be accessible from CatalogScreen (not from PlantationDetailScreen). After deletion, if user navigates back to detail, the empty state handles it gracefully. Consider adding a guard in PlantationDetailScreen that redirects if plantation no longer exists.

### Pitfall 6: Deleting a plantation that has no local data
**What goes wrong:** `deletePlantationLocally` is called for a plantation ID that doesn't exist locally (e.g., called twice, or catalog state is stale).
**How to avoid:** The DELETE queries are idempotent — deleting 0 rows is not an error. No special guard needed.

---

## Code Examples

### Unsynced subgroup summary (verified pattern)

```typescript
// File: src/queries/catalogQueries.ts (or plantationDetailQueries.ts)
// Source: pattern from existing queries in plantationDetailQueries.ts
import { db } from '../database/client';
import { subgroups } from '../database/schema';
import { eq, count, and, sql } from 'drizzle-orm';

export async function getUnsyncedSubgroupSummary(plantacionId: string): Promise<{
  activaCount: number;
  finalizadaCount: number;
}> {
  const rows = await db
    .select({ estado: subgroups.estado, cnt: count() })
    .from(subgroups)
    .where(
      and(
        eq(subgroups.plantacionId, plantacionId),
        sql`${subgroups.estado} != 'sincronizada'`
      )
    )
    .groupBy(subgroups.estado);

  return {
    activaCount: rows.find((r) => r.estado === 'activa')?.cnt ?? 0,
    finalizadaCount: rows.find((r) => r.estado === 'finalizada')?.cnt ?? 0,
  };
}
```

### Plantation local delete (verified pattern)

```typescript
// File: src/repositories/PlantationRepository.ts
// Source: deleteSubGroup pattern in SubGroupRepository.ts + all imported tables from schema
import { db } from '../database/client';
import {
  plantations, subgroups, trees,
  plantationSpecies, plantationUsers, userSpeciesOrder,
} from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';

export async function deletePlantationLocally(plantacionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(trees).where(
      sql`${trees.subgrupoId} IN (SELECT id FROM subgroups WHERE plantacion_id = ${plantacionId})`
    );
    await tx.delete(subgroups).where(eq(subgroups.plantacionId, plantacionId));
    await tx.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));
    await tx.delete(plantationUsers).where(eq(plantationUsers.plantationId, plantacionId));
    await tx.delete(userSpeciesOrder).where(eq(userSpeciesOrder.plantacionId, plantacionId));
    await tx.delete(plantations).where(eq(plantations.id, plantacionId));
  });
  notifyDataChanged();
}
```

### Confirmation flow in screen (verified pattern)

```typescript
// Source: PlantationDetailScreen.tsx handleDeleteSubGroup pattern
async function handleDeletePlantation(plantation: { id: string; lugar: string }) {
  const { activaCount, finalizadaCount } = await getUnsyncedSubgroupSummary(plantation.id);
  const hasUnsynced = activaCount + finalizadaCount > 0;

  if (hasUnsynced) {
    // Two-step warning
    showDoubleConfirmDialog(
      confirm.show,
      'Atencion: datos sin sincronizar',
      `Esta plantacion tiene subgrupos sin subir al servidor (${activaCount} activo${activaCount !== 1 ? 's' : ''}, ${finalizadaCount} finalizado${finalizadaCount !== 1 ? 's' : ''}). Si eliminas ahora, esos datos se perderan permanentemente.`,
      'Eliminar de todas formas',
      'Los datos sin sincronizar se perderan para siempre. Esta accion no se puede deshacer.',
      async () => {
        await deletePlantationLocally(plantation.id);
        // Refresh localIds in CatalogScreen state
        getLocalPlantationIds().then(ids => setLocalIds(ids));
      },
    );
  } else {
    showConfirmDialog(
      confirm.show,
      'Eliminar del dispositivo',
      `La plantacion "${plantation.lugar}" sera eliminada de tu celular. Podras volver a descargarla desde el catalogo.`,
      'Eliminar',
      async () => {
        await deletePlantationLocally(plantation.id);
        getLocalPlantationIds().then(ids => setLocalIds(ids));
      },
      { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' },
    );
  }
}
```

### CatalogPlantationCard — delete icon on downloaded cards

```typescript
// In CatalogPlantationCard.tsx, add optional onDelete prop:
interface Props {
  item: ServerPlantation;
  isDownloaded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;  // NEW
}

// In the card JSX, replace the static downloadedBadge with:
{isDownloaded && (
  <Pressable onPress={() => onDelete?.(item.id)} hitSlop={8}>
    <Ionicons name="trash-outline" size={18} color={colors.danger} />
  </Pressable>
)}
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely local SQLite code changes with no external dependencies beyond the project's existing stack.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (jest-expo preset) |
| Config file | `/Users/facu/.../mobile/jest.config.js` |
| Quick run command | `npx jest tests/repositories/PlantationRepository.test.ts -t "deletePlantationLocally" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `deletePlantationLocally` deletes all 6 tables in order | unit | `npx jest tests/repositories/PlantationRepository.test.ts -x` | No — Wave 0 |
| `getUnsyncedSubgroupSummary` returns correct counts | unit | `npx jest tests/queries/catalogQueries.test.ts -x` | Partial — file exists but function not yet there |
| Safe delete (all sincronizada) shows single confirm | unit | `npx jest tests/repositories/PlantationRepository.test.ts -x` | No — Wave 0 |
| Unsynced delete shows double confirm | unit | manual / component test | No |

### Wave 0 Gaps

- `tests/repositories/PlantationRepository.test.ts` — covers `deletePlantationLocally` (transactions, all 6 tables deleted)
- `getUnsyncedSubgroupSummary` needs to be added to existing `tests/queries/catalogQueries.test.ts`

Existing test infrastructure (jest-expo, mocks for `db`, `supabase`, `notifyDataChanged`) is already in place — the pattern from `tests/sync/downloadService.test.ts` applies directly.

---

## Open Questions

1. **Entry point: CatalogScreen only, or also PlantacionesScreen?**
   - What we know: CatalogScreen is the natural "manage downloads" surface. PlantacionesScreen is the working view.
   - What's unclear: Whether technicians need to delete from PlantacionesScreen (e.g., when offline and catalog is unavailable).
   - Recommendation: Implement in CatalogScreen first. PlantacionesScreen can be added later as a long-press action if users request it.

2. **Role restriction: can technicians delete, or only admins?**
   - What we know: Both roles use the same CatalogScreen component. Downloads work for both.
   - What's unclear: Whether there's a business rule restricting deletion to admins only.
   - Recommendation: Allow both roles to delete their own downloads. The plantation stays on the server regardless.

3. **What happens to photos stored locally?**
   - What we know: Trees have a `fotoUrl` field. Photos appear to be stored as URLs (server-side storage), not as local files — `fotoUrl` is a string field, and `PhotoService.ts` exists.
   - What's unclear: Whether any photos are cached locally on disk (beyond SQLite).
   - Recommendation: Check `PhotoService.ts` before finalizing. If photos are just URLs pointing to Supabase Storage, no file cleanup is needed. If local file copies exist, they should be cleaned up too.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `src/database/schema.ts` — table definitions, FK relationships
- Direct inspection of `src/repositories/SubGroupRepository.ts` — `deleteSubGroup` pattern (deleteSubGroup + trees delete before subgroup delete)
- Direct inspection of `src/repositories/PlantationRepository.ts` — mutation patterns, `db.transaction()` usage
- Direct inspection of `src/services/SyncService.ts` — sync state lifecycle, `markAsSincronizada`
- Direct inspection of `src/queries/plantationDetailQueries.ts` — existing unsynced query patterns
- Direct inspection of `src/components/ConfirmModal.tsx` + `src/utils/alertHelpers.ts` — confirmation UI API
- Direct inspection of `src/screens/CatalogScreen.tsx` — downloaded state management, `localIds` pattern
- Direct inspection of `src/screens/PlantacionesScreen.tsx` — `PlantationCard` integration
- Direct inspection of `src/hooks/useConfirm.ts` — confirm hook API

### Secondary (MEDIUM confidence)
- `jest.config.js` and `tests/sync/downloadService.test.ts` — test framework verification

---

## Metadata

**Confidence breakdown:**
- Schema / delete order: HIGH — read directly from schema.ts
- Sync status detection: HIGH — read from SubGroupRepository.ts state machine
- UI patterns: HIGH — ConfirmModal, useConfirm, alertHelpers inspected
- Entry point recommendation: MEDIUM — architectural judgment, pending product decision

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (schema and patterns are stable; UI may evolve)
