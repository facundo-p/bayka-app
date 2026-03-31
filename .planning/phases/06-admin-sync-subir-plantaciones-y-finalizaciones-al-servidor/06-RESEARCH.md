# Phase 06: Admin Sync - Descubrimiento y Descarga de Plantaciones - Research

**Researched:** 2026-03-31
**Domain:** React Native / Expo Router navigation, Supabase direct query, offline-first download flow, modal UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dedicated catalog screen showing all server plantations available to the user
- **D-02:** Access via the existing connectivity icon in the PlantacionesScreen header — icon becomes tappable when online (opens catalog), disabled/grayed when offline
- **D-03:** Each plantation in the catalog shows: lugar, periodo, estado, cantidad de arboles, cantidad de subgrupos, and an indicator if already downloaded locally
- **D-04:** Checkboxes on each plantation + "Descargar seleccion" button for batch download
- **D-05:** Plantations already downloaded locally are shown but NOT selectable (visually distinct, e.g., grayed or with a checkmark badge)
- **D-06:** No re-download/update mechanism from catalog — updating existing plantations happens via the existing sync/pull flow in PlantacionesScreen
- **D-07:** Download includes full data: plantation row + plantation_species + plantation_users + all sincronizada subgroups + all trees. User has everything available offline immediately after download.
- **D-08:** Modal with progress bar during download (consistent with existing sync modal pattern). Blocking — user cannot navigate while downloading.
- **D-09:** Progress shows "Descargando plantacion X/N..." with plantation name
- **D-10:** Tecnico sees ONLY plantations they are assigned to (via plantation_users on server). Admin sees ALL plantations for their organization. Consistent with current dashboard role-gating.
- **D-11:** Admin creating a plantation continues to auto-insert into local SQLite (current behavior preserved). Catalog is for downloading plantations created on OTHER devices or for new device setup.

### Claude's Discretion

- Exact catalog screen layout and visual design
- How to query Supabase for the catalog list (direct table query vs RPC)
- How to determine "already downloaded" (local SQLite lookup by plantation ID)
- Exact progress modal implementation (reuse existing SyncProgressModal or new component)
- Error handling if download fails mid-batch (per-plantation retry or skip)
- Whether to pull trees via subgroup IDs or plantation ID

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase adds a plantation catalog screen that lets users discover and download server plantations to their device. The core building blocks already exist: `pullFromServer()` downloads subgroups/trees/species/users; `PlantationRepository.createPlantation()` shows the exact upsert pattern for the plantation row; `SyncProgressModal` provides the blocking modal with progress pattern; `useNetStatus` gates online functionality. The phase wires these together in a new screen.

The single most critical insight is that `pullFromServer()` does NOT download the plantation row itself (documented in PlantationRepository as Pitfall 2). The new download function must first upsert the plantation row, then call `pullFromServer(plantacionId)` — exactly the same two-step sequence used in `createPlantation()`.

The RLS situation is clean: `plantations` already has `using (true)` for all authenticated users (migration 001). For tecnico role-filtering, the server-side query must JOIN `plantation_users` to return only assigned plantations, while admin queries all plantations for their organization.

**Primary recommendation:** Build a `downloadPlantation(plantacionId)` function in `SyncService.ts` that upserts the plantation row + calls `pullFromServer()`, then create a `CatalogScreen.tsx` that queries Supabase directly and drives a new `DownloadProgressModal`. The existing `SyncProgressModal` is sync-specific in its language and result types — a dedicated download modal is cleaner and reuses only the structural pattern.

---

## Project Constraints (from CLAUDE.md)

