# Architecture Research

**Domain:** Offline-first mobile data collection (plantation monitoring)
**Researched:** 2026-03-16
**Confidence:** HIGH — patterns verified against Expo official docs, Supabase docs, and multiple production implementations

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Screens    │  │  Components  │  │   Hooks      │              │
│  │ (full pages) │  │ (reusable UI)│  │ (UI logic)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼────────────────────── ┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼────────────────────── ┐
│                         DOMAIN / SERVICE LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  SyncService │  │ PhotoService │  │ IDGenerator  │              │
│  │ (push/pull)  │  │(local fs ops)│  │(SubID, etc.) │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼────────────────────── ┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼────────────────────── ┐
│                         REPOSITORY LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ SubGroupRepo │  │   TreeRepo   │  │PlantationRepo│              │
│  │              │  │              │  │ SpeciesRepo  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼─────────────────┼─────────────────┼────────────────────── ┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼────────────────────── ┐
│                         LOCAL DATABASE LAYER                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     expo-sqlite + Drizzle ORM                 │   │
│  │   species | plantations | subgroups | trees | sync_meta       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┬───────── ┘
                                                            │ (manual sync only)
                                                ┌───────────▼──────────┐
                                                │   Supabase Backend   │
                                                │  Auth + Postgres DB  │
                                                └──────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Screens | Full-page views, navigation orchestration, zero business logic | React Native screens via Expo Router |
| Components | Reusable UI elements (SpeciesButton, TreeRow, SubGroupCard) | Functional React components with props |
| Hooks | Local state, side effects, data binding to repositories | `usePlantations`, `useSync`, `useSubGroup` |
| Repositories | All read/write access to SQLite — the only layer that touches the DB | TypeScript classes wrapping Drizzle queries |
| SyncService | Coordinate push (upload finished SubGroups) and pull (download fresh data) | Standalone async module, invoked manually by user |
| PhotoService | Capture, store, retrieve photos from device filesystem | Expo Camera + expo-file-system |
| IDGenerator | Compute SubID, plantation IDs, global IDs | Pure functions, no I/O |
| expo-sqlite + Drizzle | Typed schema definition, migrations, live queries | Drizzle schema files + `useLiveQuery` hook |
| Supabase Client | Auth token management, HTTP requests to Postgres REST API | `@supabase/supabase-js` with AsyncStorage session |

---

## Recommended Project Structure

```
mobile/
├── app/                        # Expo Router navigation (file-based routing)
│   ├── (auth)/
│   │   └── login.tsx
│   ├── (admin)/
│   │   ├── plantations/
│   │   └── users/
│   ├── (tecnico)/
│   │   ├── dashboard.tsx
│   │   ├── plantation/[id].tsx
│   │   ├── subgroup/[id].tsx
│   │   └── sync.tsx
│   └── _layout.tsx
│
├── src/
│   ├── database/               # SQLite persistence layer
│   │   ├── schema.ts           # Drizzle table definitions (single source of truth)
│   │   ├── migrations/         # Auto-generated SQL migration files
│   │   ├── seeds/              # Initial data: species, admin users
│   │   └── client.ts           # SQLite connection singleton
│   │
│   ├── repositories/           # Data access — only layer touching SQLite
│   │   ├── PlantationRepository.ts
│   │   ├── SubGroupRepository.ts
│   │   ├── TreeRepository.ts
│   │   └── SpeciesRepository.ts
│   │
│   ├── services/               # Business operations with side effects
│   │   ├── SyncService.ts      # Push SubGroups to Supabase + pull updates
│   │   ├── PhotoService.ts     # Camera capture + local filesystem storage
│   │   └── ExportService.ts    # CSV/Excel generation for admin
│   │
│   ├── utils/                  # Pure functions, no I/O
│   │   ├── idGenerator.ts      # SubID, plantation ID, global ID computation
│   │   ├── reverseOrder.ts     # Tree position reversal within SubGroup
│   │   └── dateUtils.ts        # Date formatting helpers
│   │
│   ├── hooks/                  # React hooks for UI data binding
│   │   ├── useAuth.ts          # Supabase Auth session
│   │   ├── usePlantations.ts   # Live query: plantations list
│   │   ├── useSubGroup.ts      # Live query: subgroup + trees
│   │   └── useSync.ts          # Sync status, trigger sync, handle errors
│   │
│   ├── components/             # Reusable UI elements
│   │   ├── SpeciesButtonGrid.tsx
│   │   ├── TreeRow.tsx
│   │   ├── SubGroupCard.tsx
│   │   └── SyncStatusBadge.tsx
│   │
│   ├── supabase/               # Backend integration
│   │   ├── client.ts           # Supabase JS client init
│   │   └── types.ts            # Generated DB types (supabase gen types)
│   │
│   └── types/                  # Shared TypeScript types
│       ├── domain.ts           # Organization, Plantation, SubGroup, Tree, Species
│       └── sync.ts             # SyncResult, SyncStatus, ConflictError
```

