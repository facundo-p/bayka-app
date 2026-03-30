# Phase 4: Admin + Export — Research

**Researched:** 2026-03-19
**Domain:** React Native admin management screens, file export (CSV/Excel), Supabase server mutations, drag-to-reorder
**Confidence:** HIGH — based on direct codebase inspection and verified package versions

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dedicated admin screen replaces `app/(admin)/admin.tsx` placeholder
- Admin tab shows list of plantations with estado chip + action buttons (configure, finalize, export)
- Create form: Lugar + Periodo, simple form with validation
- Plantation created on server immediately (requires connectivity), then synced to local SQLite via `pullFromServer`
- Server-side creation required because plantation_id FK must exist before technicians can sync SubGroups
- Species config sub-screen: checklist from global catalog + drag-to-reorder for `orden_visual`
- Admin can add species at any time (PLAN-04); cannot remove if trees already registered
- Technician assignment sub-screen: toggles from `profiles` where `rol='tecnico'`
- Plantation/user assignments saved to server immediately (connectivity required)
- Finalization gate: ALL SubGroups must be `sincronizada` — clear message if not
- ConfirmModal used for finalization and ID generation confirmation
- Sets plantation `estado = 'finalizada'`, locks SubGroup creation
- ID generation: manual trigger after finalization, seed dialog (suggest max(globalId)+1), local-only operation
- IdPlantacion: sequential 1..N within plantation per tree
- IdGeneral: sequential from seed, global across org
- Both written to `trees.plantacionId` and `trees.globalId` (currently null)
- IDs locked after generation (one-way, confirmation required)
- Export: two separate buttons "Exportar CSV" and "Exportar Excel"
- Available only on finalized plantations with IDs generated
- Columns: ID Global, ID Parcial, Zona (lugar), SubGrupo (nombre), SubID, Periodo, Especie (nombre)
- File delivered via native share sheet (`expo-sharing`)
- Excel: `xlsx` (SheetJS) library
- CSV: native string building (no library)

### Claude's Discretion
- Exact admin tab layout and navigation structure
- Drag-to-reorder implementation library choice
- Form validation details
- Exact share sheet integration approach
- Loading states during server operations

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | Admin can create a plantation with lugar and periodo | Supabase INSERT into `plantations`, pull to local SQLite via `pullFromServer` |
| PLAN-02 | Admin can select species from global catalog for a plantation | `plantation_species` table with `orden_visual`, checklist + drag reorder UI |
| PLAN-03 | Admin can assign technicians to a plantation | `plantation_users` table, profiles query for `rol='tecnico'` |
| PLAN-04 | Admin can add more species to a plantation after creation | Same species config screen, reachable any time while activa |
| PLAN-05 | Admin can define visual order of species buttons | `orden_visual` integer column in `plantation_species`, drag-to-reorder or up/down buttons |
| PLAN-06 | Admin can finalize a plantation (when all SubGroups synced) | Gate check on local SQLite subgroup estados, UPDATE plantation estado server+local |
| IDGN-01 | Admin triggers ID generation after plantation finalization | "Generar IDs" button visible only when `estado='finalizada'` |
| IDGN-02 | Plantation ID assigned sequentially within the plantation | Local SQL: ORDER BY subgrupos, trees within subgrupo, then assign 1..N |
| IDGN-03 | Global Organization ID assigned sequentially across all plantations | Local SQL: seed + sequential offset per tree |
| IDGN-04 | Admin can set initial seed for Global Organization ID | Seed dialog with `max(globalId)+1` suggestion from local DB |
| EXPO-01 | Admin can export finalized plantation to CSV | String building, `expo-file-system` write, `expo-sharing` share sheet |
| EXPO-02 | Admin can export finalized plantation to Excel | `xlsx` (SheetJS) library, `expo-file-system` write, `expo-sharing` share sheet |
| EXPO-03 | Export includes all required columns | Query: JOIN trees → subgroups → species → plantations |
</phase_requirements>