| Directive | Enforcement |
|-----------|-------------|
| No queries/db calls in screens or components | All Supabase catalog queries go in `queries/catalogQueries.ts`; all download mutations go in `services/SyncService.ts` or new `services/DownloadService.ts` |
| All colors/styles from `src/theme.ts` | CatalogScreen and new modal must import from theme exclusively |
| Zero code duplication between admin/tecnico | Both roles share one `CatalogScreen.tsx` component parameterized by `isAdmin` |
| One-place-change rule | Role gating logic in `catalogQueries.ts`, not duplicated in screen |
| Hooks as bridge, not logic | Hook calls `catalogQueries` functions, no raw Supabase in hooks |
| No inline styling | `StyleSheet.create()` with theme tokens only |
| Components small and reusable | Separate `CatalogPlantationCard.tsx` for list items |

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | already installed | Direct Supabase table queries for catalog | Already used throughout; `from('plantations').select()` sufficient |
| `expo-router` | already installed | Screen routing and navigation | All navigation uses Expo Router |
| `drizzle-orm` | already installed | Local SQLite upsert for plantation row download | Already used in PlantationRepository upsert pattern |
| React Native `Modal` | built-in | Blocking download progress overlay | Already used in SyncProgressModal pattern |

### No New Dependencies

This phase requires zero new npm packages. All patterns (Supabase queries, Modal, FlatList, Checkbox via Pressable, progress text) are already present in the codebase.

**Checkbox implementation:** Use `Pressable` with a visual indicator (border + checkmark icon from `Ionicons`) — the project does not install `@react-native-community/checkbox` or similar. This matches the existing pattern of segmented controls as two Pressables.

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
mobile/
├── src/
│   ├── screens/
│   │   └── CatalogScreen.tsx              # New: plantation catalog (shared admin/tecnico)
│   ├── components/
│   │   ├── CatalogPlantationCard.tsx      # New: single selectable catalog row
│   │   └── DownloadProgressModal.tsx      # New: blocking modal for batch download
│   ├── queries/
│   │   └── catalogQueries.ts              # New: Supabase queries for catalog list
│   └── services/
│       └── SyncService.ts                 # Modified: add downloadPlantation()
├── app/
│   ├── (admin)/
│   │   └── plantation/catalog.tsx         # New: Expo Router entry (wrapper only)
│   └── (tecnico)/
│       └── plantation/catalog.tsx         # New: Expo Router entry (wrapper only)
```

The two `catalog.tsx` route files are wrappers that import `CatalogScreen` — consistent with how both roles share `PlantacionesScreen`, `PlantationDetailScreen`, etc.

### Pattern 1: Download Plantation (extends existing SyncService pattern)

**What:** New `downloadPlantation(plantacionId)` function added to `SyncService.ts`. It upserts the plantation row first (copying the pattern from `createPlantation`), then calls `pullFromServer()` for the rest.

**When to use:** Called per-plantation during batch download in `CatalogScreen`.

```typescript
// In mobile/src/services/SyncService.ts

export async function downloadPlantation(
  serverPlantation: {
    id: string;
    organizacion_id: string;
    lugar: string;
    periodo: string;
    estado: string;
    creado_por: string;
    created_at: string;
  }
): Promise<void> {
  // Step 1: Upsert plantation row — pullFromServer does NOT do this (Pitfall from Phase 04)
  await db
    .insert(plantations)
    .values({
      id: serverPlantation.id,
      organizacionId: serverPlantation.organizacion_id,
      lugar: serverPlantation.lugar,
      periodo: serverPlantation.periodo,
      estado: serverPlantation.estado,
      creadoPor: serverPlantation.creado_por,
      createdAt: serverPlantation.created_at,
    })
    .onConflictDoUpdate({
      target: plantations.id,
      set: { estado: sql`excluded.estado` },
    });

  // Step 2: Pull subgroups, trees, species, users
  await pullFromServer(serverPlantation.id);
}
```

### Pattern 2: Catalog Queries (server-side role-gated)

**What:** Functions in `catalogQueries.ts` that query Supabase for the catalog list. Returns server plantations plus counts. Role-gating happens via JOIN to `plantation_users` on the server side (mirroring the existing local `getPlantationsForRole` pattern).

**When to use:** Called from `CatalogScreen` on mount (online only).

```typescript
// In mobile/src/queries/catalogQueries.ts