### Structure Rationale

- **database/:** Schema is the single source of truth for the local DB. Drizzle generates typed queries from it. Migrations are auto-generated via `drizzle-kit push`.
- **repositories/:** Isolates all SQL queries. Screens and hooks never import Drizzle directly — they only call repository methods. This makes future DB swaps or testing straightforward.
- **services/:** Contains logic with real side effects (network, filesystem). Kept separate from repositories so sync logic doesn't leak into data access code.
- **hooks/:** Thin bridge between repositories and React. They use `useLiveQuery` from Drizzle to auto-update UI when SQLite data changes — no manual refresh needed.
- **app/ (Expo Router):** File-based routing means navigation structure is visible at a glance. Auth-gated routes via layout-level guards.

---

## Architectural Patterns

### Pattern 1: Repository Pattern over Raw Drizzle

**What:** All database access goes through named repository classes/modules. Screens and hooks import a repository, not the Drizzle client directly.

**When to use:** Always — this is the foundation of the data layer.

**Trade-offs:** Tiny boilerplate overhead. Major benefit: SQL complexity is contained, repositories are independently testable, and schema changes only propagate within repository files.

**Example:**
```typescript
// src/repositories/TreeRepository.ts
export async function insertTree(tree: NewTree): Promise<Tree> {
  const result = await db.insert(trees).values(tree).returning();
  return result[0];
}

export function useTreesForSubGroup(subGroupId: string) {
  return useLiveQuery(
    db.select().from(trees).where(eq(trees.subGroupId, subGroupId))
  );
}
```

### Pattern 2: Live Queries for Reactive UI

**What:** Use Drizzle's `useLiveQuery` hook to subscribe to SQLite data. When a tree is inserted, the SubGroup screen automatically re-renders with the new count — no manual state updates.

**When to use:** Anywhere data displayed in the UI is also written to locally (tree registration, SubGroup status changes).

**Trade-offs:** Slightly higher SQLite read load. Eliminates entire categories of stale-state bugs. Critical for the one-tap registration flow where speed is non-negotiable.

**Example:**
```typescript
// In SubGroupScreen
const { data: treeList } = useTreesForSubGroup(subGroupId);
// Automatically reflects every new tree tap with no extra code
```

### Pattern 3: Atomic SubGroup Sync with Outbox State

**What:** SyncService reads all SubGroups in `finalizada` state (with no N/N trees), uploads each one as an atomic transaction to Supabase (SubGroup row + all Tree rows in a single RPC/transaction), then marks the SubGroup as `sincronizada` locally only on success.

**When to use:** Every sync operation — this is the core sync invariant of the system.

**Trade-offs:** Simplicity over flexibility. If one SubGroup fails, others can still succeed. No partial upload possible (preventing orphaned tree records). Aligns directly with the business rule "SubGroup is the atomic sync unit."

**Example:**
```typescript
// src/services/SyncService.ts
async function syncSubGroup(subGroup: SubGroup): Promise<SyncResult> {
  const trees = await TreeRepository.getBySubGroup(subGroup.id);

  // Single RPC call that wraps SubGroup + trees in a DB transaction
  const { error } = await supabase.rpc('insert_subgroup_with_trees', {
    subgroup: subGroup,
    trees: trees,
  });

  if (error) {
    if (error.code === 'DUPLICATE_CODE') return { status: 'conflict' };
    return { status: 'error', message: error.message };
  }

  await SubGroupRepository.markSynced(subGroup.id);
  return { status: 'sincronizada' };
}
```

### Pattern 4: Pull-then-Push Sync Order

