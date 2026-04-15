# Codebase Structure

**Analysis Date:** 2026-04-12

## Directory Layout

```
bayka-app-redesign/
├── mobile/                           # Main React Native + Expo app
│   ├── app/                          # Expo Router (file-based routing)
│   │   ├── _layout.tsx              # Root layout: migrations, auth, fonts, seeding
│   │   ├── index.tsx                # Placeholder (redirected by routing logic)
│   │   ├── (auth)/                  # Auth group (public routes)
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx            # Login screen
│   │   ├── (tecnico)/               # Tecnico routes (technician role)
│   │   │   ├── _layout.tsx          # Tab layout: plantaciones, perfil
│   │   │   ├── plantaciones.tsx     # Imports PlantacionesScreen
│   │   │   ├── perfil.tsx           # Imports PerfilScreen
│   │   │   └── plantation/          # Nested routes
│   │   │       ├── [id].tsx         # Plantation detail
│   │   │       ├── catalog.tsx      # Catalog download
│   │   │       ├── nuevo-subgrupo.tsx
│   │   │       └── subgroup/        # Tree registration
│   │   │           └── [id].tsx     # Tree registration screen
│   │   └── (admin)/                 # Admin routes (admin role only)
│   │       ├── _layout.tsx          # Tab layout: plantaciones, perfil
│   │       ├── plantaciones.tsx     # Imports shared PlantacionesScreen
│   │       └── plantation/          # Admin-enhanced routes
│   │           └── [id].tsx         # Admin plantation detail
│   │
│   ├── src/                         # Source code organized by layer
│   │   ├── theme.ts                 # CENTRALIZED: colors, spacing, fonts, border radius
│   │   ├── types/
│   │   │   └── domain.ts            # Role, UserProfile, Session types
│   │   ├── config/
│   │   │   └── offlineLogin.ts      # Offline TTL configuration
│   │   │
│   │   ├── database/                # Local SQLite + Drizzle ORM
│   │   │   ├── schema.ts            # Table definitions (7 tables)
│   │   │   ├── client.ts            # Drizzle client initialization
│   │   │   ├── liveQuery.ts         # useLiveData hook + notifyDataChanged
│   │   │   └── seeds/               # Database seed functions
│   │   │       ├── seedSpecies.ts
│   │   │       ├── seedPlantation.ts
│   │   │       └── seedPlantationSpecies.ts
│   │   │
│   │   ├── supabase/                # Supabase client & auth
│   │   │   ├── client.ts            # Supabase JS client init
│   │   │   └── auth.ts              # Session persist/restore from SecureStore
│   │   │
│   │   ├── repositories/            # Database mutations (insert, update, delete)
│   │   │   ├── TreeRepository.ts           # insertTree, deleteLastTree, reverseTreeOrder, etc.
│   │   │   ├── SubGroupRepository.ts       # insertSubGroup, deleteSubGroup, markAsSincronizada
│   │   │   ├── PlantationRepository.ts     # insertPlantation, finalizePlantation, deleteLocally
│   │   │   ├── PlantationSpeciesRepository.ts
│   │   │   └── UserSpeciesOrderRepository.ts
│   │   │
│   │   ├── queries/                 # Database reads (SELECT queries)
│   │   │   ├── dashboardQueries.ts         # getPlantationsForRole, getTodayTreeCounts, etc.
│   │   │   ├── plantationDetailQueries.ts  # getSubgroupsForPlantation, getTreeCountsPerSubgroup
│   │   │   ├── catalogQueries.ts           # getUnsyncedSubgroupSummary, getSyncedCountsPerPlantation
│   │   │   ├── adminQueries.ts             # Admin-specific reports
│   │   │   └── freshnessQueries.ts         # checkFreshness, lastModified times
│   │   │
│   │   ├── services/                # Business logic & coordination
│   │   │   ├── SyncService.ts              # 758 lines: upload offline entities, download server data, photo sync
│   │   │   ├── OfflineAuthService.ts       # Credential caching, offline login validation, TTL
│   │   │   ├── PhotoService.ts             # Photo capture, resize, local storage
│   │   │   └── ExportService.ts            # XLSX export generation
│   │   │
│   │   ├── hooks/                   # React hooks (26 files)
│   │   │   ├── useAuth.ts                  # Session, role, signIn, signOut, offline fallback
│   │   │   ├── useTreeRegistration.ts      # Tree add, delete, resolve N/N, finalize subgroup
│   │   │   ├── usePlantaciones.ts          # Plantation list, filters, stats, sync orchestration
│   │   │   ├── usePlantationAdmin.ts       # Admin-specific plantation operations
│   │   │   ├── usePlantationDetail.ts      # Single plantation detail view
│   │   │   ├── useLiveData.ts              # (in database/liveQuery.ts) Reactive data hook
│   │   │   ├── useSync.ts                  # Sync orchestration
│   │   │   ├── useCatalog.ts               # Catalog download/import
│   │   │   ├── useSpeciesConfig.ts         # Species order management
│   │   │   ├── useNNResolution.ts          # N/N tree resolution
│   │   │   └── 18 others: useNNFlow, useNewSubgroup, useConfirm, etc.
│   │   │
│   │   ├── screens/                 # Screen components (NOT route files)
│   │   │   ├── PlantacionesScreen.tsx      # Plantation list (shared by admin/tecnico)
│   │   │   ├── PlantationDetailScreen.tsx  # Single plantation detail
│   │   │   ├── TreeRegistrationScreen.tsx  # Tree registration UI
│   │   │   ├── PerfilScreen.tsx            # User profile
│   │   │   ├── ConfigureSpeciesScreen.tsx  # Species order management
│   │   │   ├── CatalogScreen.tsx           # Catalog download UI
│   │   │   ├── NNResolutionScreen.tsx      # N/N tree resolution
│   │   │   ├── AssignTechniciansScreen.tsx # Admin: assign techs to plantation
│   │   │   ├── NuevoSubgrupoScreen.tsx     # Create new subgroup
│   │   │   └── others: PlaceholderScreen, etc.
│   │   │
│   │   ├── components/              # Reusable UI components (38 files)
│   │   │   ├── TreeRowItem.tsx             # Single tree row (extracted from TreeRow for reuse)
│   │   │   ├── TreeRow.tsx                 # Tree list rendering
│   │   │   ├── PlantationCard.tsx          # Plantation card (basic info + stats)
│   │   │   ├── CatalogPlantationCard.tsx   # Catalog plantation card (download UI)
│   │   │   ├── PlantationConfigCard.tsx    # Admin plantation config modal
│   │   │   ├── PlantationFormModal.tsx     # Create/edit plantation modal
│   │   │   ├── AdminBottomSheet.tsx        # Admin actions bottom sheet
│   │   │   ├── AdminPlantationModals.tsx   # Admin modal orchestration
│   │   │   ├── SubgrupoForm.tsx            # Subgroup form (create/edit)
│   │   │   ├── SpeciesReorderList.tsx      # Reorderable species list
│   │   │   ├── SpeciesReorderModal.tsx     # Species reorder UI
│   │   │   ├── SpeciesButtonGrid.tsx       # Grid of species selection buttons
│   │   │   ├── ConfirmModal.tsx            # Custom confirmation modal
│   │   │   ├── SyncProgressModal.tsx       # Sync progress feedback (downloading/uploading)
│   │   │   ├── DownloadProgressModal.tsx   # Photo/catalog download progress
│   │   │   ├── PhotoViewerModal.tsx        # Lightbox for photos
│   │   │   ├── PhotoViewer.tsx             # Photo display component
│   │   │   ├── TreeListModal.tsx           # Searchable tree list modal
│   │   │   ├── TreeConfigModal.tsx         # Tree photo/species config
│   │   │   ├── FilterCards.tsx             # Estado filter chips (activa/finalizada)
│   │   │   ├── ScreenHeader.tsx            # Reusable header (title + sync status)
│   │   │   ├── ScreenContainer.tsx         # Safe area wrapper
│   │   │   ├── FormField.tsx               # Input field wrapper
│   │   │   ├── CheckboxRow.tsx             # Checkbox row component
│   │   │   ├── PlantacionesTabIcon.tsx     # Custom tab icon with badge
│   │   │   ├── StatusChip.tsx              # State badge (activa/finalizada/sincronizada)
│   │   │   ├── TreeIcon.tsx                # Tree icon with species color
│   │   │   ├── ReadOnlyTreeView.tsx        # Finalized subgroup tree list (no edit)
│   │   │   ├── LastThreeTrees.tsx          # Recent trees chip
│   │   │   ├── PlantationDetailHeader.tsx  # Plantation header with nav
│   │   │   ├── CustomHeader.tsx            # Custom react-navigation header
│   │   │   ├── TexturedBackground.tsx      # Branded background texture
│   │   │   ├── TipoSegmentedControl.tsx    # Subgroup type selector
│   │   │   └── others: AdminModalWrapper, PlantationEstadoChip
│   │   │
│   │   ├── utils/                   # Utility functions
│   │   │   ├── dateUtils.ts                # localNow(), localToday() - timezone-safe
│   │   │   ├── idGenerator.ts              # generateSubId(codigo, species, posicion)
│   │   │   ├── alertHelpers.ts             # showConfirmDialog, showDoubleConfirmDialog
│   │   │   ├── speciesHelpers.ts           # Species-related helpers
│   │   │   └── reverseOrder.ts             # Tree order reversal logic
│   │   │
│   ├── drizzle/                      # Drizzle ORM migrations
│   │   ├── 0000_initial.sql         # Initial schema (7 tables)
│   │   ├── migrations.js             # Migration loader (CRITICAL for splash screen)
│   │   └── meta/                     # Migration metadata
│   │
│   ├── tests/                        # Test files (mirrors src structure)
│   │   ├── auth/                     # Auth tests
│   │   ├── queries/                  # Query tests
│   │   ├── repositories/             # Repository tests
│   │   ├── services/                 # Service tests (SyncService, etc.)
│   │   ├── screens/                  # Screen tests
│   │   ├── components/               # Component tests
│   │   ├── hooks/                    # Hook tests
│   │   ├── database/                 # Database & migration tests
│   │   ├── integration/              # End-to-end flow tests
│   │   └── __mocks__/                # Mock utilities
│   │
│   ├── .maestro/                     # Maestro E2E test flows (YAML)
│   │   ├── flows/                    # Test flow definitions
│   │   └── helpers/                  # Flow helper functions
│   │
│   ├── assets/                       # Static assets
│   │   ├── images/                   # App images
│   │   └── fonts/                    # Custom fonts (LinBiolinum)
│   │
│   ├── app.json                      # Expo config
│   ├── eas.json                      # EAS Build config
│   ├── package.json                  # Dependencies, scripts
│   ├── tsconfig.json                 # TypeScript config
│   └── jest.config.js                # Jest testing config
│
├── supabase/                        # Backend: migrations, seed data
│   ├── migrations/                  # SQL migrations for Supabase
│   └── seed.ts                      # Seed script (users, roles)
│
├── .planning/                       # GSD planning documents
│   ├── codebase/                    # Architecture docs (this file)
│   │   ├── ARCHITECTURE.md
│   │   ├── STRUCTURE.md
│   │   └── (others)
│   ├── research/                    # Research notes
│   └── quick/                       # Quick fixes & decisions
│
├── docs/                            # Project documentation
├── .github/workflows/               # GitHub Actions (CI/CD)
├── package.json                     # Root workspace config (seed script)
└── README.md                        # Project overview
```