---

## Summary

Phase 4 adds all admin management capabilities on top of the completed Phase 1-3 foundation. The codebase is well-structured with clear separation of queries, repositories, hooks, and screens. All new admin screens will follow the established pattern: queries in `src/queries/`, mutations in `src/repositories/`, reactive UI via `useLiveData`, confirmations via `ConfirmModal` + `useConfirm`.

The main new technical dependencies are `xlsx` (SheetJS) for Excel export and `expo-sharing` for native share sheet delivery. Both are widely used in the React Native ecosystem. The drag-to-reorder requirement for species ordering is the most open design question — the project already has `react-native-gesture-handler` and `react-native-reanimated` installed, which are prerequisites for `react-native-draggable-flatlist`, the standard solution for this pattern. Alternatively, simple up/down buttons avoid the library dependency entirely and are perfectly acceptable for ~20 species.

Server-side mutations (create plantation, assign technicians, finalize) require new Supabase RLS policies — INSERTs on `plantations`, `plantation_species`, and `plantation_users`, and an UPDATE on `plantations.estado`. ID generation and export are entirely local and offline-capable.

**Primary recommendation:** Follow the established code patterns exactly. New queries in `src/queries/adminQueries.ts`, new mutations in `src/repositories/PlantationRepository.ts`, new screens in `src/screens/`. Use simple move-up/down buttons for species reorder (avoids new native library). Use `xlsx` + `expo-sharing` for export as decided.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| expo-router | ~4.0.0 | File-based routing, new admin routes | Already installed |
| drizzle-orm | ^0.45.1 | Local SQLite queries and mutations | All existing patterns use this |
| @supabase/supabase-js | ^2.99.2 | Server mutations (create plantation, assign, finalize) | Already installed |
| expo-file-system | ~18.0.12 | Write CSV/Excel to temp directory before sharing | Already installed |
| react-native-gesture-handler | ~2.20.2 | Drag interactions if drag-to-reorder chosen | Already installed |
| react-native-reanimated | ~3.16.1 | Animation for drag if chosen | Already installed |

### New Dependencies Required
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| xlsx | 0.18.5 | Excel file generation (SheetJS) | Decided in CONTEXT.md; Axlsx.utils.json_to_sheet is the standard approach |
| expo-sharing | 55.0.14 | Native OS share sheet for file delivery | Already in Expo SDK, not yet installed |

**Installation:**
```bash
cd mobile && npm install xlsx expo-sharing
```

**Version verification (confirmed 2026-03-19):**
- `xlsx`: 0.18.5 (verified via `npm view xlsx version`)
- `expo-sharing`: 55.0.14 (verified via `npm view expo-sharing version`)

### Drag-to-Reorder Options (Claude's Discretion)
| Option | Library | Cost | Recommendation |
|--------|---------|------|----------------|
| Move up/down buttons | None | Zero | PREFERRED — simple, no new dep, works for ~20 species |
| Drag-to-reorder | `react-native-draggable-flatlist` | New native dep | Richer UX but adds complexity and native build time |

**Recommendation:** Use move-up/down arrow buttons. Species list is small (~20 items), gesture-based drag is harder to implement correctly and adds `react-native-draggable-flatlist` dependency. Arrow buttons are reliable, accessible, and fast to implement.

---

## Architecture Patterns