**What:** During a sync session, always download remote updates first (species catalog updates, other technicians' synced SubGroups), then upload local pending SubGroups.

**When to use:** Every sync session.

**Trade-offs:** Ensures the uploader has the latest state before writing. For this app, conflicts are rare (each technician works in separate SubGroups), but pull-first is still the safer pattern and prevents stale data display post-sync.

---

## Data Flow

### Tree Registration (Critical Path — Must Be Instant)

```
User taps species button
    ↓
Screen calls TreeRepository.insertTree(...)
    ↓
Drizzle executes INSERT into local SQLite (< 5ms)
    ↓
useLiveQuery fires → UI re-renders with updated tree count
    ↓
(No network involved — 100% local)
```

### Manual Sync Flow

```
User taps "Sync" button
    ↓
useSync hook calls SyncService.sync()
    ↓
[PULL] SyncService fetches updated species + plantation config from Supabase
    ↓
SyncService writes remote data to local SQLite (species, plantation updates)
    ↓
[PUSH] SyncService queries finalizada SubGroups without N/N trees
    ↓
For each eligible SubGroup:
    SyncService POSTs SubGroup + Trees to Supabase in one transaction
    On success: SubGroupRepository.markSynced(id)
    On conflict: returns conflict error, SubGroup stays 'finalizada'
    ↓
SyncService returns SyncSummary { synced: N, failed: N, conflicts: [...] }
    ↓
useSync updates local state → UI shows sync result
```

### SubGroup State Machine

```
[activa]  ←────────────────────────────────────┐
    │                                                │
    │ Technician taps "Finish SubGroup"              │ (only before finish)
    │ (blocks if N/N trees exist)                    │
    ▼                                                │
[finalizada]   ←── can be re-opened in Phase 1?  ───┘
    │
    │ Sync succeeds
    ▼
[sincronizada]  ── IMMUTABLE — no further edits permitted
```

### Authentication Flow

```
App launch
    ↓
Check Supabase session in AsyncStorage (via supabase-js)
    ├── Session valid → load local SQLite, go to Dashboard
    └── No session → LoginScreen
            ↓
        User enters email + password
            ↓
        supabase.auth.signInWithPassword(...)
            ├── Success → persist session, seed initial data if needed, Dashboard
            └── Failure → show error (no local fallback — auth is online-only)
```

### State Management

```
SQLite (via Drizzle useLiveQuery)
    ↓ (reactive subscriptions)
Repository Hooks (usePlantations, useSubGroup, etc.)
    ↓ (return typed data)
Screens / Components
    ↑ (user actions)
Repository calls (insert, update) → SQLite mutation → live query fires → re-render
```

No global state manager (Redux, Zustand) is needed. SQLite acts as the single source of truth. `useLiveQuery` replaces the need for manual state updates throughout the app.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `supabase.auth.signInWithPassword()` — token stored in AsyncStorage | Online-only. Offline use requires a previously valid session. In Phase 1, users are seeded so no self-registration flow needed. |
| Supabase Postgres | REST API via `supabase-js` for sync push/pull | Use a Postgres function (RPC) for atomic SubGroup+Trees upload. Avoids multiple round trips and ensures server-side transaction. |
| Device Filesystem | `expo-file-system` for photo read/write | Photos stored at `FileSystem.documentDirectory + /photos/`. Paths stored in Tree rows. Photos NOT synced in Phase 1. |
| Device Camera | `expo-image-picker` for capture and gallery | Required for N/N trees. Optional for identified trees. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Screen → Repository | Direct function call via custom hook | Screens never import Drizzle. Only hooks import repositories. |
| Screen → SyncService | Via `useSync` hook | Hook wraps SyncService, exposes status + trigger function |
| Repository → SQLite | Drizzle query builder | All queries typed via schema inference |
| SyncService → Supabase | `supabase-js` client | Supabase client initialized once, imported as singleton |
| SyncService → Repository | Direct import | SyncService reads local data via repositories before uploading |

---

## Build Order Implications

The component dependencies determine the natural build sequence:

1. **Database schema + migrations** — Everything depends on this. Define tables and types first.
2. **Repository layer** — Wraps schema. Services and hooks depend on repositories.
3. **Auth flow** — Login/session handling. All other screens gate on auth state.
4. **Core data repositories + live query hooks** — Species, plantations, subgroups, trees.
5. **Tree registration screen** — Highest-value, most performance-sensitive. Validates the one-tap + live query pattern.
6. **SubGroup management** — Create, finish, N/N resolution. Builds on tree registration.
7. **SyncService** — Depends on repositories and Supabase client. Requires SubGroup states to exist.
8. **Admin features** — Plantation creation, species config, user assignment. Lower field risk, higher data risk.
9. **Export service** — CSV/Excel generation. Admin-only, lowest urgency.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 devices (Phase 1, Bayka MVP) | Current architecture is appropriate. Single organization, seeded users, manual sync. |
| 10-100 devices (future seasons) | Add Supabase Row Level Security (RLS) policies per organization. Multi-org schema already prepared. |
| 100+ devices | Consider PowerSync or similar for managed sync if manual sync becomes operationally painful. Current architecture can handle this without change. |

### Scaling Priorities

1. **First bottleneck:** Supabase RPC for SubGroup sync if SubGroups are very large (thousands of trees per SubGroup). Mitigate by batching tree inserts within the RPC if needed.
2. **Second bottleneck:** Device storage for photos at scale (thousands of trees × photos). Mitigate by implementing photo upload to Supabase Storage in Phase 2.

---

## Anti-Patterns

### Anti-Pattern 1: Querying SQLite from Screens Directly

**What people do:** Import Drizzle client inside a screen component and write queries inline.

**Why it's wrong:** Business logic leaks into the UI layer. Schema changes require hunting through screen files. Impossible to test in isolation.

**Do this instead:** All SQLite access through named repository functions exposed via hooks.

### Anti-Pattern 2: Optimistic Network Writes

**What people do:** Skip local persistence and write directly to Supabase, assuming connectivity.

**Why it's wrong:** Fatal in field conditions. One dropped connection during tree registration = data loss. The entire value proposition of this app is "no data lost."

**Do this instead:** Always write to SQLite first. Sync is a separate, explicit, user-initiated operation.

### Anti-Pattern 3: Partial SubGroup Sync

**What people do:** Sync trees individually or in batches as they're registered, rather than waiting for SubGroup finalization.

**Why it's wrong:** Creates orphaned tree records if the SubGroup is never finished. Makes rollback impossible. Violates the immutability invariant (synced data must be complete).

**Do this instead:** Only sync `finalizada` SubGroups. The SubGroup + all its trees must upload in a single server-side transaction.

### Anti-Pattern 4: Allowing Sync During Active Registration

**What people do:** Run sync in the background while the technician is still registering trees in the same SubGroup.

**Why it's wrong:** Race condition between INSERT and the sync read. A tree registered 100ms before the sync starts may or may not be included, making the synced SubGroup non-deterministic.

**Do this instead:** Sync only operates on `finalizada` SubGroups. An active SubGroup is in `activa` state and invisible to the SyncService.

### Anti-Pattern 5: Auth-Gated Offline Data Access

**What people do:** Require a valid Supabase token for every read/write operation, including local SQLite.

**Why it's wrong:** If the token expires in the field (no internet to refresh), the app becomes unusable.

**Do this instead:** Auth token is required only for sync operations. Local SQLite read/write works regardless of token validity. Accept that if the session fully expires and the user logs out, a re-login (requiring internet) is needed.

---

## Sources

- [Expo Local-First Architecture Guide](https://docs.expo.dev/guides/local-first/) — HIGH confidence, official Expo docs
- [Expo SQLite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/) — HIGH confidence, official
- [Modern SQLite for React Native Apps (Expo Blog)](https://expo.dev/blog/modern-sqlite-for-react-native-apps) — HIGH confidence, official Expo blog
- [Drizzle ORM + Expo SQLite](https://orm.drizzle.team/docs/connect-expo-sqlite) — HIGH confidence, official Drizzle docs
- [Building Offline-First with Drizzle + SQLite (Medium)](https://medium.com/@detl/building-an-offline-first-production-ready-expo-app-with-drizzle-orm-and-sqlite-f156968547a2) — MEDIUM confidence, production implementation article
- [Offline-First React Native Architecture with SQLite (InnovationM)](https://www.innovationm.com/blog/react-native-offline-first-architecture-sqlite-local-database-guide/) — MEDIUM confidence, architecture patterns article
- [React Native Offline Sync with SQLite Queue (DEV.to)](https://dev.to/sathish_daggula/react-native-offline-sync-with-sqlite-queue-4975) — MEDIUM confidence, sync implementation patterns
- [Supabase + Expo React Native Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — HIGH confidence, official Supabase docs

---
*Architecture research for: offline-first plantation monitoring mobile app (Bayka)*
*Researched: 2026-03-16*
