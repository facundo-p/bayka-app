# Phase 4: Admin + Export - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can manage plantations (create with lugar+periodo, configure species from global catalog with visual order, assign technicians), finalize plantations (when all SubGroups are sincronizada), generate sequential IDs (plantation-level + global organization-level with admin-set seed), and export finalized plantation data to CSV/Excel. No technician-facing changes, no new sync logic, no species catalog editing.

</domain>

<decisions>
## Implementation Decisions

### Plantation creation flow
- Dedicated screen accessible from Admin tab (replaces current placeholder)
- Admin tab shows list of all plantations with estado chip + action buttons (configure, finalize, export)
- Create form: Lugar + Periodo fields, simple form with validation
- Plantation created on server immediately (requires connectivity) — then synced to local SQLite
- Server-side creation required because plantation_id FK must exist before technicians can sync SubGroups
- After creation, admin configures species and assigns technicians as separate steps

### Species configuration
- Sub-screen of plantation detail, accessible via "Configurar especies" button
- Checklist from global species catalog — admin toggles which species are available
- Drag-to-reorder for orden_visual (defines button order in species grid)
- Admin can add species at any time (PLAN-04)
- Admin cannot remove a species if trees already registered with it (data integrity)
- Changes saved to plantation_species table (local + server)

### Technician assignment
- Sub-screen of plantation detail, accessible via "Asignar técnicos" button
- List of all technicians in the organization (from profiles where rol='tecnico')
- Toggle assignment per technician — updates plantation_users table
- Changes saved to server immediately (requires connectivity) for other devices to pull
- Assigned technicians see the plantation in their Plantaciones tab after next pull

### Plantation finalization
- "Finalizar plantación" button on admin plantation detail screen
- Gate: all SubGroups must be sincronizada — show clear message if not
- Confirmation dialog (ConfirmModal) before finalizing
- Sets plantation estado to 'finalizada' — locks further SubGroup creation
- After finalization, ID generation becomes available

### ID generation
- Manual trigger: "Generar IDs" button visible only after plantation is finalizada
- Seed input dialog: system suggests max(globalId) + 1 across organization, admin can override
- IdPlantacion: sequential 1, 2, 3... within the plantation (one per tree)
- IdGeneral: sequential from seed value across the organization (one per tree)
- Both IDs written to trees.plantacionId and trees.globalId columns (currently null)
- Once generated, IDs are locked — cannot be regenerated (confirmation required before generating)
- ID generation runs locally on already-synced data

### Export
- Two separate buttons: "Exportar CSV" and "Exportar Excel"
- Available only on finalized plantations with IDs generated
- Columns: ID Global, ID Parcial, Zona (lugar), SubGrupo (nombre), SubID, Periodo, Especie (nombre)
- File delivered via native share sheet (expo-sharing) — admin can save, email, send via WhatsApp etc.
- Excel generated with xlsx (SheetJS) library
- CSV generated natively (string building, no library needed)

### Claude's Discretion
- Exact admin tab layout and navigation structure
- Drag-to-reorder implementation library choice
- Form validation details
- Exact share sheet integration approach
- Loading states during server operations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain model and admin rules
- `docs/domain-model.md` §7 (Plantación) — Plantation attributes, states, lifecycle
- `docs/domain-model.md` §15 (Sincronización) — Sync rules that affect finalization gate
- `docs/domain-model.md` §19 (Reglas de integridad) — Uniqueness, state transition constraints

### Functional specs
- `docs/SPECS.md` §4.3 (Gestión de Plantaciones) — Admin CRUD for plantations
- `docs/SPECS.md` §4.4 (Configuración de Especies) — Species selection and button order
- `docs/SPECS.md` §4.5 (Asignación de Técnicos) — Technician assignment flow
- `docs/SPECS.md` §4.16 (Finalización de Plantación) — Finalization gate and effects
- `docs/SPECS.md` §4.17 (Generación de IDs Finales) — IdPlantacion + IdGeneral rules, seed
- `docs/SPECS.md` §4.18 (Exportación de Datos) — Export columns, format, availability

### UI/UX constraints
- `docs/ui-ux-guidelines.md` — Field-optimized UI principles

### Existing code (Phase 1-3)
- `mobile/app/(admin)/_layout.tsx` — Admin tab layout with placeholder admin screen
- `mobile/app/(admin)/admin.tsx` — Current placeholder to replace
- `mobile/src/database/schema.ts` — plantations, plantation_species, plantation_users, trees tables
- `mobile/src/queries/dashboardQueries.ts` — Role-gated plantation queries
- `mobile/src/queries/plantationDetailQueries.ts` — Plantation detail stat queries
- `mobile/src/services/SyncService.ts` — pullFromServer for syncing changes to other devices
- `mobile/src/components/ConfirmModal.tsx` — Reusable confirmation dialogs
- `mobile/src/hooks/useConfirm.ts` — Imperative confirm hook
- `mobile/src/theme.ts` — Centralized design tokens
- `supabase/migrations/001_initial_schema.sql` — Server schema with RLS policies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConfirmModal` + `useConfirm`: For all admin confirmations (finalize, generate IDs)
- `PlantacionesScreen`: Already role-gated, admin sees all plantations
- `PlantationDetailScreen`: Subgroup list with stats — admin extends with management actions
- `SubGroupStateChip`: Estado display component
- `theme.ts`: All colors including state colors (activa, finalizada, sincronizada)
- `SyncService.pullFromServer`: Can be called after server-side creation to sync locally

### Established Patterns
- Queries in `src/queries/`, mutations in `src/repositories/` — zero db in screens
- `useLiveData` for reactive UI from local SQLite
- Spanish language throughout
- ConfirmModal for all user confirmations
- Expo Router file-based routing with role layout groups

### Integration Points
- `app/(admin)/admin.tsx`: Replace placeholder with admin management screen
- `app/(admin)/_layout.tsx`: May need new routes for create/configure sub-screens
- `plantation_species` table: Admin writes species config, technician reads via grid
- `plantation_users` table: Admin writes assignments, technician reads via dashboard filter
- `trees.plantacionId` + `trees.globalId`: Currently null integer columns, ID generation fills them
- Server-side: Need INSERT policy for plantations (admin creates), INSERT/DELETE for plantation_species and plantation_users

</code_context>

<specifics>
## Specific Ideas

- Admin operations (create, assign, finalize) require connectivity — they modify server data
- ID generation is a local-only operation on already-synced data — no network needed
- Export is local-only — reads from SQLite, generates file, shares via OS
- Species order config must be simple: drag-and-drop or move-up/move-down buttons
- Finalization is a one-way operation — confirmed, cannot be undone

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-admin-export*
*Context gathered: 2026-03-19*
