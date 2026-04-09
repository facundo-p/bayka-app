# Roadmap: Bayka — Plantation Monitoring App

## Overview

Bayka is built in 4 phases that follow the dependency chain from infrastructure to field use to data delivery. Phase 1 establishes the offline-safe foundation and auth. Phase 2 delivers the complete field registration experience — the core value of the product. Phase 3 enables sync and the dashboard that wraps around field data. Phase 4 completes the admin and data export flows needed before the autumn 2026 planting season.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Auth** - Offline-safe infrastructure, SQLite schema, Supabase auth with persistent sessions, role-based navigation shell (completed 2026-03-17)
- [x] **Phase 2: Field Registration** - Species button grid, one-tap tree registration, SubGroup lifecycle, N/N workflow, reverse order (completed 2026-03-17)
- [x] **Phase 3: Sync + Dashboard** - Manual sync with atomic SubGroup upload, conflict detection, plantation dashboard with stats (completed 2026-03-19)
- [x] **Phase 4: Admin + Export** - Admin plantation management, ID generation, CSV/Excel export (completed 2026-03-20)
- [x] **Phase 5: UX Improvements** - Connectivity indicator, data freshness checks, profile screen, contextual headers (completed 2026-03-29)
- [x] **Phase 6: Plantation Catalog + Download** - Server plantation discovery, batch download to device, offline-first bootstrap for new devices (completed 2026-04-01)
- [x] **Phase 7: Eliminar Plantacion Local** - Borrado local de plantaciones descargadas en el celular, con advertencia de datos sin sincronizar (completed 2026-04-06)
- [x] **Phase 8: Login Offline** - Primer login online para validar, luego cachear credenciales para login sin conexion en campo (completed 2026-04-06)
- [ ] **Phase 9: Testing Strategy** - Estrategia de testing abarcativa para funcionalidades criticas: offline, sync, data integrity, role-based access

## Phase Details

### Phase 1: Foundation + Auth
**Goal**: The app runs offline-safely with working auth, a migration-ready SQLite schema, and role-based navigation that persists across restarts
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User can log in with email and password and stay logged in after closing and reopening the app — even without network connectivity
  2. User can log out from any screen; session is fully cleared
  3. App shows admin navigation for admin users and technician navigation for tecnico users immediately after login
  4. Different users can log in on the same device and each gets their own session
  5. SQLite database initializes with the full schema and seeded species catalog on first launch; schema migrations run automatically on app update
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Expo SDK 55 scaffolding, Drizzle schema, SQLite WAL client, Metro SQL config, test infrastructure, species seed
- [ ] 01-02-PLAN.md — Supabase Postgres schema (8 tables, RLS), seed script for 4 test users
- [ ] 01-03-PLAN.md — Offline-safe auth (Supabase client, SecureStore session helpers, useAuth hook), login screen, role-based tab navigation

### Phase 2: Field Registration
**Goal**: Technicians can create SubGroups, register trees by tapping species buttons, handle N/N trees, reverse order, and finalize SubGroups — entirely offline
**Depends on**: Phase 1
**Requirements**: SUBG-01, SUBG-02, SUBG-03, SUBG-04, SUBG-05, SUBG-06, SUBG-07, TREE-01, TREE-02, TREE-03, TREE-04, TREE-05, TREE-06, TREE-07, NN-01, NN-02, NN-03, NN-04, NN-05, REVR-01, REVR-02, REVR-03
**Success Criteria** (what must be TRUE):
  1. Technician can create a SubGroup with a unique code and type, and see it listed with its current state (activa / finalizada / sincronizada)
  2. Tapping a species button instantly creates a tree record with auto-incremented position and SubID — no dialog, no loading indicator
  3. Technician can undo the last registered tree without a confirmation dialog
  4. Registering a N/N tree requires a photo; the SubGroup cannot be finalized until all N/N trees are resolved with a species
  5. Technician can reverse the order of trees in a SubGroup before it is sincronizada, and positions recalculate correctly
  6. Technician can only edit SubGroups they created; sincronizada SubGroups are read-only
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Dependencies (expo-image-picker, expo-file-system), schema extension (plantation_species table + unique index), demo plantation seed, idGenerator and reverseOrder utils with unit tests, test scaffolds
- [ ] 02-02-PLAN.md — SubGroupRepository, TreeRepository, PlantationSpeciesRepository, PhotoService, three hooks (useSubGroups, useTrees, usePlantationSpecies), repository unit tests
- [ ] 02-03-PLAN.md — Plantation list screen, Stack navigation, SubGroup list with state chips, create SubGroup form, finalization flow with N/N gate (checkpoint)
- [ ] 02-04-PLAN.md — Tree registration screen (species grid, one-tap, last-3, undo, N/N capture, reverse, finalizar) + N/N resolution screen (checkpoint)

