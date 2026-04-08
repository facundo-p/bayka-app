# Phase 10: Creación de plantación offline + sync catálogo de especies - Research

**Researched:** 2026-04-08
**Domain:** Offline-first plantation creation / species catalog sync (Drizzle SQLite + Supabase)
**Confidence:** HIGH

---

## Summary

Phase 10 enables the admin to create a plantation, add species, and add subgroups while completely offline, then sync everything to Supabase once connectivity returns. In parallel it ensures the local species catalog in SQLite is always up-to-date with the Supabase `species` table, by downloading it during regular syncs.

The codebase is already well-structured for this. The pattern for offline-first local mutation already exists (SubGroup + Tree registration — Phase 2). The challenge is that plantation creation currently goes to Supabase first (`createPlantation` in `PlantationRepository.ts`), and species configuration (`saveSpeciesConfig`) and technician assignment (`assignTechnicians`) are also online-only. This phase must invert that flow for plantation creation and species config: write locally first, then push when online.

Technician assignment stays online-only (per the goal statement). UUID generation for offline plantations is already provided by React Native / Expo — `uuid` or `crypto.randomUUID()` — and the UUID generated locally is used directly when inserting into Supabase (no ID migration needed).

**Primary recommendation:** Introduce a `pendingSync` flag (boolean/text field) on the local `plantations` table to track locally-created but not-yet-synced-to-server plantations, and wire their upload into the existing `syncPlantation` flow. Species catalog sync adds a new `pullSpeciesFromServer` function to `SyncService.ts` called during sync.

---

## Project Constraints (from CLAUDE.md)

- React functional components with hooks only.
- No inline styling — all styles in `StyleSheet.create`. No hardcoded color or size values.
- All colors from `src/theme.ts`.
- Zero code duplication between admin/tecnico roles. Shared screens in `src/components/` or `src/screens/`.
- One-place-change rule: a single color/style change must require editing one file.
- Zero queries/mutations in screens or components. All DB access in `repositories/`, `queries/`, or `services/`.
- Hooks bridge data to UI; no raw SQL in hooks.
- Functions >20 lines must be refactored or decomposed.
- No implementation without explicit user approval of the plan.

---

<phase_requirements>
## Phase Requirements

Derived from goal (no formal IDs assigned yet):

| ID (derived) | Description | Research Support |
|---|---|---|
| OFPL-01 | Admin can create a plantation while offline (local SQLite insert, no Supabase) | New `createPlantationLocally` in PlantationRepository; needs `pendingSync` flag on schema |
| OFPL-02 | Offline plantation can have species configured locally (no Supabase) | New `saveSpeciesConfigLocally` — insert into local `plantation_species` without Supabase call |
| OFPL-03 | Subgroups and trees can be added to an offline-created plantation (current behavior already works locally) | No schema change needed — SubGroupRepository writes locally already |
| OFPL-04 | When admin goes online, offline-created plantation is uploaded to Supabase (plantation row + plantation_species) | New `uploadOfflinePlantation` in PlantationRepository or SyncService; triggered from sync flow |
| OFPL-05 | Sync uploads plantation to Supabase using the locally-generated UUID (no ID migration) | Direct insert with local UUID — Supabase `plantations` PK is `uuid`, no serial, works as-is |
| OFPL-06 | Species catalog in local SQLite is refreshed from Supabase during each sync | New `pullSpeciesFromServer` in SyncService; called at start of `syncPlantation` |
| OFPL-07 | Technician assignment to plantation remains online-only | No change to `assignTechnicians`; gate it with connectivity check in UI |
| OFPL-08 | UI distinguishes offline-created (not-yet-synced) plantations from server-synced ones | `pendingSync` field on local `plantations` — drives badge or indicator in AdminScreen |
</phase_requirements>

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | (existing) | Local SQLite ORM — schema, queries, migrations | Already used project-wide |
| expo-sqlite | (existing) | SQLite adapter for Drizzle | Project standard |
| @supabase/supabase-js | (existing) | Supabase client | Project standard |
| @react-native-community/netinfo | (existing) | Online/offline detection | Already used in `useNetStatus` and `useAuth` |
| expo-crypto | (existing) | UUID generation (`Crypto.randomUUID()`) | Already imported for OfflineAuthService |

### UUID generation for offline plantations

`expo-crypto` exposes `Crypto.randomUUID()` (HIGH confidence — it is the standard `crypto.getRandomValues`-backed implementation). Alternatively `uuid` library is available. Both produce RFC 4122 v4 UUIDs. Supabase `plantations.id` is `uuid` type (not serial), so any client-generated UUID can be inserted directly.