### Established Project Structure (follow exactly)
```
mobile/
├── app/(admin)/
│   ├── _layout.tsx          # Existing tab layout — add hidden routes
│   ├── admin.tsx            # REPLACE placeholder → AdminScreen
│   └── plantation/
│       ├── [id].tsx         # Existing shared PlantationDetailScreen
│       ├── configure-species.tsx    # NEW: PLAN-02, PLAN-04, PLAN-05
│       └── assign-technicians.tsx   # NEW: PLAN-03
├── src/
│   ├── queries/
│   │   ├── adminQueries.ts          # NEW: all admin read queries
│   │   └── exportQueries.ts         # NEW: export data query
│   ├── repositories/
│   │   └── PlantationRepository.ts  # NEW: create, finalize, generateIds mutations
│   ├── screens/
│   │   ├── AdminScreen.tsx          # NEW: plantation list + action buttons
│   │   ├── ConfigureSpeciesScreen.tsx  # NEW: species checklist + reorder
│   │   └── AssignTechniciansScreen.tsx # NEW: technician toggle list
│   └── services/
│       └── ExportService.ts         # NEW: CSV and Excel generation + share
└── supabase/migrations/
    └── 003_admin_policies.sql       # NEW: INSERT/UPDATE RLS policies
```

### Pattern 1: Admin Screen as Plantation List with Action Buttons
**What:** Replace `admin.tsx` placeholder. AdminScreen shows all plantations (same data as PlantacionesScreen but admin-specific actions). Each plantation card shows estado chip + "Configurar", "Finalizar", "Generar IDs", "Exportar" buttons based on estado.
**When to use:** Admin tab only
**Pattern:**
```typescript
// src/screens/AdminScreen.tsx
import { useLiveData } from '../database/liveQuery';
import { getPlantationsForAdmin } from '../queries/adminQueries';

// Reuse getPlantationsForRole(true, userId) from dashboardQueries — already returns all plantations
// Add estado-gated action buttons per card
```

### Pattern 2: Server Mutation + pullFromServer sync
**What:** All server writes follow: (1) call Supabase, (2) on success call `pullFromServer` to sync back to local SQLite, (3) call `notifyDataChanged()` for reactive UI.
**When to use:** Create plantation, finalize plantation, save species config, save technician assignment
**Example:**
```typescript
// src/repositories/PlantationRepository.ts
import { supabase } from '../supabase/client';
import { pullFromServer } from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';

export async function createPlantation(lugar: string, periodo: string, organizacionId: string, creadoPor: string) {
  const { data, error } = await supabase
    .from('plantations')
    .insert({ lugar, periodo, organizacion_id: organizacionId, creado_por: creadoPor, estado: 'activa' })
    .select()
    .single();
  if (error) throw error;
  // Sync the new plantation to local SQLite
  await pullFromServer(data.id);
  notifyDataChanged();
  return data;
}
```

### Pattern 3: Finalization Gate Check (local SQLite)
**What:** Before finalizing, query local SQLite to verify ALL subgroups in plantation are `sincronizada`. If any are not, show clear message listing non-synced subgroups.
**Example:**
```typescript
// src/queries/adminQueries.ts
export async function checkFinalizationGate(plantacionId: string) {
  const nonSynced = await db.select()
    .from(subgroups)
    .where(and(
      eq(subgroups.plantacionId, plantacionId),
      ne(subgroups.estado, 'sincronizada')
    ));
  return { canFinalize: nonSynced.length === 0, blocking: nonSynced };
}
```

### Pattern 4: ID Generation (pure local SQLite operation)
**What:** Sequential ID assignment using Drizzle transactions. Sort trees by subgroup orden, then position. Assign plantacionId (1..N) and globalId (seed..seed+N-1).
**Critical:** Must be atomic — use `db.transaction()`. Must order trees consistently (by subgrupo.createdAt, then trees.posicion within subgrupo).
**Example:**
```typescript
// src/repositories/PlantationRepository.ts
export async function generateIds(plantacionId: string, seed: number) {
  // 1. Fetch all trees ordered deterministically
  const treesOrdered = await db.select({ treeId: trees.id })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .where(eq(subgroups.plantacionId, plantacionId))
    .orderBy(asc(subgroups.createdAt), asc(trees.posicion));

  // 2. Assign IDs in transaction
  await db.transaction(async (tx) => {
    for (let i = 0; i < treesOrdered.length; i++) {
      await tx.update(trees)
        .set({ plantacionId: i + 1, globalId: seed + i })
        .where(eq(trees.id, treesOrdered[i].treeId));
    }
  });
  notifyDataChanged();
}
```

