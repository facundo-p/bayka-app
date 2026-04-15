# Architecture

**Analysis Date:** 2026-04-12

## Pattern Overview

**Overall:** Multi-layered mobile application with offline-first capability, role-based access control (admin/tecnico), and syncing coordination between local SQLite database and Supabase backend.

**Key Characteristics:**
- Offline-first architecture: all data reads from local SQLite, syncs to Supabase when online
- Strict separation of concerns: repositories (mutations), queries (reads), services (business logic)
- Custom auth system with offline login fallback and cross-instance broadcast for auth state
- Reactive data layer: useLiveData hook triggers re-fetches on mount, focus, and data changes
- Screen-agnostic components: no database queries in screens or components
- Centralized theme and styling (single source of truth for colors, spacing, typography)

## Layers

**Presentation Layer:**
- Purpose: UI components and screen containers
- Location: `mobile/app` (route handlers via Expo Router), `mobile/src/screens`, `mobile/src/components`
- Contains: Screen components, reusable UI components, modals, animations
- Depends on: Hooks, services, theme
- Used by: User interaction flows

**Hooks Layer:**
- Purpose: Data access and state management bridges
- Location: `mobile/src/hooks`
- Contains: 26+ custom hooks that call queries/repositories and manage React state
- Examples: `useAuth`, `useTreeRegistration`, `usePlantaciones`, `usePlantationAdmin`, `useLiveData`
- Depends on: Repositories, queries, services, database, Supabase
- Used by: Screens and components

**Business Logic Layer:**
- Purpose: Coordination of data mutations and complex operations
- Location: `mobile/src/services`
- Contains: 4 services for offline auth, syncing, photo handling, and export
- Key files:
  - `SyncService.ts` (758 lines): uploads offline-created entities, downloads from server, syncs photos
  - `OfflineAuthService.ts`: cached credentials, offline login validation, TTL management
  - `PhotoService.ts`: captures, stores, and resizes photos
  - `ExportService.ts`: generates XLSX exports
- Depends on: Repositories, queries, database, Supabase
- Used by: Hooks and screens

**Data Access Layer - Repositories:**
- Purpose: Database mutations (insert, update, delete)
- Location: `mobile/src/repositories`
- Contains: 5 repositories for entities (Plantation, SubGroup, Tree, User, Species)
- Examples: `TreeRepository.insertTree()`, `PlantationRepository.insertOfflineSync()`, `SubGroupRepository.markAsSincronizada()`
- Pattern: Each repository exports pure async functions, calls `notifyDataChanged()` after mutations
- Depends on: Database client, schema, utils
- Used by: Services, hooks

**Data Access Layer - Queries:**
- Purpose: Database reads and aggregations
- Location: `mobile/src/queries`
- Contains: 5 query modules for different domains
  - `dashboardQueries.ts`: plantation lists filtered by role, tree stats
  - `plantationDetailQueries.ts`: subgroup queries, tree counts per subgroup
  - `catalogQueries.ts`: unsynced/synced counts, fresh/stale data checks
  - `adminQueries.ts`: admin-specific reports (tech assignments, state tracking)
  - `freshnessQueries.ts`: last-modified timestamps for freshness detection
- Examples: `getPlantationsForRole()`, `getTodayTreesForUser()`, `getNNCountsPerSubgroup()`
- Pattern: Returns raw query results, no business logic
- Depends on: Database client, schema, utils
- Used by: Hooks, services

**Database Layer:**
- Purpose: Local SQLite persistence and reactive updates
- Location: `mobile/src/database`
- Contains:
  - `schema.ts`: Drizzle ORM table definitions (7 tables: species, plantations, subgroups, trees, plantation_species, user_species_order, plantation_users)
  - `client.ts`: Drizzle client initialization
  - `liveQuery.ts`: Custom reactive hook `useLiveData` replaces drizzle-orm's unreliable useLiveQuery
  - `seeds/`: Database seeding functions for species, plantations, plantation_species
- Depends on: Expo SQLite, Drizzle ORM
- Used by: Repositories, queries

**External Integration Layer:**
- Purpose: Supabase interaction (auth, realtime, storage, REST)
- Location: `mobile/src/supabase`
- Contains:
  - `client.ts`: Supabase JS client initialization with environment config check
  - `auth.ts`: Session persistence/restoration from SecureStore, role/email caching
- Depends on: Supabase JS SDK, Expo SecureStore
- Used by: useAuth hook, SyncService, services

**Configuration & Types:**
- Purpose: Centralized theme, offline config, domain types
- Location: `mobile/src/theme.ts`, `mobile/src/config`, `mobile/src/types`
- Contains:
  - `theme.ts`: Colors (primary blue, secondary green, semantic states), spacing, fonts, border radius
  - `offlineLogin.ts`: TTL configuration for offline login expiration
  - `domain.ts`: TypeScript interfaces (Role, UserProfile, Session)