**No new package installs required.**

---

## Architecture Patterns

### Current plantation creation flow (online-only)

```
AdminScreen
  -> createPlantation (PlantationRepository)
       -> supabase.from('plantations').insert()   ← requires network
       -> db.insert(plantations)                  ← local upsert
       -> notifyDataChanged()
```

### New offline-first plantation creation flow

```
AdminScreen
  -> isOnline ?
       -> createPlantation (existing, online path)
       -> createPlantationLocally (new, offline path)
            -> db.insert(plantations, { pendingSync: true, ... })
            -> notifyDataChanged()
```

### Sync upload flow for offline plantations

```
syncPlantation (SyncService)
  -> pullSpeciesFromServer()   ← NEW: refresh species catalog
  -> uploadOfflinePlantations()  ← NEW: push pending-sync plantations + species
  -> [existing pull + push subgroups logic]
```

### Recommended schema change

Add a `pendingSync` column to the local `plantations` table:

```typescript
// schema.ts addition
export const plantations = sqliteTable('plantations', {
  // ... existing fields ...
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
});
```

This requires a new Drizzle migration file (e.g., `0003_add_pending_sync.sql`) and a new migration run via `useMigrations` on startup.

**Key pattern: `pendingSync = false` for server-downloaded plantations, `pendingSync = true` for locally-created ones awaiting upload.**

### Species catalog sync

The current `seedSpecies.ts` already seeds from a static `assets/species.json`. Phase 10 adds a live sync from Supabase that runs during every sync operation:

```typescript
// SyncService.ts — new function
export async function pullSpeciesFromServer(): Promise<void> {
  const { data, error } = await supabase.from('species').select('*');
  if (error) return;  // non-blocking — stale catalog is acceptable
  for (const s of data ?? []) {
    await db.insert(species).values({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      nombreCientifico: s.nombre_cientifico ?? null,
      createdAt: s.created_at,
    }).onConflictDoUpdate({
      target: species.id,
      set: {
        codigo: sql`excluded.codigo`,
        nombre: sql`excluded.nombre`,
        nombreCientifico: sql`excluded.nombre_cientifico`,
      },
    });
  }
}
```

Call this at the top of `syncPlantation` before pulling subgroups.

### Offline plantation upload (new function)

```typescript
// PlantationRepository.ts — new function (or SyncService.ts)
export async function uploadOfflinePlantations(organizacionId: string): Promise<void> {
  const pending = await db
    .select()
    .from(plantations)
    .where(eq(plantations.pendingSync, true));

  for (const p of pending) {
    // Upload plantation row
    const { error } = await supabase
      .from('plantations')
      .insert({
        id: p.id,   // use locally-generated UUID directly
        organizacion_id: p.organizacionId,
        lugar: p.lugar,
        periodo: p.periodo,
        estado: p.estado,
        creado_por: p.creadoPor,
        created_at: p.createdAt,
      })
      .onConflict('id')
      .ignore();  // idempotent — safe to retry

    if (error && error.code !== '23505') continue;  // skip on non-duplicate errors

    // Upload plantation_species
    const localSpecies = await db
      .select()
      .from(plantationSpecies)
      .where(eq(plantationSpecies.plantacionId, p.id));

    if (localSpecies.length > 0) {
      await supabase
        .from('plantation_species')
        .upsert(
          localSpecies.map(ps => ({
            plantation_id: ps.plantacionId,
            species_id: ps.especieId,
            orden_visual: ps.ordenVisual,
          }))
        );
    }

    // Mark local plantation as synced
    await db
      .update(plantations)
      .set({ pendingSync: false })
      .where(eq(plantations.id, p.id));
  }

  notifyDataChanged();
}
```

**Idempotency is critical.** The upload must tolerate being called multiple times without creating duplicate server records. The `ON CONFLICT (id) DO NOTHING` pattern (same as subgroup sync) achieves this.

### Supabase RLS: plantation INSERT with client-generated UUID

The existing RLS policy "Admin can insert plantations" uses `with check (exists (select 1 from profiles where id = auth.uid() and rol = 'admin'))`. It does NOT constrain the UUID — any UUID is accepted. This means the client-generated UUID will be accepted by Supabase without any migration needed. HIGH confidence (verified by reading `003_admin_policies.sql`).

### Recommended project structure additions

```
mobile/src/
├── repositories/
│   └── PlantationRepository.ts    # add createPlantationLocally, uploadOfflinePlantations
├── services/
│   └── SyncService.ts             # add pullSpeciesFromServer, call uploadOfflinePlantations
├── database/
│   └── migrations/
│       └── 0003_add_pending_sync.sql  # new migration for pendingSync column
```

