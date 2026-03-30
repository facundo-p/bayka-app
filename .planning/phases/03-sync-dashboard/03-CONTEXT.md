# Phase 3: Sync + Dashboard - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Technicians can see their plantation progress on the dashboard and manually sync finalizada SubGroups to the server, downloading other technicians' data in return. No admin plantation management, no ID generation, no export — those are Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Sync trigger & flow
- Batch sync: single button syncs ALL finalizada SubGroups for the plantation at once
- Sync button as prominent CTA at top of plantation detail screen, showing pending count (e.g., "Sincronizar 3 subgrupos")
- Modal overlay during sync with progress indicator (X/N SubGroups synced) — prevents user interaction during atomic operations
- Pull-then-push order: download updated data first, then upload local SubGroups
- Each SubGroup uploaded atomically (SubGroup + all trees in one server transaction via Supabase RPC)
- On success: toast/banner message, SubGroups transition to sincronizada in-place via useLiveData refresh
- On failure of individual SubGroup: continue syncing remaining SubGroups, report all failures at end
- Failed SubGroups remain finalizada locally with inline error explanation

### Dashboard stats layout
- Card per plantation with key stats inline — extends existing PlantacionesScreen pattern
- Stats priority per card: total trees registered, unsynced tree count, today's tree count
- Admin sees all plantations for the organization; tecnico sees only assigned — query-level difference, same card component
- Stats refresh on screen focus using established useLiveData pattern
- Pending sync count visible on each plantation card (e.g., "3 subgrupos pendientes")

### Conflict error presentation
- Duplicate SubGroup code rejection shown as inline alert on the failed SubGroup in Spanish
- Plain-language message: "El código de subgrupo ya existe en el servidor. Renombrá el código e intentá de nuevo."
- Failed SubGroup stays as finalizada locally — user can rename code and retry
- No complex conflict resolution UI — manual rename is sufficient (per project Out of Scope)

### Pending sync visibility
- Badge on Plantaciones tab icon showing total pending sync count across all plantations
- Pending count on each plantation card (count of finalizada SubGroups not yet sincronizada)
- Pending count always visible without navigating away (per SYNC-07)
- Count updates reactively via useLiveData when SubGroups change state

### Claude's Discretion
- Exact sync modal design and animation
- Supabase RPC function implementation details (idempotency key strategy, exact SQL)
- Download strategy (which tables to pull, pagination if needed)
- Error retry UX details beyond the stated "continue and report" behavior
- Exact card layout proportions and stat arrangement
- Loading skeleton design for dashboard

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain model and sync rules
- `docs/domain-model.md` §8 (SubGrupo) — SubGroup states, sync unit definition, immutability after sync
- `docs/domain-model.md` §19 (Reglas de integridad) — Uniqueness constraints, sync gates, N/N resolution requirement
- `docs/domain-model.md` §15 (Sincronización) — Sync flow, atomic upload, pull-then-push, conflict handling

### Functional specs
- `docs/SPECS.md` §4.2 (Dashboard) — Dashboard requirements, plantation stats display
- `docs/SPECS.md` §4.14 (Sincronización) — Manual sync trigger, atomic SubGroup upload, conflict detection, download flow
- `docs/SPECS.md` §4.15 (Estado de sincronización) — Pending sync visibility, state transitions

### Architecture
- `docs/architecture.md` §5 (Sincronización) — Sync architecture, offline-first principles, Supabase RPC approach
- `docs/architecture.md` §9 (Capas de Arquitectura) — Layer architecture to follow for new sync code

### UI/UX constraints
- `docs/ui-ux-guidelines.md` — Field-optimized UI principles, simplicity rules

### Existing code (Phase 1-2)
- `mobile/src/database/schema.ts` — Drizzle schema with subgroups.estado supporting 'sincronizada'
- `mobile/src/repositories/SubGroupRepository.ts` — Existing repo pattern; sync will add state transition
- `mobile/src/hooks/useLiveData.ts` — Reactive hook pattern for dashboard refresh
- `mobile/src/screens/PlantacionesScreen.tsx` — Existing plantation list to extend with stats
- `mobile/src/screens/PlantationDetailScreen.tsx` — Existing detail screen to extend with sync CTA
- `mobile/src/supabase/client.ts` — Supabase client for RPC calls
- `mobile/src/theme.ts` — Centralized theme (sincronizada color: #2196f3 already defined)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PlantacionesScreen.tsx`: Plantation list with basic tree counts — extend with dashboard stats
- `PlantationDetailScreen.tsx`: SubGroup list with state chips — extend with sync CTA button
- `SubGroupStateChip.tsx`: Already handles activa/finalizada/sincronizada states
- `SubGroupRepository.ts`: State transition methods — add sincronizada transition
- `useLiveData.ts`: Reactive hook with notifyDataChanged — use for sync status updates
- `useSubGroupsForPlantation.ts`: Queries SubGroups — extend to include pending sync count
- `theme.ts`: sincronizada color (#2196f3), estado colors already defined
- `supabase/client.ts`: Configured Supabase client — use for RPC calls
- `alertHelpers.ts`: Dialog utilities — use for sync confirmation/error alerts

### Established Patterns
- Repository pattern with Drizzle transactions and notifyDataChanged
- useLiveData for reactive UI (refetch on mount, focus, data change)
- Shared screens between admin/tecnico with query-level role differentiation
- Spanish language throughout
- Centralized theme.ts for all colors, spacing, typography

### Integration Points
- `PlantacionesScreen.tsx`: Add dashboard stats (total trees, unsynced, today's count)
- `PlantationDetailScreen.tsx`: Add sync CTA button with pending count
- `(tecnico)/_layout.tsx` / `(admin)/_layout.tsx`: Add badge to Plantaciones tab
- `SubGroupRepository.ts`: Add sincronizada state transition after successful sync
- New `SyncService.ts`: Supabase RPC calls for atomic upload + download
- New `useSync` hook: Sync state management (loading, progress, errors)
- Supabase backend: New RPC function for atomic SubGroup+Trees upload

</code_context>

<specifics>
## Specific Ideas

- Sync button should be highly visible — technicians need to know they have data to sync
- Dashboard must work instantly from local SQLite — no network needed to see stats
- Sync errors must be in plain Spanish — field technicians aren't developers
- The "pending sync" badge creates urgency without blocking workflow
- After sync, seeing other technicians' SubGroups downloaded gives confidence the system works

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-sync-dashboard*
*Context gathered: 2026-03-19*