### Pattern 5: CSV/Excel Export
**What:** Query all trees with JOINs, generate file in `FileSystem.cacheDirectory`, share via `expo-sharing`.
**CSV:** Pure string building — no library needed.
**Excel:** `xlsx` (SheetJS) — `XLSX.utils.json_to_sheet()` + `XLSX.write()` with `type: 'base64'`.
**Share:** `expo-file-system` to write file, `expo-sharing` to open share sheet.

```typescript
// src/services/ExportService.ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';

export async function exportToCSV(plantacionId: string) {
  const rows = await getExportRows(plantacionId); // from exportQueries.ts
  const header = 'ID Global,ID Parcial,Zona,SubGrupo,SubID,Periodo,Especie\n';
  const body = rows.map(r =>
    `${r.globalId},${r.plantacionId},"${r.lugar}","${r.subgrupoNombre}",${r.subId},"${r.periodo}","${r.especieNombre}"`
  ).join('\n');
  const csv = header + body;
  const path = `${FileSystem.cacheDirectory}plantacion_export.csv`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Exportar CSV' });
}

export async function exportToExcel(plantacionId: string) {
  const rows = await getExportRows(plantacionId);
  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
    'ID Global': r.globalId,
    'ID Parcial': r.plantacionId,
    'Zona': r.lugar,
    'SubGrupo': r.subgrupoNombre,
    'SubID': r.subId,
    'Periodo': r.periodo,
    'Especie': r.especieNombre,
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantacion');
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const path = `${FileSystem.cacheDirectory}plantacion_export.xlsx`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Exportar Excel',
  });
}
```

### Pattern 6: Species Checklist + Move-Up/Down Reorder
**What:** FlatList of all global species. Each row has a checkbox toggle and up/down arrows. State is local array of `{ especieId, ordenVisual, enabled }`. Save sends upsert to `plantation_species` server + local.
**Why not drag:** No new library needed, reliable, fast enough for ~20 items.

### Anti-Patterns to Avoid
- **Inline db in screens:** All queries must stay in `src/queries/`, all mutations in `src/repositories/`. Never write db calls directly in screen components.
- **Skipping server mutations for admin operations:** Create/finalize/assign must go to Supabase immediately — these data must be available to other devices.
- **Running ID generation without confirmation:** IDs are permanent. Always show ConfirmModal before generating.
- **Export before IDs generated:** Check `trees.globalId IS NOT NULL` before offering export buttons.
- **String concatenation without CSV escaping:** Fields containing commas must be quoted. Use `"field"` wrapping for lugar, nombre, periodo.
- **Hardcoding organizacionId:** Read from user profile/session, never hardcode the Bayka org UUID in app code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel file format | Custom XLSX writer | `xlsx` (SheetJS) | Excel format is complex binary; SheetJS is the standard RN solution |
| Native share sheet | Custom share UI | `expo-sharing` | Handles iOS UIActivityViewController and Android Intent correctly |
| File write to device | Direct FS access | `expo-file-system` | Already installed; handles permissions and paths per platform |
| Confirmation dialogs | Custom modal | `ConfirmModal` + `useConfirm` | Already built, tested, consistent UX across app |
| Connectivity check | Custom network check | `@react-native-community/netinfo` | Already installed and used in SyncService |

---

## Common Pitfalls

### Pitfall 1: RLS Policies Missing for Admin Writes
**What goes wrong:** Admin creates plantation or saves species config — Supabase returns 403 forbidden. The current `001_initial_schema.sql` has NO INSERT policy for `plantations`, no INSERT/DELETE for `plantation_species`, no INSERT/DELETE for `plantation_users`, and no UPDATE for `plantations.estado`.
**Why it happens:** Initial schema was read-only for these tables (only technician inserts for subgroups/trees were planned in Phase 1-3).
**How to avoid:** New migration `003_admin_policies.sql` must add:
  - INSERT on `plantations` for admin role
  - INSERT + DELETE on `plantation_species` for admin
  - INSERT + DELETE on `plantation_users` for admin
  - UPDATE on `plantations` for admin (for finalization)