### Anti-Patterns to Avoid

- **Checking online status inside PlantationRepository:** Online/offline decision belongs in the calling hook or screen, not in the repository. The repository provides `createPlantation` (online) and `createPlantationLocally` (offline) — the caller picks which.
- **Deleting and re-uploading plantation_species during sync:** Use upsert (ON CONFLICT DO UPDATE) not DELETE+INSERT — DELETE would require the plantation to exist on Supabase first.
- **Showing "pending sync" plantations in the catalog screen:** The catalog screen fetches from Supabase; offline-created plantations don't exist there yet. This is correct — no UI change needed for the catalog. The AdminScreen list (local SQLite) will show them.
- **Blocking subgroup creation on offline plantation:** Subgroups and trees already write locally. This continues to work for offline-created plantations — no FK issue because the plantation row exists in local SQLite.
- **Using `supabase.auth.getUser()` during offline sync:** Use `getSession()` instead (reads local AsyncStorage, works offline). The existing `useCurrentUserId` hook already does this correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for offline records | Custom UUID logic | `Crypto.randomUUID()` from expo-crypto | Already imported; RFC 4122 compliant |
| Detecting offline state | Custom ping | `NetInfo.fetch()` from `@react-native-community/netinfo` | Already used in `useAuth.signIn` — same pattern |
| Reactive UI after DB write | Manual refresh calls | `notifyDataChanged()` + `useLiveData` | Already used everywhere — one call refreshes all subscribed components |
| Drizzle migrations | Manual SQL exec on startup | `useMigrations` hook (already running) | Runs automatically at app start |
| Conflict handling on upsert | Custom conflict logic | Drizzle `onConflictDoUpdate` / Supabase `.upsert()` | Already used throughout |

---

## Common Pitfalls

### Pitfall 1: Plantation FK constraint when uploading species before plantation exists on server

**What goes wrong:** `saveSpeciesConfig` (existing online path) writes `plantation_species` to Supabase after the plantation is created on Supabase. If the offline upload tries to insert `plantation_species` before the plantation row is inserted on Supabase, the FK constraint on `plantation_species.plantation_id` will reject it.

**Why it happens:** Upload order matters. The offline upload function must insert the plantation row BEFORE inserting plantation_species.

**How to avoid:** In `uploadOfflinePlantations`, insert the plantation row first, verify success (or `ON CONFLICT DO NOTHING`), then insert plantation_species. If plantation insert fails (non-duplicate error), skip plantation_species for that plantation.

**Warning signs:** Supabase error `23503 foreign_key_violation` on `plantation_species` insert.

---

### Pitfall 2: `pendingSync` plantations appearing in finalization gate check

**What goes wrong:** The finalization gate (`checkFinalizationGate`) checks that all subgroups are `sincronizada`. An offline plantation with `pendingSync = true` may have subgroups that are locally `sincronizada` (uploaded to Supabase) — this works correctly. But the admin cannot finalize until the plantation itself is on Supabase, because `finalizePlantation` currently calls Supabase first.

**How to avoid:** The finalization action must be gated on `pendingSync = false`. If `pendingSync = true`, show a message: "Sincroniza la plantación primero antes de finalizar." The planner should add this gate explicitly.

---

### Pitfall 3: Drizzle migration for `pendingSync` column — existing local databases

**What goes wrong:** Devices with the app installed before Phase 10 have `plantations` rows without the `pendingSync` column. Drizzle's `useMigrations` will add the column via the migration, but only if the migration file is correctly versioned.

**How to avoid:** Add a new migration file (e.g., `mobile/drizzle/0003_add_pending_sync.sql`) with `ALTER TABLE plantations ADD COLUMN pending_sync INTEGER NOT NULL DEFAULT 0;`. All existing rows get `pending_sync = 0` (false) automatically — correct, since they were created online.

---

### Pitfall 4: Species catalog sync removing species that have trees

**What goes wrong:** If `pullSpeciesFromServer` deletes local species no longer in the server catalog, trees referencing those species via `especieId` FK will break.

**How to avoid:** Do NOT delete species during `pullSpeciesFromServer`. Only upsert additions and updates. If a species is removed from the server catalog, keep it locally — its SubID is embedded in tree records and its deletion would corrupt data. This matches the project's "Species codes embedded in SubIDs; changes corrupt existing records" out-of-scope rule.

---

### Pitfall 5: Admin uploads offline plantation without valid Supabase JWT

**What goes wrong:** The admin creates a plantation offline, then tries to sync while still offline (or JWT expired). The upload silently fails.