**Utilities:**
- Purpose: Reusable functions (date handling, ID generation, alerts, sorting)
- Location: `mobile/src/utils`
- Contains: 6 utility modules
  - `dateUtils.ts`: `localNow()`, `localToday()` for timezone-safe operations
  - `idGenerator.ts`: Generates SubID from codigo + posicion
  - `alertHelpers.ts`: Wrapper for React Native Alert with Spanish messages
  - `speciesHelpers.ts`: Species-related utility functions
  - Others: reverseOrder, form validation

## Data Flow

**Tree Registration Flow (write):**

1. User navigates to `TreeRegistrationScreen` with subgrupoId, plantacionId, subgrupoCodigo
2. Screen calls hook `useTreeRegistration` (renders from `mobile/src/hooks/useTreeRegistration.ts`)
3. Hook fetches existing trees via `useLiveData` calling query functions
4. User taps species button → hook calls `TreeRepository.insertTree()`
5. Repository queries MAX posicion from database, generates SubID, inserts tree row
6. Repository calls `notifyDataChanged()` → triggers `useLiveData` refresh
7. Screen re-renders with updated tree list
8. If photo added: saved to local filesystem, `fotoUrl` set to file:// URI
9. If offline when created: `fotoSynced: false`
10. When online: `SyncService.uploadPhotosToStorage()` uploads to Supabase Storage, updates `fotoUrl` to https://, sets `fotoSynced: true`

**Plantation Sync Flow (write then read):**

1. User adds subgroup offline (no internet)
   - `SubGroupRepository.insertSubGroup()` saves to SQLite with `estado: 'activa'`
   - `notifyDataChanged()` triggers UI refresh
2. Device comes online
3. `SyncService.syncOfflineSubgroups()` uploads subgroup to Supabase
   - If duplicate code: returns error, user must rename
   - If success: marks `sincronizada: true` locally
4. `SyncService.pullFromServer()` downloads new data from server
   - Fetches species, subgroups, trees, plantation_users for plantation
   - Upserts into local SQLite
   - `notifyDataChanged()` refresh UIs

**Auth Flow (session management):**

1. App starts → `_layout.tsx` calls `useAuth()`
2. useAuth initializes:
   - Checks NetInfo.isConnected
   - If online: tries `supabase.auth.getSession()`, falls back to SecureStore cache if timeout
   - If offline: restores from SecureStore only (ZERO network calls)
3. Fetches role from `supabase.from('profiles').select('rol')`, caches in SecureStore
4. If `onAuthStateChange` fires SIGNED_OUT while offline: **ignored** (false positive)
5. useAuth broadcasts session changes via `authChangeListeners` (cross-instance sync)
6. Segments-based routing redirects to `/(auth)/login`, `/(admin)/*`, or `/(tecnico)/*`

**Offline Login Flow:**

1. Device offline, user taps login
2. `useAuth.signIn()` checks `NetInfo.isConnected === false` → calls `handleOfflineSignIn()`
3. `verifyCredential()` checks cached credentials and role
4. Returns cached session if credentials match and TTL not expired
5. User authenticated locally, navigates to home tab

**State Management Strategy:**

- **Server source-of-truth:** Supabase (plantations, trees, roles)
- **Local cache:** SQLite (exact copy of server, plus offline-created rows with `pendingSync: true`)
- **Reactive triggers:** `useLiveData` hook + `notifyDataChanged()` broadcasts
- **Component state:** Only for UI-only state (modals, filters, loading)
- **Cross-instance sync:** `authChangeListeners` Set broadcasts auth changes to all React instances

## Key Abstractions

**Repository Pattern:**
- Purpose: Encapsulate all database writes
- Examples: `TreeRepository.ts`, `SubGroupRepository.ts`, `PlantationRepository.ts`
- Pattern: Pure async functions with typed params/returns, call `notifyDataChanged()` after mutations
- File: `mobile/src/repositories/[Entity]Repository.ts`

**Query Functions:**
- Purpose: Encapsulate all database reads and aggregations
- Examples: `getTodayTreesForUser()`, `getPlantationsForRole()`, `getNNCountsPerSubgroup()`
- Pattern: Pure async functions returning typed results, no side effects
- Files: `mobile/src/queries/*Queries.ts`

**useLiveData Hook:**
- Purpose: Reactive queries that refresh on mount, focus, and data changes
- Pattern: `const { data, refresh } = useLiveData(fetcher, [deps])`
- Example: `useLiveData(() => getPlantationsForRole(isAdmin, userId), [userId, isAdmin])`
- File: `mobile/src/database/liveQuery.ts`