### Phase 3: Sync + Dashboard
**Goal**: Technicians can see their plantation progress on the dashboard and manually sync finalizada SubGroups to the server, downloading other technicians' data in return
**Depends on**: Phase 2
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Technician sees their assigned plantations on the dashboard with total trees, unsynced tree count, and today's tree count
  2. Admin sees all plantations for the organization with the same stats
  3. Technician can initiate sync and finalizada SubGroups upload atomically (SubGroup + all trees in one server transaction); on success the SubGroup becomes immutable
  4. If the server rejects a sync due to duplicate SubGroup code, the user sees a plain-language error and the SubGroup remains local
  5. After sync, the app downloads updated species and other technicians' SubGroups
  6. The number of SubGroups pending sync is always visible without navigating away
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Supabase RPC function for atomic SubGroup sync (idempotency, DUPLICATE_CODE detection), local plantation_users table + migration, SubGroupRepository sync extensions (completed 2026-03-19)
- [ ] 03-02-PLAN.md — SyncService (pull-then-push orchestration, per-SubGroup RPC upload, error accumulation, Spanish error messages), useSync hook, unit tests
- [ ] 03-03-PLAN.md — Dashboard stats (role-gated plantation list, unsynced/total/today counts, pending sync badges), sync CTA + progress modal, tab icon badge (checkpoint)

### Phase 4: Admin + Export
**Goal**: Admins can manage plantations (create, configure species, assign technicians, finalize), generate IDs, and export finalized plantation data to CSV/Excel
**Depends on**: Phase 3
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, IDGN-01, IDGN-02, IDGN-03, IDGN-04, EXPO-01, EXPO-02, EXPO-03
**Success Criteria** (what must be TRUE):
  1. Admin can create a plantation with lugar and periodo, add species from the global catalog (with configurable button order), and assign technicians
  2. Admin can finalize a plantation after all its SubGroups are sincronizada; finalization locks further SubGroup creation
  3. Admin can trigger ID generation after finalization: plantation-sequential IDs and global organization IDs are assigned with a configurable initial seed
  4. Admin can export a finalized plantation to CSV and Excel files containing all required columns (ID Global, ID Parcial, Zona, SubGrupo, SubID, Periodo, Especie)
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — RLS migration for admin operations, install xlsx + expo-sharing, data layer (PlantationRepository, adminQueries, exportQueries, ExportService)
- [ ] 04-02-PLAN.md — Admin management screens (AdminScreen, ConfigureSpeciesScreen, AssignTechniciansScreen) with route wiring and finalization flow
- [ ] 04-03-PLAN.md — ID generation and export wiring into AdminScreen + PlantationDetailScreen, finalization lockout (checkpoint)

### Phase 5: UX Improvements
**Goal**: Connectivity awareness, data freshness checks, complete profile screen, and contextual header titles for field use
**Depends on**: Phase 4
**Requirements**: UX-CONN, UX-FRESH, UX-PROF, UX-HEAD
**Success Criteria** (what must be TRUE):
  1. PlantacionesScreen shows a connectivity icon (cloud) that reflects online/offline state in real time
  2. PlantacionesScreen shows role-aware title ("Mis plantaciones" for tecnico, organization name for admin)
  3. When server has newer data, an inline banner with "Actualizar" button appears on PlantacionesScreen
  4. PerfilScreen shows complete profile card with nombre, email, rol, organizacion, and connectivity status
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Data/logic layer: useNetStatus hook, useProfileData hook with SecureStore cache, freshnessQueries with cooldown, theme colors
- [ ] 05-02-PLAN.md — UI layer: PlantacionesScreen (contextual header, connectivity icon, freshness banner), PerfilScreen (profile card), visual verification checkpoint