**Warning signs:** HTTP 403 or RLS error from Supabase on any admin mutation.

### Pitfall 2: plantations Not Pulled to Local SQLite After Server Creation
**What goes wrong:** Admin creates plantation on server, but the new plantation doesn't appear in the local list. The existing `pullFromServer(plantacionId)` assumes the plantation already exists locally.
**Why it happens:** `pullFromServer` pulls subgroups/species/users for a given plantation, but doesn't pull the plantation row itself.
**How to avoid:** After inserting into Supabase, upsert the returned plantation row directly into local SQLite `plantations` table. Don't rely on a generic pull for the plantation row itself.
**Code:**
```typescript
await db.insert(plantations).values({
  id: data.id,
  organizacionId: data.organizacion_id,
  lugar: data.lugar,
  periodo: data.periodo,
  estado: data.estado,
  creadoPor: data.creado_por,
  createdAt: data.created_at,
}).onConflictDoUpdate({ target: plantations.id, set: { estado: sql`excluded.estado` } });
```

### Pitfall 3: ID Generation Ordering Must Be Deterministic
**What goes wrong:** Admin generates IDs twice (on different devices) and gets different assignments. IDs don't match expectations.
**Why it happens:** Without a stable sort, tree order is non-deterministic.
**How to avoid:** Always ORDER BY `subgroups.created_at ASC, trees.posicion ASC`. This is stable because both are immutable after sync.
**Warning signs:** IDs that don't match when exported from two devices.

### Pitfall 4: xlsx `write()` Returns Base64, Not Buffer in RN
**What goes wrong:** `XLSX.write(wb, { type: 'buffer' })` fails in React Native because Node.js Buffer is not available.
**Why it happens:** SheetJS Buffer type requires Node.js environment.
**How to avoid:** Always use `type: 'base64'` in React Native. Write with `FileSystem.EncodingType.Base64`.

### Pitfall 5: expo-sharing Requires File to Be in Accessible Location
**What goes wrong:** Share sheet opens but file is empty or fails to attach.
**Why it happens:** `expo-sharing` requires the file to be in `FileSystem.cacheDirectory` or `FileSystem.documentDirectory`, not an arbitrary path.
**How to avoid:** Always write to `FileSystem.cacheDirectory + 'filename'`. Cleanup the file after sharing is optional but good practice.

### Pitfall 6: Finalization Must Update Server AND Local
**What goes wrong:** Admin finalizes plantation locally but technicians' devices still show it as `activa` after next pull.
**Why it happens:** Local-only UPDATE doesn't propagate.
**How to avoid:** Always UPDATE Supabase first, then update local SQLite. This is a two-step mutation.

### Pitfall 7: Species Removal Safety Check
**What goes wrong:** Admin removes a species that already has trees registered, corrupting data integrity.
**Why it happens:** No frontend guard.
**How to avoid:** Before allowing deselection, query `trees` for any tree with that `especieId` in the plantation's subgroups. If count > 0, show disabled state with explanation.

