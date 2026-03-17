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
- [ ] **Phase 3: Sync + Dashboard** - Manual sync with atomic SubGroup upload, conflict detection, plantation dashboard with stats
- [ ] **Phase 4: Admin + Export** - Admin plantation management, ID generation, CSV/Excel export

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
**Plans**: TBD

Plans:
- [ ] 03-01: Supabase RPC function for atomic SubGroup sync (server-side Postgres transaction, idempotency key, RLS, conflict detection)
- [ ] 03-02: SyncService (outbox written atomically with domain write, pull-then-push order, conflict error surface, sincronizada state mark)
- [ ] 03-03: Dashboard screens (plantation list for tecnico and admin, stats live queries, pending sync badge, sync trigger CTA)

### Phase 4: Admin + Export
**Goal**: Admins can manage plantations (create, configure species, assign technicians, finalize), generate IDs, and export finalized plantation data to CSV/Excel
**Depends on**: Phase 3
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, IDGN-01, IDGN-02, IDGN-03, IDGN-04, EXPO-01, EXPO-02, EXPO-03
**Success Criteria** (what must be TRUE):
  1. Admin can create a plantation with lugar and periodo, add species from the global catalog (with configurable button order), and assign technicians
  2. Admin can finalize a plantation after all its SubGroups are sincronizada; finalization locks further SubGroup creation
  3. Admin can trigger ID generation after finalization: plantation-sequential IDs and global organization IDs are assigned with a configurable initial seed
  4. Admin can export a finalized plantation to CSV and Excel files containing all required columns (ID Global, ID Parcial, Zona, SubGrupo, SubID, Periodo, Especie)
**Plans**: TBD

Plans:
- [ ] 04-01: Admin plantation management screens (create, species config with order, technician assignment, finalize action)
- [ ] 04-02: ID generation service + admin trigger (plantation-sequential + global org IDs, seed configuration)
- [ ] 04-03: Export service (CSV + Excel generation with required columns, export available only on finalized plantations)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth | 3/3 | Complete    | 2026-03-17 |
| 2. Field Registration | 4/4 | Complete   | 2026-03-17 |
| 3. Sync + Dashboard | 0/3 | Not started | - |
| 4. Admin + Export | 0/3 | Not started | - |
