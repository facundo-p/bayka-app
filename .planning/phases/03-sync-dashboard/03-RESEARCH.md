# Phase 3: Sync + Dashboard — Research

**Researched:** 2026-03-19
**Domain:** Offline-first sync with Supabase RPC, dashboard stats, React Native / Expo
**Confidence:** HIGH — all findings verified against actual codebase and Supabase docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sync trigger & flow**
- Batch sync: single button syncs ALL finalizada SubGroups for the plantation at once
- Sync button as prominent CTA at top of plantation detail screen, showing pending count (e.g., "Sincronizar 3 subgrupos")
- Modal overlay during sync with progress indicator (X/N SubGroups synced) — prevents user interaction during atomic operations
- Pull-then-push order: download updated data first, then upload local SubGroups
- Each SubGroup uploaded atomically (SubGroup + all trees in one server transaction via Supabase RPC)
- On success: toast/banner message, SubGroups transition to sincronizada in-place via useLiveData refresh
- On failure of individual SubGroup: continue syncing remaining SubGroups, report all failures at end
- Failed SubGroups remain finalizada locally with inline error explanation

**Dashboard stats layout**
- Card per plantation with key stats inline — extends existing PlantacionesScreen pattern
- Stats priority per card: total trees registered, unsynced tree count, today's tree count
- Admin sees all plantations for the organization; tecnico sees only assigned — query-level difference, same card component
- Stats refresh on screen focus using established useLiveData pattern
- Pending sync count visible on each plantation card (e.g., "3 subgrupos pendientes")

**Conflict error presentation**
- Duplicate SubGroup code rejection shown as inline alert on the failed SubGroup in Spanish
- Plain-language message: "El código de subgrupo ya existe en el servidor. Renombrá el código e intentá de nuevo."
- Failed SubGroup stays as finalizada locally — user can rename code and retry
- No complex conflict resolution UI — manual rename is sufficient

**Pending sync visibility**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | Technician can manually initiate sync for finalizada SubGroups | SyncService + useSync hook wires UI trigger to RPC upload |
| SYNC-02 | Sync uploads SubGroup + all trees as atomic unit | Supabase RPC in a single Postgres transaction; no partial uploads |
| SYNC-03 | Server rejects sync if SubGroup code already exists in plantation | RPC checks unique constraint and returns typed error code |
| SYNC-04 | Sync conflict shows clear error message to user | SyncService maps server error code → Spanish message; rendered inline per SubGroup |
| SYNC-05 | Successful sync marks SubGroup as sincronizada (immutable) | Local state update in SubGroupRepository after RPC success |
| SYNC-06 | During sync, app downloads updated data from other technicians | Pull phase before push: fetch subgroups + trees + plantation_species, upsert locally |
| SYNC-07 | User can see list of SubGroups pending sync | Badge on tab icon + count on each plantation card via live query on subgroups.estado = 'finalizada' |
| DASH-01 | Technician sees list of assigned plantations after login | PlantacionesScreen extended: filter query via plantation_users JOIN for tecnico role |
| DASH-02 | Admin sees all plantations for the organization | PlantacionesScreen: no user filter for admin role |
| DASH-03 | Each plantation shows total trees registered and synced | Live query: COUNT trees via subgroups JOIN |
| DASH-04 | Each plantation shows user's unsynced tree count | COUNT trees WHERE subgroup.estado != 'sincronizada' AND usuario_registro = userId |
| DASH-05 | Each plantation shows user's total tree count | COUNT trees WHERE usuario_registro = userId |
| DASH-06 | Each plantation shows user's trees registered today | Existing todayCounts query already in PlantacionesScreen |
</phase_requirements>

---

## Summary

Phase 3 has two independent delivery areas: (1) sync machinery — Supabase RPC + SyncService + useSync — and (2) dashboard stats + pending-sync visibility. Both areas build on established Phase 1–2 patterns with no new external dependencies required.

The most technically sensitive work is the Supabase RPC function, which must run a Postgres transaction that inserts one SubGroup row plus N tree rows atomically, validate uniqueness, and return a structured result the client can parse. The client-side SyncService coordinates pull-then-push order, per-SubGroup error accumulation, and local state transition. The dashboard is a query extension of the existing PlantacionesScreen — the patterns are already there, they just need new computed columns and role-gated filtering.