### Phase 6: Plantation Catalog + Download
**Goal**: Users can discover server plantations via a catalog screen and batch-download them (plantation + subgroups + trees + species + users) for full offline access — enabling new device setup and cross-device plantation sharing
**Depends on**: Phase 5
**Requirements**: CATL-01, CATL-02, CATL-03, CATL-04, CATL-05, CATL-06
**Success Criteria** (what must be TRUE):
  1. User can tap the connectivity icon when online to open a catalog of server plantations
  2. Catalog shows plantation details (lugar, periodo, estado, subgroup count, tree count) with role-gated visibility (admin: all org, tecnico: assigned only)
  3. Already-downloaded plantations are visually distinct and not selectable
  4. User can select and batch-download plantations with a progress modal showing per-plantation progress
  5. Downloaded plantations appear immediately in the local plantation list with full offline data
  6. Connectivity icon is disabled when offline
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Data layer: catalogQueries (server catalog + local ID lookup), SyncService download extensions (downloadPlantation + batchDownload), unit tests (completed 2026-04-01)
- [x] 06-02-PLAN.md — UI layer: CatalogScreen, CatalogPlantationCard, DownloadProgressModal, route wrappers, PlantacionesScreen icon navigation (completed 2026-04-01)

### Phase 7: Eliminar Plantacion Local
**Goal**: Users can delete downloaded plantations from their phone to manage local storage, with a warning when there is unsynced data that would be lost
**Depends on**: Phase 6
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. User can delete a downloaded plantation from the CatalogScreen via a trash icon on downloaded cards
  2. Deleting removes ALL local data (plantation, subgroups, trees, plantation_species, plantation_users, user_species_order) in a single transaction
  3. If the plantation has unsynced subgroups (activa or finalizada), a warning shows the count before confirming
  4. Both admin and tecnico roles can delete local plantations
  5. The delete is LOCAL ONLY — no data is removed from the server
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — Data layer: deletePlantationLocally (cascade delete transaction), getUnsyncedSubgroupSummary (unsynced detection query)
- [x] 07-02-PLAN.md — UI layer: trash icon on CatalogPlantationCard, confirmation flow with unsynced warning, state refresh

### Phase 8: Login Offline
**Goal**: After a first successful online login, users can log in offline using cached credentials — critical for field use without connectivity
**Depends on**: Phase 7
**Requirements**: OFFL-01, OFFL-02, OFFL-03, OFFL-04, OFFL-05, OFFL-06, OFFL-07
**Success Criteria** (what must be TRUE):
  1. First login requires internet connectivity and validates against Supabase
  2. After successful online login, credentials are cached securely on the device
  3. Subsequent logins work fully offline using cached credentials
  4. Cached credentials are invalidated on explicit logout
  5. Multiple users can have cached credentials on the same device
**Plans**: 2 plans

Plans:
- [x] 08-01-PLAN.md — OfflineAuthService (salted SHA-256 credential cache in SecureStore), TDD with unit tests, expo-crypto mock extension
- [x] 08-02-PLAN.md — Wire into useAuth (connectivity-aware signIn/signOut), update login.tsx (email-only chips, remove plaintext storage), end-to-end verification (checkpoint)

### Phase 10: Creación de plantación offline + sync catálogo de especies

**Goal:** El admin puede crear una plantación estando offline, cargarle subgrupos y data, y sincronizarla al recuperar conexión. Las especies disponibles se sincronizan desde Supabase al SQLite local durante cada sync regular. La asignación de usuarios a plantaciones sigue siendo online-only. El UUID generado localmente se usa al insertar en Supabase (sin migración de IDs).
**Requirements**: OFPL-01, OFPL-02, OFPL-03, OFPL-04, OFPL-05, OFPL-06, OFPL-07, OFPL-08
**Depends on:** Phase 8
**Success Criteria** (what must be TRUE):
  1. Admin can create a plantation while offline — it appears immediately in the local list with a "Pendiente de sync" badge
  2. Admin can configure species on an offline-created plantation (local-only save)
  3. Subgroups and trees can be added to offline-created plantations (existing behavior)
  4. When admin syncs, offline-created plantations are uploaded to Supabase using the locally-generated UUID
  5. Species catalog in local SQLite is refreshed from Supabase during each sync
  6. Technician assignment remains online-only
  7. Admin cannot finalize a plantation until it has been synced to the server