## Directory Purposes

**`mobile/app`:**
- Purpose: Expo Router file-based routing. Each file exports a component that becomes a route.
- Contains: Route handlers organized by auth group `(auth)`, role group `(admin)`, `(tecnico)`
- Key files: `_layout.tsx` (root setup), role-specific `_layout.tsx` (navigation structure)

**`mobile/src`:**
- Purpose: Layered application code. Single source of truth per layer.
- Contains: repositories (mutations), queries (reads), services (business logic), hooks (state), screens (views), components (reusable UI)

**`mobile/src/database`:**
- Purpose: SQLite persistence and reactive updates
- Key files: `schema.ts` (table definitions), `client.ts` (Drizzle init), `liveQuery.ts` (useLiveData hook)

**`mobile/src/repositories`:**
- Purpose: **ONLY** insert, update, delete operations
- Pattern: Each repository file exports pure async functions. All mutations flow through here.
- Key files: `TreeRepository.ts` (tree mutations), `SubGroupRepository.ts` (subgroup mutations)

**`mobile/src/queries`:**
- Purpose: **ONLY** SELECT operations and aggregations
- Pattern: Each query module exports pure async functions. No side effects.
- Key files: `dashboardQueries.ts` (main lists), `plantationDetailQueries.ts` (detail stats)