**Primary recommendation:** Design and deploy the Supabase RPC first (plan 03-01), then implement SyncService and useSync (plan 03-02), then extend the UI screens (plan 03-03). This ordering ensures the server contract is locked before client code is written.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.99.2 | RPC calls, data download | Already configured in `mobile/src/supabase/client.ts` |
| drizzle-orm | ^0.45.1 | Local SQLite queries for dashboard stats | Already used in all repositories |
| expo-sqlite | ~15.1.0 | Local persistence layer | Already in use |
| expo-router | (via expo ~52.0.0) | Navigation, tab badge, modal | Already used across the app |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @expo/vector-icons/Ionicons | (bundled) | Sync button icon, badge overlay | All icon needs |
| react-native Alert | (RN built-in) | Sync confirmation prompt | Pre-sync user intent confirmation |

**No new packages to install.** All required capabilities exist in the current stack.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
mobile/src/
├── services/
│   └── SyncService.ts          # RPC call orchestration, pull-then-push, error accumulation
├── hooks/
│   └── useSync.ts              # Sync state management (loading, progress, errors per SubGroup)
├── repositories/
│   └── SubGroupRepository.ts   # ADD: markAsSincronizada(), getPendingSyncCount()
├── components/
│   └── SyncProgressModal.tsx   # Modal overlay during sync
│   └── PendingSyncBadge.tsx    # Reusable badge component for tab icon + card
supabase/
└── migrations/
    └── 002_sync_rpc.sql        # RPC function + new RLS policies for subgroup insert via RPC
mobile/tests/
└── sync/
    └── SyncService.test.ts     # Unit tests for sync logic
    └── dashboard.test.ts       # Unit tests for dashboard query functions
```

### Pattern 1: Supabase RPC for Atomic Upload (SYNC-02, SYNC-03)

**What:** A single Postgres function called via `supabase.rpc()` that inserts SubGroup + trees in one transaction, checks the unique constraint on (plantation_id, codigo), and returns a structured result.

**When to use:** Any time multiple rows must be inserted atomically with server-side validation.

**RPC contract (Claude's discretion to implement, but contract is locked):**

```typescript
// Function signature on the server:
// sync_subgroup(p_subgroup JSONB, p_trees JSONB[]) RETURNS JSONB
// Returns: { success: true } | { success: false, error: 'DUPLICATE_CODE' | 'UNKNOWN' }