**How to avoid:** `uploadOfflinePlantations` is called inside `syncPlantation`, which already calls `supabase.auth.getSession()` to refresh the token (Step 1). The existing pattern handles this. Additionally, if upload fails (network error), keep `pendingSync = true` — it will be retried on the next sync. Log the error but don't surface it to the user unless all pending plantations fail.

---

### Pitfall 6: `organizacionId` not available when creating plantation offline

**What goes wrong:** `createPlantation` currently requires `organizacionId`, which is fetched from Supabase `profiles` in `AdminScreen.tsx`. When offline, the Supabase fetch might fail.

**How to avoid:** `AdminScreen.tsx` already fetches `organizacionId` from Supabase on mount (existing code). Cache it in local state — it's fetched once when online and reused. Alternatively, cache it in SecureStore on first successful fetch (same pattern as role caching in `useAuth`). The planner should decide which approach; caching in SecureStore is more robust for deep offline scenarios.

---

## Code Examples

### createPlantationLocally (new function)

```typescript
// Source: pattern from Phase 2 SubGroupRepository — local-first write
import { Crypto } from 'expo-crypto';

export async function createPlantationLocally(
  lugar: string,
  periodo: string,
  organizacionId: string,
  creadoPor: string
): Promise<{ id: string; lugar: string; periodo: string; estado: string }> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(plantations).values({
    id,
    organizacionId,
    lugar,
    periodo,
    estado: 'activa',
    creadoPor,
    createdAt: now,
    pendingSync: true,
  });

  notifyDataChanged();
  return { id, lugar, periodo, estado: 'activa' };
}
```

### Schema migration for pendingSync

```sql
-- mobile/drizzle/0003_add_pending_sync.sql
ALTER TABLE plantations ADD COLUMN pending_sync INTEGER NOT NULL DEFAULT 0;
```

### saveSpeciesConfigLocally (new function)

```typescript
// Source: adapted from saveSpeciesConfig — removes Supabase calls
export async function saveSpeciesConfigLocally(
  plantacionId: string,
  items: Array<{ especieId: string; ordenVisual: number }>
): Promise<void> {
  // Delete existing local species config
  await db.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));

  // Insert new items
  if (items.length > 0) {
    const now = new Date().toISOString();
    await db.insert(plantationSpecies).values(
      items.map((item, idx) => ({
        id: `ps-${plantacionId}-${item.especieId}`,
        plantacionId,
        especieId: item.especieId,
        ordenVisual: item.ordenVisual,
      }))
    );
  }

  notifyDataChanged();
}
```

### Connectivity-aware create handler in AdminScreen