**Plans:** 2/2 plans complete

Plans:
- [x] 10-01-PLAN.md — Schema migration (pendingSync column), data layer functions (createPlantationLocally, saveSpeciesConfigLocally, pullSpeciesFromServer, uploadOfflinePlantations), unit tests
- [x] 10-02-PLAN.md — UI wiring (AdminScreen offline-aware create, pending badge, finalization gate, ConfigureSpeciesScreen offline save, organizacionId caching), visual verification checkpoint

### Phase 9: Testing Strategy
**Goal:** Refactor critical code for testability (eliminate duplication, decompose large screens), then implement comprehensive testing covering offline operations, sync flows, data integrity, and role-based access. Set up CI/CD pipeline in GitHub Actions.
**Depends on:** Phase 8
**Requirements**: TEST-INFRA, TEST-REFACTOR, TEST-INTEGRATION, TEST-UNIT, TEST-E2E, TEST-CI, TEST-CI-E2E
**Success Criteria** (what must be TRUE):
  1. All screen files comply with CLAUDE.md rule 9 (no direct data imports)
  2. TreeRegistrationScreen under 300 lines, AdminScreen under 350 lines
  3. Integration tests pass against real in-memory SQLite for 5 critical flows
  4. Unit tests cover all repositories, critical hooks (useAuth, useSync), and services
  5. 3 Maestro E2E flows exist for critical user journeys
  6. GitHub Actions CI runs lint + unit + integration on every push, E2E on PR to main
  7. Offline auth cycle fully tested: online login caches credentials → offline signOut clears session (not tokens) → offline signIn restores session from cache → cross-instance broadcast works
**Plans**: 6 plans

Plans:
- [x] 09-01-PLAN.md — Test infrastructure: better-sqlite3, integration config, factories, network helper, fix failing tests, GitHub Actions CI
- [ ] 09-02-PLAN.md — Refactor TreeRegistrationScreen: extract useTreeRegistration, useSpeciesOrder, useNNFlow hooks + SpeciesGrid, LastThreeTrees, TreeRegistrationHeader components
- [ ] 09-03-PLAN.md — Refactor AdminScreen, PlantationDetailScreen + fix CLAUDE.md violations in 6 screens: extract 6 hooks
- [ ] 09-04-PLAN.md — Integration tests: SubGroup lifecycle, sync pipeline, cascade delete, tree registration, role-based access (real SQLite), offline auth full cycle (login→signOut→signIn with cached creds)
- [ ] 09-05-PLAN.md — Unit tests: TreeRepository, PlantationSpeciesRepository, UserSpeciesOrderRepository, PhotoService, useAuth (offline signIn/signOut, cross-instance broadcast, token persistence, timeout fallback), useSync, useTreeRegistration
- [ ] 09-06-PLAN.md — Maestro E2E flows (login offline, register tree, sync subgroup), testIDs, GitHub Actions E2E workflow

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 10 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth | 3/3 | Complete    | 2026-03-17 |
| 2. Field Registration | 4/4 | Complete    | 2026-03-17 |
| 3. Sync + Dashboard | 2/3 | Complete    | 2026-03-19 |
| 4. Admin + Export | 3/3 | Complete    | 2026-03-20 |
| 5. UX Improvements | 2/2 | Complete   | 2026-03-29 |
| 6. Plantation Catalog + Download | 2/2 | Complete | 2026-04-01 |
| 7. Eliminar Plantacion Local | 2/2 | Complete | 2026-04-06 |
| 8. Login Offline | 2/2 | Complete   | 2026-04-06 |
| 10. Plantación offline + sync especies | 2/2 | Complete    | 2026-04-08 |
| 9. Testing Strategy | 1/6 | In Progress|  |