export type ServerPlantation = {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
  subgroup_count: number;
  tree_count: number;
};

/**
 * Returns all server plantations for the catalog.
 * Admin: all plantations in the org.
 * Tecnico: only assigned plantations (via plantation_users).
 *
 * Note: counts come from a separate query or Supabase aggregation.
 * Direct table select is preferred over RPC (simpler, no migration needed).
 */
export async function getServerCatalog(
  isAdmin: boolean,
  userId: string,
  organizacionId: string
): Promise<ServerPlantation[]> {
  if (isAdmin) {
    const { data, error } = await supabase
      .from('plantations')
      .select('*')
      .eq('organizacion_id', organizacionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(p => ({ ...p, subgroup_count: 0, tree_count: 0 }));
  }

  // Tecnico: only assigned plantations
  const { data: pu, error: puError } = await supabase
    .from('plantation_users')
    .select('plantation_id')
    .eq('user_id', userId);
  if (puError) throw puError;

  const ids = (pu ?? []).map(r => r.plantation_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('plantations')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(p => ({ ...p, subgroup_count: 0, tree_count: 0 }));
}

/**
 * Returns set of plantation IDs already in local SQLite.
 * Used to determine which catalog entries are "already downloaded".
 */
export async function getLocalPlantationIds(): Promise<Set<string>> {
  const rows = await db.select({ id: plantations.id }).from(plantations);
  return new Set(rows.map(r => r.id));
}
```

### Pattern 3: Catalog Screen (shared component, role-parameterized)

**What:** `CatalogScreen.tsx` receives `isAdmin` + reads `userId` and `organizacionId` via existing hooks. Queries the server catalog on mount, computes locally-downloaded set, renders a checkable list.

**When to use:** Opened from both admin and tecnico `PlantacionesScreen` via the connectivity icon tap.

Key behaviors:
- On mount: `await getServerCatalog(isAdmin, userId, organizacionId)` + `await getLocalPlantationIds()` → identify downloadable vs. already-downloaded
- Checkbox state: local `Set<string>` of selected IDs, only downloadable plantations selectable
- "Descargar seleccion" button: disabled until at least 1 selected; triggers `handleBatchDownload`
- `handleBatchDownload`: sets `downloading=true`, shows `DownloadProgressModal`, iterates selected IDs calling `downloadPlantation()`, calls `notifyDataChanged()` once at end

### Pattern 4: Navigation — Tappable Connectivity Icon

**What:** `PlantacionesScreen` header connectivity icon becomes a `Pressable` wrapping the existing `Ionicons`. When `isOnline`, pressing navigates to `/(admin)/plantation/catalog` or `/(tecnico)/plantation/catalog`. When offline, does nothing (or shows toast — Claude's discretion).

```typescript
// In PlantacionesScreen rightElement:
<Pressable
  onPress={() => isOnline ? router.push(`/${routePrefix}/plantation/catalog` as any) : undefined}
  disabled={!isOnline}
>
  <Ionicons
    name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
    size={20}
    color={isOnline ? colors.online : colors.offline}
  />
</Pressable>
```

### Pattern 5: DownloadProgressModal (adapted from SyncProgressModal)

**What:** A new blocking modal dedicated to batch download. Uses same structural pattern as `SyncProgressModal` (Modal + overlay + progress text + ActivityIndicator during in-progress + result summary on done). Different states: `idle | downloading | done`. Progress message: "Descargando plantacion X/N... (nombre)".

**Why not reuse SyncProgressModal:** Its props and display logic are tightly coupled to `SyncSubGroupResult[]` arrays, sync vs. pull states, and error codes. A dedicated `DownloadProgressModal` with simpler props (`total`, `completed`, `currentName`, `errors`) is cleaner and avoids contorting the existing modal.

### Anti-Patterns to Avoid

- **Calling `supabase.from()` inside `CatalogScreen.tsx`:** All Supabase access goes in `catalogQueries.ts`. Screen imports query functions only.
- **Calling `supabase.from()` inside `DownloadProgressModal`:** Modal is pure presentational.
- **Skipping the plantation row upsert:** `pullFromServer()` fetches subgroups/trees/species/users but NOT the plantation row. Must upsert plantation row first (Phase 04 pitfall — documented in PlantationRepository comment).
- **Putting download loop logic in a hook:** Hook calls `downloadPlantation()` from SyncService; orchestration loop stays in the service layer or screen handler (as `syncPlantation` does in SyncService).
- **Hardcoding `organizacionId`:** Fetch from Supabase profiles table per existing pattern (Phase 04 decision: no local copy of org ID, fetch per screen).
- **Navigating to catalog when offline:** Connectivity icon tap must be guarded by `isOnline` check.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checkbox UI | Custom checkbox component | `Pressable` + `Ionicons checkmark-circle` | Project pattern — no external checkbox lib installed |
| Progress overlay | Custom Modal from scratch | Clone `SyncProgressModal` structure | Modal + overlay + ActivityIndicator pattern already tested |
| Server plantation query | Supabase RPC | Direct `supabase.from('plantations').select('*')` | RLS already allows read for all authenticated users; no RPC migration needed |
| "Already downloaded" check | Complex freshness comparison | Simple `db.select({ id }).from(plantations)` → Set lookup | Local SQLite plantation IDs are the source of truth for "downloaded" |
| Role-gating in screen | Duplicated `if (isAdmin)` blocks in screen | Single `getServerCatalog(isAdmin, userId, orgId)` in `catalogQueries.ts` | One-place-change rule |

**Key insight:** The entire download flow composes existing primitives. No novel infrastructure needed — only orchestration.

---

## Common Pitfalls

### Pitfall 1: Forgetting to upsert the plantation row before pullFromServer

**What goes wrong:** Calling `pullFromServer(plantacionId)` for a new plantation creates subgroups/trees/species/users but the plantation row doesn't exist in local SQLite. Foreign key constraints on subgroups (`plantacion_id references plantations.id`) cause the upsert to fail silently or throw a constraint violation.

**Why it happens:** `pullFromServer()` was designed to update data for plantations already on device. It never upserts the plantation row itself. This is explicitly documented as Pitfall 2 in `PlantationRepository.ts`.

**How to avoid:** Always upsert the plantation row (using the data returned from the catalog query) BEFORE calling `pullFromServer()`. This is the exact sequence in `createPlantation()` — use it as the template.

**Warning signs:** Subgroups disappear after download; FK violation errors in console; plantation doesn't appear in local list after download.

### Pitfall 2: orgId not available locally — must fetch from Supabase profiles

**What goes wrong:** Catalog query for admin needs `organizacion_id` filter. If developer assumes `organizacionId` is cached locally, the query returns nothing or all plantations across all orgs.

**Why it happens:** Phase 04 decision: organization ID is NOT stored in local SQLite or SecureStore. It must be fetched from `supabase.from('profiles').select('organizacion_id').eq('id', userId).single()` per screen.

**How to avoid:** Use the existing `useProfileData` hook (returns `profile.organizacionId`) or fetch directly from Supabase profiles at screen mount.

**Warning signs:** Admin catalog returns 0 plantations even when server has plantations; or returns plantations from other orgs.

### Pitfall 3: Tecnico sees all plantations instead of only assigned ones

**What goes wrong:** Querying `supabase.from('plantations').select('*')` without filtering by `plantation_users` returns all plantations (RLS policy `using (true)` allows all authenticated reads).

**Why it happens:** The server RLS does not restrict plantation reads by assignment. Role-gating is the application's responsibility, not the DB's. This mirrors the local pattern in `getPlantationsForRole` which JOINs `plantation_users` for tecnico.

**How to avoid:** For tecnico, first fetch `plantation_users` where `user_id = auth.uid()`, extract plantation IDs, then query `plantations.in('id', ids)`. See `getPlantationsForRole` in `dashboardQueries.ts` for the local equivalent.

**Warning signs:** Tecnico user sees plantations from other teams; security concern if plantations contain sensitive data.

### Pitfall 4: Download silently fails mid-batch leaving partial data

**What goes wrong:** If one plantation download fails (network error during trees fetch), the batch continues but the failed plantation is partially inserted (plantation row exists locally, subgroups/trees may be missing). The user doesn't know which plantation is incomplete.

**Why it happens:** `try/catch` around individual downloads in the loop catches errors but the partial plantation row is already committed to SQLite.

**How to avoid:** Per-plantation: either wrap both upserts in a transaction (plantation row + pullFromServer in one atomic unit) or accept partial state and show clear per-plantation error in the done modal. The simpler approach (consistent with `syncPlantation` behavior) is to catch per-plantation, continue batch, report failures in result summary. Partial plantations are recoverable: the user can retry the download (catalog still shows them as not-downloaded since... wait, they ARE in local SQLite now). See Open Question 1.

**Warning signs:** Plantation appears in local list but has 0 subgroups/trees; user confused about incomplete data.

### Pitfall 5: Missing navigation route for catalog screen

**What goes wrong:** `router.push('/(admin)/plantation/catalog')` fails because the file doesn't exist at `app/(admin)/plantation/catalog.tsx`.

**Why it happens:** Expo Router is file-based. The screen doesn't auto-register.

**How to avoid:** Create both `app/(admin)/plantation/catalog.tsx` AND `app/(tecnico)/plantation/catalog.tsx` as wrappers importing `CatalogScreen`. Also add `<Stack.Screen name="catalog" options={{ title: 'Catalogo de plantaciones' }} />` to both `plantation/_layout.tsx` files.

**Warning signs:** App crashes or shows 404 route error when tapping connectivity icon.

### Pitfall 6: Blocking `notifyDataChanged` until all downloads complete

**What goes wrong:** Calling `notifyDataChanged()` inside the download loop (per-plantation) causes a render storm — `useLiveData` subscriptions re-query SQLite after each plantation, while the user is watching a blocking modal.

**Why it happens:** Copying the per-iteration refresh pattern instead of the post-loop pattern.

**How to avoid:** Call `notifyDataChanged()` ONCE after the entire batch loop completes, in a `finally` block. This is the pattern established in `syncPlantation` (documented in Phase 03 decisions: "notifyDataChanged called once after entire sync loop — not per SubGroup — to prevent render storm").

---

## Code Examples

### Supabase Catalog Query (direct table, no RPC)

```typescript
// Source: supabase/migrations/001_initial_schema.sql (RLS: using(true) for all authenticated)
// Admin path
const { data, error } = await supabase
  .from('plantations')
  .select('*')
  .eq('organizacion_id', organizacionId)
  .order('created_at', { ascending: false });

// Tecnico path — two-step
const { data: puData } = await supabase
  .from('plantation_users')
  .select('plantation_id')
  .eq('user_id', userId);
const ids = puData?.map(r => r.plantation_id) ?? [];
const { data } = await supabase
  .from('plantations')
  .select('*')
  .in('id', ids);
```

### Plantation Row Upsert (from PlantationRepository.createPlantation)

```typescript
// Source: mobile/src/repositories/PlantationRepository.ts
await db
  .insert(plantations)
  .values({
    id: serverRow.id,
    organizacionId: serverRow.organizacion_id,
    lugar: serverRow.lugar,
    periodo: serverRow.periodo,
    estado: serverRow.estado,
    creadoPor: serverRow.creado_por,
    createdAt: serverRow.created_at,
  })
  .onConflictDoUpdate({
    target: plantations.id,
    set: { estado: sql`excluded.estado` },
  });
```

### Already-Downloaded Check (local SQLite ID lookup)

```typescript
// Source: mobile/src/database/schema.ts (plantations table)
const localRows = await db.select({ id: plantations.id }).from(plantations);
const localIds = new Set(localRows.map(r => r.id));
const isDownloaded = (plantationId: string) => localIds.has(plantationId);
```

### Navigation from PlantacionesScreen (Pressable wrapper on existing icon)

```typescript
// Pattern from: mobile/src/screens/PlantacionesScreen.tsx rightElement
<Pressable
  onPress={() => { if (isOnline) router.push(`/${routePrefix}/plantation/catalog` as any); }}
  hitSlop={8}
>
  <Ionicons
    name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
    size={20}
    color={isOnline ? colors.online : colors.offline}
  />
</Pressable>
```

### Batch Download with Progress + notifyDataChanged pattern

```typescript
// Pattern from: mobile/src/services/SyncService.ts syncPlantation()
const results: DownloadResult[] = [];
for (let i = 0; i < selected.length; i++) {
  const plantation = selected[i];
  onProgress?.({ total: selected.length, completed: i, currentName: plantation.lugar });
  try {
    await downloadPlantation(plantation);
    results.push({ success: true, id: plantation.id, nombre: plantation.lugar });
  } catch (e) {
    results.push({ success: false, id: plantation.id, nombre: plantation.lugar });
  }
}
notifyDataChanged(); // ONCE after loop — not inside loop
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pullFromServer() as complete sync | pullFromServer() + explicit plantation row upsert | Phase 04 | Download function must do both steps |
| No server plantation discovery | CatalogScreen (this phase) | Phase 06 | Users can now bootstrap new devices |

**No deprecated patterns detected.** All established patterns from Phases 01-05 remain current.

---

## Open Questions

1. **Partial download state: plantation row inserted but pullFromServer fails**
   - What we know: If network drops between the plantation row upsert and `pullFromServer()`, the plantation exists locally with no subgroups/trees. The local ID set will mark it as "downloaded" in the catalog, but it has no data.
   - What's unclear: Should the catalog use a different "downloaded" signal (e.g., subgroup count > 0) to detect incomplete downloads? Or is this acceptable — the user can use the existing "Actualizar datos" pull in `PlantationDetailScreen` to recover?
   - Recommendation: Accept partial state for MVP. The download modal should show per-plantation errors. Users can recover via PlantationDetailScreen pull. This matches the `syncPlantation` precedent (continues on failure, reports summary). Document in DownloadProgressModal done state.

2. **Subgroup/tree counts in catalog: extra Supabase queries or omit?**
   - What we know: D-03 requires showing "cantidad de arboles, cantidad de subgrupos" per catalog entry. This requires additional Supabase queries (aggregate counts from subgroups/trees tables).
   - What's unclear: Whether to do N+1 queries per plantation, a single aggregation query, or omit counts initially (show "-" and skip extra queries).
   - Recommendation: Single batch approach — fetch subgroup counts via `supabase.from('subgroups').select('plantation_id, count').in('plantation_id', ids)` + trees similarly. This avoids N+1. The counts are informational (help user decide what to download) so a single secondary query after the main list fetch is fine.

3. **organizacionId for tecnico role in catalog**
   - What we know: Tecnico queries don't need `organizacion_id` filter (they filter by `plantation_users`). Only admin needs `organizacion_id`.
   - What's unclear: Whether `useProfileData` reliably provides `organizacionId` for the admin path, or if a separate fetch is needed.
   - Recommendation: Use `useProfileData` hook (cache-first, already used in PlantacionesScreen for header title). If `profile.organizacionId` is null on first online load, show a loading state before fetching catalog.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely React Native code changes. No new external tools, services, CLIs, or runtimes beyond the existing project stack. Supabase backend is already deployed and operational.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (jest-expo preset) |
| Config file | `mobile/jest.config.js` |
| Quick run command | `cd mobile && npx jest tests/sync/ --no-coverage` |
| Full suite command | `cd mobile && npx jest --no-coverage` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SYNC-DL-01 | `downloadPlantation()` upserts plantation row then calls pullFromServer | unit | `npx jest tests/sync/downloadService.test.ts -x` | Wave 0 gap |
| SYNC-DL-02 | `getServerCatalog()` returns all plantations for admin (org-scoped) | unit | `npx jest tests/queries/catalogQueries.test.ts -x` | Wave 0 gap |
| SYNC-DL-03 | `getServerCatalog()` returns only assigned plantations for tecnico | unit | `npx jest tests/queries/catalogQueries.test.ts -x` | Wave 0 gap |
| SYNC-DL-04 | `getLocalPlantationIds()` returns correct Set from local SQLite | unit | `npx jest tests/queries/catalogQueries.test.ts -x` | Wave 0 gap |
| SYNC-DL-05 | Batch download continues on per-plantation error and reports failures | unit | `npx jest tests/sync/downloadService.test.ts -x` | Wave 0 gap |
| SYNC-DL-06 | `notifyDataChanged()` called exactly once after batch loop (not per-iteration) | unit | `npx jest tests/sync/downloadService.test.ts -x` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `cd mobile && npx jest tests/sync/ tests/queries/catalogQueries.test.ts --no-coverage`
- **Per wave merge:** `cd mobile && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `mobile/tests/sync/downloadService.test.ts` — covers SYNC-DL-01, SYNC-DL-05, SYNC-DL-06
- [ ] `mobile/tests/queries/catalogQueries.test.ts` — covers SYNC-DL-02, SYNC-DL-03, SYNC-DL-04

*(Existing test infrastructure — jest.config.js, jestSetup.js, setup.ts, mock patterns — covers all framework needs. Only new test files are needed.)*

---

## Sources

### Primary (HIGH confidence)

- `mobile/src/services/SyncService.ts` — `pullFromServer()` implementation, `syncPlantation()` orchestration pattern, `SyncProgress` type
- `mobile/src/repositories/PlantationRepository.ts` — plantation row upsert pattern, Pitfall 2 comment, `createPlantation()` as template for `downloadPlantation()`
- `mobile/src/hooks/useSync.ts` — hook state management pattern (idle/syncing/pulling/done), `notifyDataChanged()` in `finally`
- `mobile/src/screens/PlantacionesScreen.tsx` — connectivity icon in header, `useNetStatus`, `useProfileData`, `routePrefix` pattern
- `mobile/src/screens/PlantationDetailScreen.tsx` — `SyncProgressModal` usage, blocking modal pattern
- `mobile/src/components/SyncProgressModal.tsx` — exact modal structure to clone for `DownloadProgressModal`
- `mobile/src/components/ScreenHeader.tsx` — `rightElement` prop for tappable icon
- `mobile/src/database/schema.ts` — `plantations` table columns, FK constraints
- `mobile/src/queries/dashboardQueries.ts` — `getPlantationsForRole()` as server-side role-gating reference
- `supabase/migrations/001_initial_schema.sql` — RLS policies: `plantations` SELECT `using (true)`, `plantation_users` SELECT `using (true)`
- `supabase/migrations/003_admin_policies.sql` — Admin DML policies (not relevant for catalog reads)
- `mobile/app/(admin)/_layout.tsx` + `plantation/_layout.tsx` — routing structure for where to add catalog route
- `mobile/jest.config.js` — test framework config, mock patterns

### Secondary (MEDIUM confidence)

- `mobile/src/queries/freshnessQueries.ts` — pattern for Supabase query in queries layer
- `mobile/src/theme.ts` — confirmed `colors.online`, `colors.offline` exist for connectivity icon colors
- `.planning/STATE.md` accumulated decisions — Phase 03/04/05 decisions used as constraints

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all patterns verified in existing source code
- Architecture: HIGH — patterns directly derived from `PlantationRepository.createPlantation()`, `syncPlantation()`, `SyncProgressModal`, and routing structure
- Pitfalls: HIGH — Pitfall 1 (plantation row) is explicitly documented in source; Pitfalls 2-6 directly observed from reading the codebase

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (stable stack; no fast-moving dependencies)