**notifyDataChanged() Broadcast:**
- Purpose: Notify all useLiveData hooks to refresh without manual refresh calls
- Pattern: Repositories call `notifyDataChanged()` after mutations
- File: `mobile/src/database/liveQuery.ts`

**Role-Based Screen Structure:**
- Pattern: Admin/tecnico have separate routes but import shared screens
- Files: `mobile/app/(admin)/plantaciones.tsx` → imports `mobile/src/screens/PlantacionesScreen`
- Screens parametrized by role via `useRoutePrefix()` hook

## Entry Points

**App Startup:**
- Location: `mobile/app/_layout.tsx`
- Triggers: App launch
- Responsibilities:
  1. Loads fonts (Poppins, LinBiolinum)
  2. Runs Drizzle migrations via `useMigrations()`
  3. Seeds species, plantations, plantation_species if needed
  4. Initializes auth via `useAuth()`
  5. Redirects to login, admin, or tecnico layout based on session + role

**Authentication:**
- Location: `mobile/app/(auth)/login.tsx` → calls `useAuth.signIn()`
- Responsibilities: Username/password input, offline fallback, role assignment

**Admin Layout:**
- Location: `mobile/app/(admin)/_layout.tsx`
- Tabs: Plantaciones (with admin features), Perfil
- Routes: plantation, subgroup with additional admin-only modals

**Tecnico Layout:**
- Location: `mobile/app/(tecnico)/_layout.tsx`
- Tabs: Plantaciones (read-only), Perfil
- Routes: plantation, subgroup, tree registration

**Plantation Detail:**
- Location: `mobile/app/(tecnico|admin)/plantation/[id].tsx` → `PlantationDetailScreen`
- Responsibilities: Lists subgroups, stats, tree counts, sync status

**Tree Registration:**
- Location: `mobile/app/(tecnico|admin)/plantation/subgroup/[id].tsx` → `TreeRegistrationScreen`
- Responsibilities: Species selection grid, tree list, photo capture, N/N resolution

## Error Handling

**Strategy:** Try-catch in services, graceful degradation on network errors, display user alerts in Spanish.

**Patterns:**

**Network Errors (Sync):**
```typescript
// SyncService.ts
try {
  const result = await supabase.from('subgroups').insert({...});
  if (error?.code === '23505') { // unique constraint violation
    return { success: false, error: 'DUPLICATE_CODE' };
  }
} catch (e) {
  console.error('[Sync] Upload failed:', e);
  return { success: false, error: 'NETWORK' };
}
```

**Auth Errors (Offline Fallback):**
```typescript
// useAuth.ts
try {
  const result = await withTimeout(supabase.auth.signInWithPassword(...), LOGIN_TIMEOUT);
  if (!result.error) { /* online success */ }
} catch {
  // Timeout or network error → fall back to offline
  return handleOfflineSignIn(email, password);
}
```

**Query Errors (Non-Blocking):**
```typescript
// SyncService.ts - pullSpeciesFromServer
const { data, error } = await supabase.from('species').select('*');
if (error || !data) return; // Non-blocking — stale catalog is acceptable
```

**State Errors (Guards):**
```typescript
// TreeRepository.ts - deleteLastTree
if (maxResult?.id == null) return { deleted: false }; // Graceful no-op
```

**User-Facing Alerts:**
```typescript
// alertHelpers.ts - showConfirmDialog
Alert.alert(title, message, [
  { text: 'Cancelar', style: 'cancel' },
  { text: 'Confirmar', onPress: action }
]);
```

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.error()`, `console.warn()` with prefixes `[Auth]`, `[Sync]`, `[SyncService]`
- Pattern: Error logging only, no verbose logging in production

**Validation:**
- Input validation: Done at repository entry (e.g., check `especieId` not null for tree)
- Schema validation: Drizzle ORM enforces via table definitions
- Role validation: `useRoutePrefix()` checks route to determine admin/tecnico, `useAuth()` provides role

**Authentication:**
- Session management: `useAuth` hook manages login/logout/role assignment
- Offline auth: SecureStore cache + credential verification
- Token persistence: SecureStore (secure) + AsyncStorage (Supabase SDK state)
- Token refresh: Supabase SDK auto-refresh when online

**State Synchronization:**
- Cross-instance sync: `authChangeListeners` broadcast auth changes
- Data sync: `notifyDataChanged()` broadcast tells all useLiveData to refresh
- Offline marker: `pendingSync`, `pendingEdit` boolean flags on plantations/subgroups

**Offline Guarantees:**
1. ZERO network calls when offline (NetInfo.isConnected === false)
2. Session preserved: tokens never deleted except on explicit signOut()
3. All reads from SQLite: ZERO fallback to Supabase
4. Auto-refresh disabled offline: prevented false SIGNED_OUT events

---

*Architecture analysis: 2026-04-12*