### Pitfall 8: Admin Cannot Create SubGroups After Finalization
**What goes wrong:** Setting `estado='finalizada'` should lock SubGroup creation, but the existing `NuevoSubgrupoScreen` doesn't check plantation estado.
**Why it happens:** Phase 2 was implemented without this gate (plantation finalization didn't exist yet).
**How to avoid:** Add an estado check in `NuevoSubgrupoScreen` — if plantation `estado='finalizada'`, show locked message instead of creation form.

---

## Code Examples

### Export Query (JOIN all required tables)
```typescript
// src/queries/exportQueries.ts
// Source: verified against schema.ts + 001_initial_schema.sql
export async function getExportRows(plantacionId: string) {
  return db.select({
    globalId: trees.globalId,
    plantacionId: trees.plantacionId,
    lugar: plantations.lugar,
    subgrupoNombre: subgroups.nombre,
    subId: trees.subId,
    periodo: plantations.periodo,
    especieNombre: species.nombre,
  })
    .from(trees)
    .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
    .innerJoin(plantations, eq(subgroups.plantacionId, plantations.id))
    .innerJoin(species, eq(trees.especieId, species.id))
    .where(eq(subgroups.plantacionId, plantacionId))
    .orderBy(asc(trees.globalId));
}
```

### Seed Suggestion Query
```typescript
// src/queries/adminQueries.ts
export async function getMaxGlobalId(): Promise<number> {
  const result = await db.select({ maxId: sql<number>`MAX(${trees.globalId})` }).from(trees);
  return (result[0]?.maxId ?? 0);
}
// Suggest: getMaxGlobalId() + 1
```

### Supabase RLS Migration (003_admin_policies.sql)
```sql
-- Admin can insert plantations
create policy "Admin can insert plantations"
  on plantations for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can update plantation estado (finalization)
create policy "Admin can update plantations"
  on plantations for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can manage plantation_species
create policy "Admin can insert plantation_species"
  on plantation_species for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

create policy "Admin can delete plantation_species"
  on plantation_species for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can manage plantation_users
create policy "Admin can insert plantation_users"
  on plantation_users for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

create policy "Admin can delete plantation_users"
  on plantation_users for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );
```

### Species Checklist Save Pattern
```typescript
// Replace all plantation_species for a plantation atomically
export async function saveSpeciesConfig(
  plantacionId: string,
  items: Array<{ especieId: string; ordenVisual: number }>
) {
  // Server: delete existing + insert new
  await supabase.from('plantation_species').delete().eq('plantation_id', plantacionId);
  if (items.length > 0) {
    await supabase.from('plantation_species').insert(
      items.map(item => ({
        plantation_id: plantacionId,
        species_id: item.especieId,
        orden_visual: item.ordenVisual,
      }))
    );
  }
  // Local: sync back
  await pullFromServer(plantacionId); // already handles plantation_species upsert
  notifyDataChanged();
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| SheetJS buffer output | SheetJS base64 output + FileSystem.Base64 | Required for React Native (no Node Buffer) |
| Inline react-native Share | expo-sharing | Unified API across Expo SDK, handles permissions |

**Deprecated/outdated:**
- `react-native-share` (community library): Use `expo-sharing` instead — already in Expo ecosystem, no extra native linking needed.

---

## Open Questions

1. **Species removal safety check scope**
   - What we know: Admin cannot remove species if trees registered with it
   - What's unclear: Does this check happen locally (SQLite) or also needs to verify synced server data?
   - Recommendation: Check locally — all synced trees are already in local SQLite after pullFromServer. Local check is sufficient and fast.

2. **Admin NuevoSubgrupo lockout**
   - What we know: Finalization should lock SubGroup creation
   - What's unclear: Should admin see an explicit "locked" state or just no FAB button?
   - Recommendation: Hide FAB and show estado=finalizada banner. Admin context makes the state clear.

3. **profiles table RLS**
   - What we know: Admin needs to list all technicians from `profiles` where `rol='tecnico'`
   - What's unclear: Current RLS on `profiles` only allows `select own profile`. Admin needs to read all profiles in the org.
   - Recommendation: Add a policy for admin to read all profiles in the same organization. Include in migration 003.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest-expo (jest-expo ~52.0.0) |
| Config file | `mobile/jest.config.js` |
| Quick run command | `cd mobile && npx jest tests/queries/adminQueries.test.ts tests/repositories/PlantationRepository.test.ts tests/services/exportService.test.ts tests/utils/idGenerator.test.ts -x` |
| Full suite command | `cd mobile && npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | createPlantation calls Supabase insert + upserts local row | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "PLAN-01"` | Wave 0 |
| PLAN-02 | saveSpeciesConfig writes to plantation_species | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "PLAN-02"` | Wave 0 |
| PLAN-03 | assignTechnicians writes to plantation_users | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "PLAN-03"` | Wave 0 |
| PLAN-04 | Species can be added after plantation creation | unit | (covered by PLAN-02 test, different plantation state) | Wave 0 |
| PLAN-05 | orden_visual saved correctly from reorder | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "PLAN-05"` | Wave 0 |
| PLAN-06 | checkFinalizationGate returns false when non-sincronizada subgroups exist | unit | `npx jest tests/queries/adminQueries.test.ts -t "PLAN-06"` | Wave 0 |
| IDGN-01 | generateIds only callable after estado=finalizada | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "IDGN-01"` | Wave 0 |
| IDGN-02 | plantacionId assigned sequentially 1..N | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "IDGN-02"` | Wave 0 |
| IDGN-03 | globalId assigned from seed sequentially | unit | `npx jest tests/repositories/PlantationRepository.test.ts -t "IDGN-03"` | Wave 0 |
| IDGN-04 | getMaxGlobalId suggests seed correctly | unit | `npx jest tests/queries/adminQueries.test.ts -t "IDGN-04"` | Wave 0 |
| EXPO-01 | exportToCSV generates correct column output | unit | `npx jest tests/services/exportService.test.ts -t "EXPO-01"` | Wave 0 |
| EXPO-02 | exportToExcel calls xlsx.write with base64 | unit | `npx jest tests/services/exportService.test.ts -t "EXPO-02"` | Wave 0 |
| EXPO-03 | getExportRows returns all required columns | unit | `npx jest tests/queries/exportQueries.test.ts -t "EXPO-03"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mobile && npx jest tests/queries/adminQueries.test.ts tests/repositories/PlantationRepository.test.ts tests/services/exportService.test.ts -x`
- **Per wave merge:** `cd mobile && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/queries/adminQueries.test.ts` — covers PLAN-06, IDGN-04
- [ ] `tests/repositories/PlantationRepository.test.ts` — covers PLAN-01, PLAN-02, PLAN-03, PLAN-05, IDGN-01, IDGN-02, IDGN-03
- [ ] `tests/services/exportService.test.ts` — covers EXPO-01, EXPO-02
- [ ] `tests/queries/exportQueries.test.ts` — covers EXPO-03

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `mobile/src/database/schema.ts` — confirmed column names `plantacionId`, `globalId` (integer, nullable)
- Direct codebase inspection: `supabase/migrations/001_initial_schema.sql` — confirmed missing INSERT policies for plantations/plantation_species/plantation_users
- Direct codebase inspection: `mobile/src/services/SyncService.ts` — confirmed `pullFromServer` pattern for post-mutation sync
- Direct codebase inspection: `mobile/src/components/ConfirmModal.tsx` + `mobile/src/hooks/useConfirm.ts` — confirmed reusable confirmation pattern
- `npm view xlsx version` → 0.18.5 (verified 2026-03-19)
- `npm view expo-sharing version` → 55.0.14 (verified 2026-03-19)
- `mobile/package.json` — confirmed `expo-file-system ~18.0.12` already installed

### Secondary (MEDIUM confidence)
- SheetJS documentation pattern: `type: 'base64'` required for React Native (no Node Buffer) — standard community knowledge, aligns with expo-file-system Base64 encoding API

### Tertiary (LOW confidence)
- None in this research

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry and package.json inspection
- Architecture: HIGH — based on direct reading of all existing screens, queries, repositories, hooks, and migrations
- Pitfalls: HIGH — RLS gap confirmed by reading migration files; SheetJS/export patterns from well-established community practice
- ID generation ordering: MEDIUM — deterministic sort by subgroup.createdAt + trees.posicion is logical but exact behavior should be verified in test

**Research date:** 2026-03-19
**Valid until:** 2026-05-01 (stable stack — expo SDK versions are locked by package.json)