**`mobile/src/services`:**
- Purpose: Business logic that coordinates multiple repositories/queries
- Key files: `SyncService.ts` (upload/download/sync orchestration), `OfflineAuthService.ts` (credential caching)

**`mobile/src/hooks`:**
- Purpose: React state management and data-layer bridges
- Pattern: Call repositories/queries, manage React state, return data + handlers
- Key files: `useAuth.ts` (session), `useTreeRegistration.ts` (tree flow), `usePlantaciones.ts` (main list)

**`mobile/src/screens`:**
- Purpose: Screen-level components (NOT route handlers). Import hooks, render UI.
- Key files: `PlantacionesScreen.tsx` (main list), `TreeRegistrationScreen.tsx` (tree registration)
- Rule: ZERO database imports. All queries via hooks.

**`mobile/src/components`:**
- Purpose: Reusable, presentational UI components. No data fetching.
- Key files: `PlantationCard.tsx`, `TreeRow.tsx`, `ConfirmModal.tsx`
- Rule: Parametrize with props, no hooks except layout/animation hooks.

**`mobile/src/theme.ts`:**
- Purpose: **SINGLE source of truth** for all styling
- Contains: colors (4 palette sections), spacing, fonts, border radius, header styles
- Usage: All screens/components import and reference theme values. NO hardcoded colors.

