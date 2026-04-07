# Phase 6: Admin sync - subir plantaciones y finalizaciones al servidor - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable devices to discover and download plantations from the Supabase server. Currently, `pullFromServer(plantacionId)` only works for plantations already in local SQLite — there is no mechanism to download the plantation row itself or discover new plantations. This phase adds a "catalog" screen where users browse server plantations and selectively download them (plantation + subgroups + trees + species + users) to their local device.

No changes to plantation creation (already server-first), finalization (already dual-write), or SubGroup sync (already working). No automatic sync — download remains manual and user-initiated.

</domain>

<decisions>
## Implementation Decisions

### Descubrimiento de plantaciones
- **D-01:** Dedicated catalog screen showing all server plantations available to the user
- **D-02:** Access via the existing connectivity icon in the PlantacionesScreen header — icon becomes tappable when online (opens catalog), disabled/grayed when offline
- **D-03:** Each plantation in the catalog shows: lugar, periodo, estado, cantidad de arboles, cantidad de subgrupos, and an indicator if already downloaded locally

### Seleccion de plantaciones
- **D-04:** Checkboxes on each plantation + "Descargar seleccion" button for batch download
- **D-05:** Plantations already downloaded locally are shown but NOT selectable (visually distinct, e.g., grayed or with a checkmark badge)
- **D-06:** No re-download/update mechanism from catalog — updating existing plantations happens via the existing sync/pull flow in PlantacionesScreen

### Trigger y flujo de descarga
- **D-07:** Download includes full data: plantation row + plantation_species + plantation_users + all sincronizada subgroups + all trees. User has everything available offline immediately after download.
- **D-08:** Modal with progress bar during download (consistent with existing sync modal pattern). Blocking — user cannot navigate while downloading.
- **D-09:** Progress shows "Descargando plantacion X/N..." with plantation name

### Impacto en tecnico vs admin
- **D-10:** Tecnico sees ONLY plantations they are assigned to (via plantation_users on server). Admin sees ALL plantations for their organization. Consistent with current dashboard role-gating.
- **D-11:** Admin creating a plantation continues to auto-insert into local SQLite (current behavior preserved). Catalog is for downloading plantations created on OTHER devices or for new device setup.

### Claude's Discretion
- Exact catalog screen layout and visual design
- How to query Supabase for the catalog list (direct table query vs RPC)
- How to determine "already downloaded" (local SQLite lookup by plantation ID)
- Exact progress modal implementation (reuse existing SyncModal or new component)
- Error handling if download fails mid-batch (per-plantation retry or skip)
- Whether to pull trees via subgroup IDs or plantation ID

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sync architecture
- `mobile/src/services/SyncService.ts` — Current pullFromServer implementation (downloads subgroups, trees, plantation_users, plantation_species but NOT plantation row)
- `mobile/src/repositories/PlantationRepository.ts` — createPlantation shows the pattern for upserting plantation rows into local SQLite
- `mobile/src/hooks/useSync.ts` — React hook wrapping sync operations with state management

### Database schema
- `mobile/src/database/schema.ts` — Local SQLite schema (plantations, subgroups, trees, plantationUsers, plantationSpecies tables)

### Existing UI patterns
- `mobile/src/screens/PlantacionesScreen.tsx` — Current plantation list screen with connectivity icon in header, freshness check, and pull logic
- `mobile/src/screens/PlantationDetailScreen.tsx` — Sync modal pattern with progress overlay
- `mobile/src/hooks/useNetStatus.ts` — Online/offline detection hook

### Queries
- `mobile/src/queries/dashboardQueries.ts` — getPlantationsForRole shows role-gated local query pattern (admin: all, tecnico: via plantation_users join)

### Domain model
- `docs/domain-model.md` §7 (Plantacion) — Plantation attributes, states
- `docs/domain-model.md` §15 (Sincronizacion) — Sync principles

### Supabase
- `supabase/migrations/003_admin_policies.sql` — RLS policies for plantation access

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pullFromServer(plantacionId)` in SyncService.ts — Already downloads subgroups, trees, plantation_users, plantation_species. Can be reused after inserting the plantation row.
- `useSync` hook — State management pattern (idle/syncing/done) with progress callbacks. Can be adapted for download flow.
- `useNetStatus` hook — Online/offline detection for enabling/disabling catalog access.
- SyncModal pattern in PlantationDetailScreen — Blocking modal with progress bar during sync. Can be replicated for download flow.
- `notifyDataChanged()` — Existing reactive refresh mechanism via useLiveData.

### Established Patterns
- Server-first mutations: All admin operations write to Supabase first, then upsert locally.
- Role-gated queries: Admin sees all via direct query, tecnico sees assigned via plantation_users join.
- Upsert pattern: `db.insert().values().onConflictDoUpdate()` used throughout for idempotent local writes.

### Integration Points
- PlantacionesScreen header connectivity icon — will be modified to be tappable (navigates to catalog)
- PlantationRepository.createPlantation — Shows the exact upsert pattern for inserting plantation rows into local SQLite
- SyncService.pullFromServer — Will be called per-plantation after inserting the plantation row locally

</code_context>

<specifics>
## Specific Ideas

- The connectivity icon in PlantacionesScreen header should dual-function: indicate online/offline status AND serve as entry point to the catalog when online
- Catalog should clearly differentiate between "new" (downloadable) and "already on device" plantations
- Download is a one-time action per plantation — subsequent updates happen via existing sync/pull mechanisms

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-admin-sync-subir-plantaciones-y-finalizaciones-al-servidor*
*Context gathered: 2026-03-31*