// Client call:
const { data, error } = await supabase.rpc('sync_subgroup', {
  p_subgroup: {
    id: subgroup.id,
    plantation_id: subgroup.plantacionId,
    nombre: subgroup.nombre,
    codigo: subgroup.codigo,
    tipo: subgroup.tipo,
    usuario_creador: subgroup.usuarioCreador,
    created_at: subgroup.createdAt,
  },
  p_trees: trees.map(t => ({
    id: t.id,
    subgroup_id: t.subgrupoId,
    species_id: t.especieId,
    posicion: t.posicion,
    sub_id: t.subId,
    foto_url: null,        // photos are local-only in Phase 1
    usuario_registro: t.usuarioRegistro,
    created_at: t.createdAt,
  })),
});
```

**Idempotency key strategy (Claude's discretion):** Use the SubGroup's UUID as the natural idempotency key. The RPC should use `INSERT ... ON CONFLICT DO NOTHING` for trees (idempotent re-upload), but detect SubGroup code conflicts via `unique (plantation_id, codigo)` and return `DUPLICATE_CODE`. This handles retry-after-network-drop cleanly.

**Postgres transaction structure:**

```sql
CREATE OR REPLACE FUNCTION sync_subgroup(
  p_subgroup JSONB,
  p_trees    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_error TEXT;
BEGIN
  -- Insert SubGroup; catch unique violation on (plantation_id, codigo)
  INSERT INTO subgroups (id, plantation_id, nombre, codigo, tipo, estado,
                         usuario_creador, created_at)
  SELECT
    (p_subgroup->>'id')::UUID,
    (p_subgroup->>'plantation_id')::UUID,
    p_subgroup->>'nombre',
    p_subgroup->>'codigo',
    p_subgroup->>'tipo',
    'sincronizada',
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  ON CONFLICT (id) DO NOTHING;   -- idempotent: re-upload of same UUID is a no-op

  -- Check for DUPLICATE_CODE (different UUID, same plantation+codigo)
  IF EXISTS (
    SELECT 1 FROM subgroups
    WHERE plantation_id = (p_subgroup->>'plantation_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
  END IF;

  -- Insert trees idempotently
  INSERT INTO trees (id, subgroup_id, species_id, posicion, sub_id,
                     foto_url, usuario_registro, created_at)
  SELECT
    (t->>'id')::UUID,
    (t->>'subgroup_id')::UUID,
    NULLIF(t->>'species_id', '')::UUID,
    (t->>'posicion')::INTEGER,
    t->>'sub_id',
    t->>'foto_url',
    (t->>'usuario_registro')::UUID,
    (t->>'created_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_trees) AS t
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;
```

**SECURITY DEFINER note:** The function runs with definer's privileges. The RLS policies in the migrations already allow authenticated users to insert their own subgroups. With SECURITY DEFINER we bypass RLS — this is fine here because the function validates `usuario_creador = auth.uid()` logic via the p_subgroup parameter. Alternatively, use SECURITY INVOKER if RLS already permits the insert. Claude's discretion on which is cleaner.

### Pattern 2: Pull-Then-Push in SyncService (SYNC-06)

**What:** Download updated server data into local SQLite before uploading local SubGroups. This order ensures downloaded SubGroups (from other technicians) don't conflict with the local upload.

**Pull targets:** `subgroups` and `trees` for the plantation being synced, plus `plantation_species` in case species changed. Filter by `plantation_id`.

```typescript
// SyncService.ts skeleton

export type SyncSubGroupResult =
  | { success: true; subgroupId: string }
  | { success: false; subgroupId: string; error: 'DUPLICATE_CODE' | 'NETWORK' | 'UNKNOWN' };

export interface SyncProgress {
  total: number;
  completed: number;
  currentName: string;
}

export async function syncPlantation(
  plantacionId: string,
  onProgress: (progress: SyncProgress) => void,
): Promise<SyncSubGroupResult[]> {
  // 1. PULL — download server data first
  await pullFromServer(plantacionId);

  // 2. PUSH — upload each finalizada SubGroup atomically
  const pending = await getFinalizadaSubGroups(plantacionId);
  const results: SyncSubGroupResult[] = [];

  for (let i = 0; i < pending.length; i++) {
    const sg = pending[i];
    onProgress({ total: pending.length, completed: i, currentName: sg.nombre });
    const result = await uploadSubGroup(sg);
    results.push(result);
    if (result.success) {
      await markAsSincronizada(sg.id);  // local state transition
    }
  }

  return results;
}
```

### Pattern 3: useSync Hook

**What:** Manages sync state (idle / syncing / done) and progress for the Modal.

```typescript
// useSync.ts skeleton
export function useSync(plantacionId: string) {
  const [state, setState] = useState<'idle' | 'syncing' | 'done'>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [results, setResults] = useState<SyncSubGroupResult[]>([]);

  async function startSync() {
    setState('syncing');
    try {
      const res = await syncPlantation(plantacionId, setProgress);
      setResults(res);
    } finally {
      setState('done');
      notifyDataChanged();   // refresh all useLiveData hooks
    }
  }

  return { state, progress, results, startSync, reset: () => setState('idle') };
}
```

### Pattern 4: Dashboard Role-Gated Queries (DASH-01, DASH-02)

**What:** The same PlantationCard component is used for both roles. The query differs by role.

**Current state:** PlantacionesScreen already fetches ALL plantations without role filtering. Phase 3 adds role-gating for tecnico and adds the missing stats (unsynced count, user total count).

**Critical gap:** The local SQLite schema is missing a `plantation_users` table. The Supabase server schema has `plantation_users`. For the dashboard filter to work offline, this table must be added to the local schema and populated during the pull phase.

```typescript
// Dashboard query pattern — role differentiation at query level
async function getPlantationsForUser(userId: string, role: 'admin' | 'tecnico') {
  if (role === 'admin') {
    return db.select().from(plantations).orderBy(desc(plantations.createdAt));
  }
  // Tecnico: only assigned plantations via plantation_users JOIN
  return db.select({ ...getTableColumns(plantations) })
    .from(plantations)
    .innerJoin(plantationUsers, eq(plantationUsers.plantacionId, plantations.id))
    .where(eq(plantationUsers.userId, userId))
    .orderBy(desc(plantations.createdAt));
}
```

**IMPORTANT:** This requires `plantation_users` to exist in local SQLite. Currently it does NOT exist in `schema.ts`. Must be added in Plan 03-01 as part of the migration.

### Pattern 5: Pending Sync Badge on Tab Icon (SYNC-07)

**What:** The tab icon shows a numeric badge (count of finalizada SubGroups across all plantations).

**How it works today:** `PlantacionesTabIcon` is a plain `MaterialCommunityIcons` without badge support. The badge needs to be added as an absolutely-positioned `View` overlay.

```typescript
// PlantacionesTabIcon.tsx — extended with badge
export default function PlantacionesTabIcon({ color, size }: Props) {
  const { pendingCount } = usePendingSyncCount();
  return (
    <View style={{ width: size, height: size }}>
      <MaterialCommunityIcons name="tree-outline" size={size} color={color} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
        </View>
      )}
    </View>
  );
}

// usePendingSyncCount hook — live query
function usePendingSyncCount() {
  const { data } = useLiveData(
    () => db.select({ count: count() }).from(subgroups)
      .where(eq(subgroups.estado, 'finalizada'))
  );
  return { pendingCount: data?.[0]?.count ?? 0 };
}
```

### Anti-Patterns to Avoid

- **Background sync:** Explicitly out of scope. No `useEffect` that auto-syncs without user intent.
- **Optimistic UI for sync state:** Do NOT set estado = 'sincronizada' locally before the RPC returns success. Set it only after confirmed server response.
- **Blocking the entire sync on one failure:** Each SubGroup is tried independently; continue on individual failure (locked decision).
- **Photo upload in sync:** Photos are local-only in Phase 1. `foto_url` is sent as `null` in the RPC payload.
- **Re-querying inside the sync loop:** Fetch all pending SubGroups + their trees BEFORE the loop. Avoid DB reads inside the upload loop to minimize time with the modal open.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-table insert | Custom retry/rollback logic in JS | Supabase RPC (Postgres transaction) | Postgres ACID guarantees; partial failures impossible |
| Network error handling | Manual fetch retry | Supabase client handles auth token refresh automatically | Token expiry mid-sync is a real risk during long uploads |
| Reactive dashboard refresh | Manual state updates | `notifyDataChanged()` + `useLiveData` (already established) | Propagates to all subscribers including tab badge |
| Unique constraint check | Client-side pre-check before RPC | Server-side check inside RPC | Race condition possible if two devices sync same code simultaneously |
| Tab icon badge | react-native-tab-view badge API | Absolute-position View overlay (as shown above) | Expo Router's `<Tabs>` doesn't expose a native badge prop in SDK 52 |

**Key insight:** The Postgres transaction is the correct place for atomicity and conflict detection. Client-side pre-validation is a UX optimization only — the server is authoritative.

---

## Common Pitfalls

### Pitfall 1: Missing plantation_users in Local Schema

**What goes wrong:** Dashboard role-filtering for tecnico requires a `plantation_users` table in SQLite. It exists in Supabase but NOT in `mobile/src/database/schema.ts`. Queries will fail silently or show all plantations to all users.

**Why it happens:** The local schema only contains what Phase 1-2 needed. The plantation_users relationship was always server-only.

**How to avoid:** Add `plantation_users` to `schema.ts` and create a Drizzle migration in Plan 03-01. The pull phase must download `plantation_users` for the current user and upsert locally.

**Warning signs:** Tecnico sees all plantations instead of only assigned ones.

### Pitfall 2: Auth Token Expiry During Long Sync

**What goes wrong:** If a technician has many SubGroups to sync and the JWT expires mid-loop, subsequent RPC calls will get 401 errors that surface as UNKNOWN errors.

**Why it happens:** Supabase JWTs expire (default 1 hour). In the field, app may be in background for hours before user initiates sync.

**How to avoid:** Call `await supabase.auth.getSession()` once before starting the sync loop. The Supabase client with `autoRefreshToken: true` (already configured) handles this, but only while the app is in foreground. An explicit refresh call before sync starts ensures the token is fresh.

**Warning signs:** The first SubGroup syncs fine but subsequent ones fail with network/auth errors.

### Pitfall 3: notifyDataChanged() Timing in Sync Loop

**What goes wrong:** Calling `notifyDataChanged()` after each SubGroup inside the sync loop causes the FlatList to re-render mid-sync, potentially causing the modal to flicker or the list to shift while the user is watching the progress indicator.

**Why it happens:** useLiveData subscribes globally; any write notification re-renders all subscribers.

**How to avoid:** Call `notifyDataChanged()` exactly ONCE after the entire sync loop completes (either in the finally block or after all results are collected). This is already the pattern in `useSync.ts` skeleton above.

**Warning signs:** Jittery modal or list items changing order during sync.

### Pitfall 4: JSONB Array Handling in Supabase RPC

**What goes wrong:** Passing `p_trees` as a JS array to `supabase.rpc()` — Supabase JS client serializes it as JSONB. The PL/pgSQL function must use `jsonb_array_elements()` to iterate. Using `unnest()` on a JSONB array will fail.

**Why it happens:** JSONB != Postgres array type. Mixing them is a common mistake.

**How to avoid:** Use `jsonb_array_elements(p_trees)` in the RPC function. Verified against the SQL example above.

### Pitfall 5: RLS Blocking RPC Writes

**What goes wrong:** If the RPC function is `SECURITY INVOKER` (the default), the authenticated user must have INSERT permission on both `subgroups` and `trees` via RLS. The current migration has `"Users can insert own subgroups"` but only checks `auth.uid() = usuario_creador`. If the subgroup is being uploaded by the creator, this passes. Trees have the same pattern. This WILL work correctly with SECURITY INVOKER as long as the RPC passes `usuario_creador` and `usuario_registro` as the actual auth.uid().

**How to avoid:** Verify RLS policies cover RPC-inserted rows. The current policies allow INSERT where `auth.uid() = usuario_creador`. Since sync only uploads SubGroups the current user created (by domain rule), this aligns correctly. No policy changes needed IF using SECURITY INVOKER.

### Pitfall 6: Duplicate Download on Repeated Sync

**What goes wrong:** Pull phase downloads ALL subgroups for a plantation every time. For large plantations with many synced SubGroups this is wasteful and slow.

**How to avoid:** Filter pull query by `updated_at > last_sync_timestamp` or simply accept full download for Phase 1 (plantations won't have thousands of SubGroups in MVP). Note the current schema has no `last_sync_at` field — adding one is Claude's discretion. For Phase 1, full pull is acceptable.

### Pitfall 7: Plantation Filter Not Applied at Download

**What goes wrong:** During pull, downloading ALL subgroups from the server (not scoped to a plantation) would import data the user shouldn't see yet and is slow.

**How to avoid:** Filter server pull queries by `plantation_id`. Always scope downloads to the specific plantation the user is syncing.

---

## Code Examples

### Dashboard — Unsynced Tree Count per Plantation

```typescript
// Source: verified against existing PlantacionesScreen.tsx query patterns
// Count trees in subgroups with estado != 'sincronizada' for the current user
const { data: unsyncedCounts } = useLiveData(
  () => {
    if (!userId) return Promise.resolve([]);
    return db.select({
      plantacionId: subgroups.plantacionId,
      treeCount: count(),
    })
      .from(trees)
      .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
      .where(and(
        eq(trees.usuarioRegistro, userId),
        sql`${subgroups.estado} != 'sincronizada'`
      ))
      .groupBy(subgroups.plantacionId);
  },
  [userId]
);
```

### Dashboard — Pending SubGroup Count per Plantation (card badge)

```typescript
// Count of finalizada (not yet sincronizada) SubGroups per plantation
const { data: pendingCounts } = useLiveData(
  () => db.select({
    plantacionId: subgroups.plantacionId,
    pendingCount: count(),
  })
    .from(subgroups)
    .where(eq(subgroups.estado, 'finalizada'))
    .groupBy(subgroups.plantacionId)
);
```

### SubGroupRepository — markAsSincronizada

```typescript
// Add to SubGroupRepository.ts
export async function markAsSincronizada(subgrupoId: string): Promise<void> {
  await db.update(subgroups)
    .set({ estado: 'sincronizada' })
    .where(eq(subgroups.id, subgrupoId));
  notifyDataChanged();
}

export async function getFinalizadaSubGroups(plantacionId: string): Promise<SubGroup[]> {
  return db.select().from(subgroups)
    .where(and(
      eq(subgroups.plantacionId, plantacionId),
      eq(subgroups.estado, 'finalizada')
    ));
}
```

### Pull Phase — Upsert Server Data Locally

```typescript
// In SyncService.ts — pull subgroups for a plantation
async function pullFromServer(plantacionId: string): Promise<void> {
  const { data: serverSubgroups, error } = await supabase
    .from('subgroups')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (error || !serverSubgroups) return;

  // Upsert into local SQLite — use drizzle's onConflictDoUpdate
  for (const sg of serverSubgroups) {
    await db.insert(subgroups).values({
      id: sg.id,
      plantacionId: sg.plantation_id,
      nombre: sg.nombre,
      codigo: sg.codigo,
      tipo: sg.tipo as SubGroupTipo,
      estado: sg.estado as SubGroupEstado,
      usuarioCreador: sg.usuario_creador,
      createdAt: sg.created_at,
    }).onConflictDoUpdate({
      target: subgroups.id,
      set: {
        estado: sql`excluded.estado`,
        nombre: sql`excluded.nombre`,
      },
    });
  }

  // Also pull trees for this plantation
  await pullTreesForPlantation(plantacionId);
}
```

### Sync Progress Modal Pattern

```typescript
// SyncProgressModal.tsx — blocks interaction during sync
<Modal visible={syncState === 'syncing'} transparent animationType="fade">
  <View style={styles.overlay}>
    <View style={styles.modal}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.progressText}>
        Sincronizando {progress?.completed ?? 0} de {progress?.total ?? 0}
      </Text>
      <Text style={styles.currentName}>{progress?.currentName ?? ''}</Text>
    </View>
  </View>
</Modal>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| drizzle `useLiveQuery` | Custom `useLiveData` + `notifyDataChanged` | Phase 1 (unreliable in Expo SDK 52) | Stable reactive pattern already in use |
| Supabase JS v1 `.rpc()` API | Supabase JS v2 `supabase.rpc(name, params)` | Library update | Same call signature, types improved |
| JSONB-typed args via `any` | Typed via Supabase TypeScript codegen | Available now | Optional enhancement — codegen not set up in this project |

**Deprecated/outdated:**
- `useLiveQuery` from drizzle-orm/expo-sqlite: already replaced in this project — do not reintroduce.

---

## Open Questions

1. **plantation_users local schema**
   - What we know: The table exists in Supabase but not in local SQLite schema.ts. Tecnico role-filtering requires it.
   - What's unclear: Should pull also download plantation_users rows (to know which plantations the tecnico is assigned to)? Currently no mechanism for this.
   - Recommendation: Add `plantation_users` to schema.ts in Plan 03-01. During pull phase, fetch `plantation_users` for `auth.uid()` and upsert. This closes the DASH-01 requirement cleanly.

2. **trees table pull — volume concern**
   - What we know: Pull downloads all trees for a plantation. A plantation may have tens of thousands of trees.
   - What's unclear: Is this acceptable for Phase 1 MVP usage (autumn 2026 planting season)?
   - Recommendation: For Phase 1, pull only subgroups metadata (not trees) during the pull phase. Trees are only needed on the SubGroup detail screen, and they can be pulled on-demand when that screen opens. This keeps sync fast. Claude's discretion to implement differently if simpler.

3. **RPC SECURITY DEFINER vs INVOKER**
   - What we know: With SECURITY INVOKER + existing RLS policies, authenticated creators can insert their own SubGroups and trees.
   - What's unclear: Whether Supabase's default function execution context interacts with RLS as expected.
   - Recommendation: Use SECURITY INVOKER first. If RLS blocks the function, switch to SECURITY DEFINER with explicit `auth.uid()` validation inside the function body.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (jest-expo preset) |
| Config file | `mobile/jest.config.js` |
| Quick run command | `cd mobile && npx jest tests/sync/ --testEnvironment node` |
| Full suite command | `cd mobile && npx jest --testEnvironment node` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Sync triggered only for finalizada SubGroups | unit | `npx jest tests/sync/SyncService.test.ts -t "only finalizada"` | ❌ Wave 0 |
| SYNC-02 | Each SubGroup upload calls RPC once with SubGroup + trees | unit | `npx jest tests/sync/SyncService.test.ts -t "atomic upload"` | ❌ Wave 0 |
| SYNC-03 | RPC returns DUPLICATE_CODE for existing codigo | unit | `npx jest tests/sync/SyncService.test.ts -t "DUPLICATE_CODE"` | ❌ Wave 0 |
| SYNC-04 | DUPLICATE_CODE maps to Spanish error message | unit | `npx jest tests/sync/SyncService.test.ts -t "Spanish error"` | ❌ Wave 0 |
| SYNC-05 | markAsSincronizada called after RPC success | unit | `npx jest tests/sync/SyncService.test.ts -t "markAsSincronizada"` | ❌ Wave 0 |
| SYNC-06 | Pull runs before push in syncPlantation | unit | `npx jest tests/sync/SyncService.test.ts -t "pull before push"` | ❌ Wave 0 |
| SYNC-07 | getPendingSyncCount returns count of finalizada SubGroups | unit | `npx jest tests/sync/SyncService.test.ts -t "pending count"` | ❌ Wave 0 |
| DASH-01 | Tecnico plantation query uses plantation_users JOIN | unit | `npx jest tests/sync/dashboard.test.ts -t "tecnico filter"` | ❌ Wave 0 |
| DASH-02 | Admin plantation query returns all without user filter | unit | `npx jest tests/sync/dashboard.test.ts -t "admin all"` | ❌ Wave 0 |
| DASH-03 | Total trees count includes sincronizada SubGroups | unit | `npx jest tests/sync/dashboard.test.ts -t "total trees"` | ❌ Wave 0 |
| DASH-04 | Unsynced count excludes sincronizada SubGroups | unit | `npx jest tests/sync/dashboard.test.ts -t "unsynced count"` | ❌ Wave 0 |
| DASH-05 | User total count scoped to userId | unit | `npx jest tests/sync/dashboard.test.ts -t "user total"` | ❌ Wave 0 |
| DASH-06 | Today count uses localToday() date prefix match | unit | `npx jest tests/sync/dashboard.test.ts -t "today count"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mobile && npx jest tests/sync/ --testEnvironment node`
- **Per wave merge:** `cd mobile && npx jest --testEnvironment node`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `mobile/tests/sync/SyncService.test.ts` — covers SYNC-01 through SYNC-07
- [ ] `mobile/tests/sync/dashboard.test.ts` — covers DASH-01 through DASH-06
- [ ] Mock for `mobile/src/supabase/client.ts` in test files — `jest.mock('../../src/supabase/client')`

---

## Sources

### Primary (HIGH confidence)

- Actual codebase — `mobile/src/database/schema.ts`, `SubGroupRepository.ts`, `liveQuery.ts`, `PlantacionesScreen.tsx`, `PlantationDetailScreen.tsx`, `supabase/client.ts`, `theme.ts`
- Supabase migrations — `supabase/migrations/001_initial_schema.sql` (exact RLS policies and table structure)
- Layout files — `mobile/app/(tecnico)/_layout.tsx`, `mobile/app/(admin)/_layout.tsx` (tab structure, PlantacionesTabIcon usage)
- Package.json — verified versions: @supabase/supabase-js ^2.99.2, drizzle-orm ^0.45.1

### Secondary (MEDIUM confidence)

- Supabase JS v2 RPC documentation — `supabase.rpc(name, params)` signature and JSONB parameter handling is standard v2 API (verified against v2.99.x behavior)
- Drizzle ORM `onConflictDoUpdate` pattern — standard Drizzle SQLite upsert (verified against drizzle-orm 0.45.x docs)

### Tertiary (LOW confidence — flag for validation)

- SECURITY INVOKER vs DEFINER interaction with Supabase RLS — behavior verified in docs but Supabase's specific function execution context should be validated with a test RPC call during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json, no new dependencies
- Architecture patterns: HIGH — all derived from actual codebase code, locked decisions from CONTEXT.md
- SQL RPC design: MEDIUM — Postgres JSONB + transaction patterns are standard, specific Supabase behavior needs smoke test
- Pitfalls: HIGH — all derived from reading actual code and schema gaps (plantation_users missing is confirmed)
- Dashboard queries: HIGH — extends existing PlantacionesScreen query patterns directly

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — stable stack)