```typescript
// Source: pattern from useAuth.signIn (Phase 8)
async function handleCreateSubmit(lugar: string, periodo: string) {
  if (!organizacionId || !userId) throw new Error('...');
  const net = await NetInfo.fetch();
  const isOnline = net.isConnected === true && net.isInternetReachable !== false;
  if (isOnline) {
    await createPlantation(lugar, periodo, organizacionId, userId);
  } else {
    await createPlantationLocally(lugar, periodo, organizacionId, userId);
  }
  setShowCreateModal(false);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All plantation mutations online-only | Offline-first local write + deferred upload | Phase 10 | Admin field use without connectivity |
| Species catalog static (bundled JSON) | Species catalog live-synced from Supabase | Phase 10 | Catalog updates without app update |

**No deprecated approaches** in the current codebase affect this phase.

---

## Runtime State Inventory

This phase involves schema changes but no rename/refactor. The relevant runtime state:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `plantations` rows in local SQLite (all devices) have no `pending_sync` column | Drizzle migration `ALTER TABLE ... ADD COLUMN pending_sync INTEGER NOT NULL DEFAULT 0` — auto-handled by `useMigrations` on next app start |
| Live service config | None — no n8n or external service config references plantations | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars | None |
| Build artifacts | None | None |

**Supabase schema:** No changes to the Supabase `plantations` table. The `id` column is already `uuid primary key` with no `DEFAULT gen_random_uuid()` constraint that would prevent client-supplied UUIDs — actually Supabase does have `default gen_random_uuid()` but that only applies when no value is provided. An explicit UUID in the INSERT will override the default. HIGH confidence (this is standard Postgres behavior).

---

## Open Questions

1. **Where to cache `organizacionId` for offline admin?**
   - What we know: `AdminScreen` fetches it from Supabase profiles on mount. When offline on mount, the fetch fails and `organizacionId` remains null.
   - What's unclear: Should we add it to SecureStore (same as role/email), or is it acceptable to gate offline plantation creation on having `organizacionId` cached from a previous session?
   - Recommendation: Cache in SecureStore on successful fetch (same pattern as `ROLE_KEY` in `useAuth`). Add an `ORG_ID_KEY` constant. Simple change with no schema impact.

2. **Should offline-created plantations show a visual indicator in AdminScreen?**
   - What we know: The goal says "admin can create offline" — no explicit requirement for a visual distinction.
   - What's unclear: Will admins be confused if the plantation appears immediately but doesn't exist on the server yet?
   - Recommendation: Add a subtle "pendiente" badge or indicator using `pendingSync` flag. Low visual weight — same pattern as estado chips.

3. **Should `uploadOfflinePlantations` live in `PlantationRepository.ts` or `SyncService.ts`?**
   - What we know: `SyncService.ts` orchestrates all Supabase sync; `PlantationRepository.ts` handles plantation mutations.
   - Recommendation: The upload function touches both plantation data and calls Supabase — it's a sync operation, so place it in `SyncService.ts` to keep `PlantationRepository.ts` focused on local mutations. Call it from `syncPlantation` before the subgroup upload loop.

---

## Environment Availability

Step 2.6: SKIPPED — this phase requires no new external dependencies beyond what already exists in the project.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (existing project setup) |
| Config file | Existing jest config in project root |
| Quick run command | `cd mobile && npx jest --testPathPattern="PlantationRepository|SyncService" --no-coverage` |
| Full suite command | `cd mobile && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OFPL-01 | createPlantationLocally inserts row with pendingSync=true | unit | `npx jest --testPathPattern="PlantationRepository" -t "createPlantationLocally"` | ❌ Wave 0 |
| OFPL-02 | saveSpeciesConfigLocally inserts plantation_species without Supabase | unit | `npx jest --testPathPattern="PlantationRepository" -t "saveSpeciesConfigLocally"` | ❌ Wave 0 |
| OFPL-04 | uploadOfflinePlantations uploads plantation + species + marks pendingSync=false | unit | `npx jest --testPathPattern="SyncService" -t "uploadOfflinePlantations"` | ❌ Wave 0 |
| OFPL-05 | Supabase insert uses local UUID (not server-generated) | unit | covered by OFPL-04 test | ❌ Wave 0 |
| OFPL-06 | pullSpeciesFromServer upserts species without deleting existing | unit | `npx jest --testPathPattern="SyncService" -t "pullSpeciesFromServer"` | ❌ Wave 0 |
| OFPL-07 | assignTechnicians is not called offline | manual | Network disabled + attempt assign | — |
| OFPL-08 | AdminScreen shows pending badge for pendingSync plantations | manual | Visual verification | — |

### Sampling Rate

- **Per task commit:** quick run matching changed file
- **Per wave merge:** full suite
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `mobile/__tests__/PlantationRepository.offline.test.ts` — covers OFPL-01, OFPL-02
- [ ] `mobile/__tests__/SyncService.species.test.ts` — covers OFPL-04, OFPL-05, OFPL-06
- [ ] Migration file `mobile/drizzle/0003_add_pending_sync.sql` — required before any test that creates a plantation table

---

## Sources

### Primary (HIGH confidence)

- `/mobile/src/repositories/PlantationRepository.ts` — existing plantation mutation patterns
- `/mobile/src/services/SyncService.ts` — existing sync patterns (pullFromServer, uploadSubGroup, syncPlantation)
- `/mobile/src/database/schema.ts` — local SQLite schema
- `/supabase/migrations/001_initial_schema.sql` — Supabase schema, RLS policies
- `/supabase/migrations/002_sync_rpc.sql` — sync_subgroup RPC, ON CONFLICT DO NOTHING pattern
- `/supabase/migrations/003_admin_policies.sql` — Admin RLS: insert plantations policy
- `/mobile/src/hooks/useAuth.ts` — connectivity-aware online/offline pattern
- `/mobile/src/database/seeds/seedSpecies.ts` — species upsert pattern (source for pullSpeciesFromServer)
- `/mobile/src/config/offlineLogin.ts` — SecureStore caching pattern

### Secondary (MEDIUM confidence)

- Expo Crypto docs: `Crypto.randomUUID()` available in expo-crypto ≥ 12.x (SDK 52+)
- Standard Postgres behavior: explicit UUID in INSERT overrides `DEFAULT gen_random_uuid()`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, verified by source reading
- Architecture patterns: HIGH — derived directly from existing code patterns in codebase
- Pitfalls: HIGH — derived from code reading + Postgres/Drizzle knowledge
- Schema migration: HIGH — Drizzle migration pattern already used in project

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable domain)