**`mobile/src/utils`:**
- Purpose: Pure utility functions used across layers
- Key files: `dateUtils.ts` (timezone-safe date), `idGenerator.ts` (SubID generation)

**`mobile/drizzle`:**
- Purpose: Drizzle ORM migrations and metadata
- Key files: `migrations.js` (loaded by `useMigrations()` in app/_layout.tsx - CRITICAL)
- Note: Missing `migrations.js` = silent splash screen hang

**`mobile/tests`:**
- Purpose: Test files mirroring src/ structure
- Key files: `tests/queries/`, `tests/repositories/`, `tests/services/`
- Pattern: Jest + @testing-library/react-native

## Key File Locations

**Entry Points:**
- `mobile/app/_layout.tsx`: Root layout. Sets up migrations, auth, fonts.
- `mobile/app/(auth)/login.tsx`: Login screen
- `mobile/app/(tecnico)/_layout.tsx`: Tecnico main navigation (tabs)
- `mobile/app/(admin)/_layout.tsx`: Admin main navigation (tabs)
- `mobile/app/(tecnico)/plantaciones.tsx`: Imports `src/screens/PlantacionesScreen`

**Configuration:**
- `mobile/src/theme.ts`: Colors, spacing, fonts, borders (CENTRALIZED)
- `mobile/src/config/offlineLogin.ts`: Offline TTL settings
- `mobile/src/types/domain.ts`: TypeScript interfaces
- `mobile/app.json`: Expo app configuration
- `mobile/eas.json`: EAS Build configuration

**Core Logic:**
- `mobile/src/database/schema.ts`: SQLite table definitions (7 tables)
- `mobile/src/database/client.ts`: Drizzle ORM client
- `mobile/src/database/liveQuery.ts`: useLiveData hook (reactive queries)
- `mobile/src/hooks/useAuth.ts`: Authentication (session, offline fallback)
- `mobile/src/services/SyncService.ts`: Sync orchestration (758 lines, largest file)

**Testing:**
- `mobile/tests/`: Mirror of src/ structure, 10+ test directories
- `mobile/.maestro/`: Maestro E2E flows (YAML)
- `mobile/jest.config.js`: Jest configuration

## Naming Conventions

**Files:**
- Screens: `[Name]Screen.tsx` (e.g., `PlantacionesScreen.tsx`, `TreeRegistrationScreen.tsx`)
- Components: `[Name].tsx` (e.g., `PlantationCard.tsx`, `ConfirmModal.tsx`)
- Hooks: `use[Name].ts` (e.g., `useAuth.ts`, `useTreeRegistration.ts`)
- Repositories: `[Entity]Repository.ts` (e.g., `TreeRepository.ts`, `SubGroupRepository.ts`)
- Queries: `[Domain]Queries.ts` (e.g., `dashboardQueries.ts`, `plantationDetailQueries.ts`)
- Services: `[Name]Service.ts` (e.g., `SyncService.ts`, `OfflineAuthService.ts`)
- Utils: `[name]Utils.ts` or `[name].ts` (e.g., `dateUtils.ts`, `alertHelpers.ts`)
- Database: `schema.ts`, `client.ts`, `liveQuery.ts`, `seeds/seed[Name].ts`

**Directories:**
- Routes: `(auth)`, `(tecnico)`, `(admin)` (grouped routes in Expo Router)
- Nested routes: `plantation/`, `subgroup/` (singular entity names)
- Layer directories: `hooks`, `screens`, `components`, `repositories`, `queries`, `services`, `utils`

**TypeScript:**
- Types: `Role`, `UserProfile`, `Session`, `Plantation`, `SubGroup`, `Tree` (PascalCase)
- Interfaces: `InsertTreeParams`, `SyncProgress` (describe data shape)
- Enums: Not used (use string literal types instead)

**Database:**
- Tables: `plantations`, `subgroups`, `trees`, `species` (snake_case in schema, camelCase in code)
- Columns: `created_at`, `usuario_registro`, `plantacion_id` (snake_case in SQLite)
- Indices: `subgroups_plantation_code_unique` (descriptive)

## Where to Add New Code

**New Feature (e.g., "Add tree photo gallery"):**
- Primary code:
  - `mobile/src/components/TreePhotoGallery.tsx` (UI component)
  - `mobile/src/screens/TreePhotoScreen.tsx` (if full screen)
  - Update `mobile/src/repositories/TreeRepository.ts` if new mutations needed
- Tests:
  - `mobile/tests/components/TreePhotoGallery.test.tsx`
- Routes:
  - `mobile/app/(tecnico)/plantation/subgroup/photos.tsx` (if adding new route)
- Styling:
  - Import from `mobile/src/theme.ts` only, NO hardcoded colors

**New Component/Module:**
- Implementation: `mobile/src/components/[ComponentName].tsx` if presentational
- Implementation: `mobile/src/screens/[ScreenName].tsx` if full screen
- Tests: `mobile/tests/components/[ComponentName].test.tsx` or `mobile/tests/screens/[ScreenName].test.tsx`
- Pattern: Import theme, accept props for customization, zero database imports

**New Hook:**
- Implementation: `mobile/src/hooks/use[HookName].ts`
- Tests: `mobile/tests/hooks/use[HookName].test.ts`
- Pattern: Call repositories/queries, return typed result + handlers
- Export: Default export of hook function

**New Query (read-only):**
- Implementation: Add to existing `mobile/src/queries/[Domain]Queries.ts` or create new file
- Tests: `mobile/tests/queries/[Domain].test.ts`
- Pattern: Pure async function, no side effects, return typed result
- Export: Named export

**New Mutation (insert/update/delete):**
- Implementation: Add to existing `mobile/src/repositories/[Entity]Repository.ts` or create new file
- Tests: `mobile/tests/repositories/[Entity]Repository.test.ts`
- Pattern: Call `notifyDataChanged()` after mutation to trigger UI refresh
- Export: Named export

**New Service (business logic):**
- Implementation: `mobile/src/services/[Name]Service.ts`
- Tests: `mobile/tests/services/[Name]Service.test.ts`
- Pattern: Coordinate multiple repositories/queries, handle errors, return result
- Export: Named exports for each function

**Utilities:**
- Implementation: Add to existing `mobile/src/utils/[name].ts` or create new file
- Pattern: Pure functions, no side effects
- Export: Named exports

## Special Directories

**`mobile/drizzle/`:**
- Purpose: Drizzle ORM migrations and metadata
- Generated: Partially (migrations.js is auto-generated, but needs to be committed)
- Committed: **Yes** — migrations.js is checked in (CRITICAL: app/_layout.tsx imports it directly)
- When to edit: Run `drizzle-kit generate:sqlite` after schema.ts changes, then commit migrations.js

**`mobile/dist/`:**
- Purpose: Built Expo Web output (generated by `expo build:web`)
- Generated: Yes (by build process)
- Committed: No (add to .gitignore)

**`mobile/.expo/`:**
- Purpose: Expo CLI cache
- Generated: Yes (by Expo CLI)
- Committed: No

**`mobile/tests/`:**
- Purpose: Jest unit and integration tests
- Generated: No (manually written)
- Committed: Yes — test files are source code

**`mobile/.maestro/`:**
- Purpose: Maestro E2E flows (alternative to Detox)
- Generated: No (manually written YAML)
- Committed: Yes
- When to add: New critical user flows (login, tree registration, sync)

---

*Structure analysis: 2026-04-12*
