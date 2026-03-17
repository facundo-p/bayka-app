# Phase 2: Field Registration - Research

**Researched:** 2026-03-17
**Domain:** Offline-first tree registration — SQLite CRUD, Expo Router navigation, camera/photo, React Native field UI
**Confidence:** HIGH — all core patterns verified from existing Phase 1 code + established architecture

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Species button grid**
- 4-column scrollable grid, each button shows species code (large) + nombre (small)
- Minimum 60pt height per button, full column width — designed for gloved fingers
- N/N button fixed at the top of the grid, visually distinct (yellow/orange), always visible
- Species order defined by `orden_visual` from `plantation_species` table
- Grid loads species for the current plantation only (from local SQLite)

**Tree registration feedback**
- One tap = one tree registered instantly — no confirmation dialog, no loading
- Brief visual flash/highlight on the tapped button
- Total tree count for the SubGroup displayed prominently at the top of the screen
- Last 3 registered trees shown above the species grid (position + species code, most recent first)
- Undo: tap the last tree in the last-3 list to delete it — instant, no confirmation

**SubGroup creation flow**
- Tapping a plantation in the Plantaciones tab opens the SubGroup list for that plantation
- Create SubGroup form: Nombre, Código, Tipo (linea/parcela, default linea)
- Show the last created SubGroup name as reference when creating a new one
- SubGroup list shows state chips: Activa (green), Finalizada (orange), Sincronizada (blue)
- Tapping an activa SubGroup opens the tree registration screen

**SubGroup finalization**
- "Finalizar" button at the bottom of the tree registration screen
- Finalization requires confirmation since it changes state (activa → finalizada)
- If SubGroup has unresolved N/N trees, finalization is blocked with clear message: "Resolver árboles N/N antes de finalizar"
- Finalized SubGroups are read-only in the list (no edit, no tree registration)
- Only the creator of a SubGroup can edit/finalize it

**N/N photo workflow**
- Tapping N/N button opens camera immediately; secondary option to pick from gallery
- Photo is mandatory for N/N — registration fails without it
- Photo stored in local filesystem (documentDirectory), path saved in tree's foto_url field
- N/N resolution screen: full-screen photo with species picker overlay at bottom
- Navigate through unresolved N/N trees one by one
- N/N resolution accessible from SubGroup list (badge showing count of unresolved N/N)

**Reverse order**
- Button on tree registration screen to reverse all tree positions within the SubGroup
- Only available when SubGroup estado is 'activa' (not finalizada or sincronizada)
- Recalculates positions: tree at position N goes to (total - N + 1)
- Requires confirmation: "¿Revertir el orden de los árboles?"

### Claude's Discretion
- Exact colors and styling for species buttons and state chips
- Animation details for button tap feedback
- Screen transition animations
- Error boundary and edge case handling details
- Exact layout proportions between grid, last-3 list, and counter

### Deferred Ideas (OUT OF SCOPE)
- Admin species button order configuration UI — Phase 4
- Dashboard stats (tree counts per plantation) — Phase 3
- Sync of SubGroups — Phase 3
- Photo upload to server — out of scope for MVP
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUBG-01 | Technician can create a SubGroup with name, code, and type (linea/parcela) | SubGroupRepository.create() pattern; form with TextInput + Picker |
| SUBG-02 | SubGroup code must be unique within the plantation | Enforce in repo: SELECT before INSERT + unique index on (plantacion_id, codigo) |
| SUBG-03 | System shows last created SubGroup name when creating a new one | Query MAX(created_at) SubGroup for plantation; pass as hint to form |
| SUBG-04 | Technician can view list of SubGroups with state indicators (activa/finalizada/sincronizada) | useLiveQuery on subgroups filtered by plantation; colored chips per state |
| SUBG-05 | Technician can finalize a SubGroup (activa → finalizada) | UPDATE estado='finalizada'; guard: no unresolved N/N trees |
| SUBG-06 | Synced SubGroups are immutable (no edit allowed) | Read-only UI when estado='sincronizada'; no action on tap |
| SUBG-07 | Technician can only edit SubGroups they created | Compare usuarioCreador with current session userId |
| TREE-01 | Technician sees species button grid when registering trees in a SubGroup | SpeciesButtonGrid component; plantation_species join; order by orden_visual |
| TREE-02 | One tap on a species button creates a tree record instantly (no confirmation) | TreeRepository.insertTree(); useLiveQuery auto-refreshes |
| TREE-03 | Tree position increments automatically within the SubGroup | MAX(posicion)+1 query at insert time; race condition safe via SQLite WAL |
| TREE-04 | SubID generated automatically (SubGroupCode + SpeciesCode + Position) | Pure function: `${subgroupCode}${speciesCode}${position}` — computed before INSERT |
| TREE-05 | Last 3 registered trees displayed on registration screen | ORDER BY posicion DESC LIMIT 3; shown as tappable rows above grid |
| TREE-06 | Technician can attach optional photo to any tree (camera or gallery) | expo-image-picker (NOT yet installed); copy to documentDirectory |
| TREE-07 | Technician can delete the last registered tree (undo) | DELETE WHERE id = last tree id; only last tree can be deleted |
| NN-01 | Technician can register unidentified tree as N/N via dedicated button | N/N is special case: especieId=null or special NN species; triggers camera |
| NN-02 | Photo is mandatory when registering N/N tree | Camera opens first; if user cancels → abort registration |
| NN-03 | N/N resolution screen shows photo and species selector | Full-screen photo + bottom sheet species picker; navigate one by one |
| NN-04 | Technician can resolve N/N by selecting correct species | UPDATE trees SET especie_id, sub_id recalculated |
| NN-05 | SubGroup with unresolved N/N trees cannot be synced | Guard in finalization + sync (Phase 3) |
| REVR-01 | Technician can reverse tree order within a SubGroup | Batch UPDATE all positions: newPos = (total - oldPos + 1) |
| REVR-02 | Reverse recalculates all tree positions | Transaction: read all trees, compute new positions, batch UPDATE + SubID |
| REVR-03 | Reverse only allowed before SubGroup is synced | Guard: estado != 'sincronizada' |
</phase_requirements>

---

## Summary

Phase 2 is the core of the application — everything else in the product exists to support this workflow. The domain is well-understood from Phase 1 research and existing code. The established architecture (Repository → Hook → Screen) applies directly. No new architectural patterns are needed; this phase is about building the full feature set on top of the foundation.

The main technical areas are: (1) SQLite CRUD for SubGroups and Trees via Drizzle, (2) Expo Router file-based navigation to add plantation → subgroup → registration screens, (3) expo-image-picker and expo-file-system for N/N photos (neither installed yet — these are the only new dependencies), and (4) React Native UI optimized for gloved-finger field use.

The most sensitive logic areas are: position auto-increment (must be safe under rapid taps), SubID generation (must be consistent), reverse order (batch position UPDATE in a transaction), and N/N resolution (UPDATE sub_id when species is assigned).

**Primary recommendation:** Build in repository-first order: SubGroupRepository → TreeRepository → hooks → screens. Install expo-image-picker and expo-file-system first. Add `plantation_species` table to schema before any screen work begins.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| expo-sqlite | ~15.1.0 | Local SQLite database | Installed |
| drizzle-orm | ^0.45.1 | Type-safe SQL queries + useLiveQuery | Installed |
| expo-router | ~4.0.0 | File-based navigation (plantation/[id] routes) | Installed |
| expo-secure-store | ~14.0.0 | Encrypted storage (session userId) | Installed |

### New Dependencies Required
| Library | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| expo-image-picker | ~16.x | Camera + gallery for N/N photos | `npx expo install expo-image-picker` |
| expo-file-system | ~18.x | Copy photos to documentDirectory | `npx expo install expo-file-system` |

**Note:** The project uses Expo SDK 52 (not SDK 55 as documented in STACK.md). `npx expo install` will resolve the correct compatible versions for SDK 52 automatically. Do not pin versions manually.

**Installation:**
```bash
cd mobile
npx expo install expo-image-picker expo-file-system
```

### Not Needed for Phase 2
- Zustand — SQLite + useLiveQuery handles all reactive state; no cross-cutting UI state needed for this phase
- No new native modules beyond image-picker and file-system

---

## Schema Gaps

The existing schema is missing one critical table and has one gap that must be addressed before implementation:

### Missing: `plantation_species` table
The grid loads species per plantation ordered by `orden_visual` (per CONTEXT.md and domain model §6). This table does not exist in the current schema.

```typescript
// Add to schema.ts
export const plantationSpecies = sqliteTable('plantation_species', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  especieId: text('especie_id').notNull().references(() => species.id),
  ordenVisual: integer('orden_visual').notNull().default(0),
});
```

After schema change: run `npx drizzle-kit generate` to create a new migration, then `useMigrations` applies it on next app launch.

### Missing: N/N species representation
The `trees.especieId` is nullable (correct for N/N). But querying "trees with no species = N/N" works via `WHERE especie_id IS NULL`. This is the correct approach — no special N/N species row needed. The SubID for N/N trees uses "NN" as the species code:
```
subgroupCode + "NN" + position  →  "L23BNN5"
```
When resolved, the SubID is recalculated with the actual species code.

### Missing: Unique constraint on subgroups(plantacion_id, codigo)
The domain rule "SubGroup code unique within plantation" (SUBG-02) is not enforced at the DB level. Add a unique index:
```typescript
// In sqliteTable definition add:
}, (t) => ({
  uniqueCode: uniqueIndex('subgroups_plantation_code_unique').on(t.plantacionId, t.codigo),
}));
```

### Missing: plantation_users assignment table
For Phase 2, the Plantaciones screen must show only plantations the technician is assigned to (per domain model). This table is also not in schema. However: the current plantaciones.tsx is a placeholder, and Phase 4 handles admin plantation creation. For Phase 2, a simpler approach is acceptable: show all plantations. Confirm scope in planning.

---

## Architecture Patterns

### Established Pattern: Repository → Hook → Screen
All Phase 1 code follows this pattern. Phase 2 extends it identically.

```
src/
├── repositories/
│   ├── SubGroupRepository.ts      ← CRUD for subgroups table
│   ├── TreeRepository.ts          ← CRUD for trees table
│   └── PlantationSpeciesRepo.ts   ← Read plantation_species with species join
├── services/
│   └── PhotoService.ts            ← expo-image-picker + expo-file-system
├── utils/
│   ├── idGenerator.ts             ← SubID generation pure function
│   └── reverseOrder.ts            ← Position reversal pure function
├── hooks/
│   ├── useSubGroups.ts            ← useLiveQuery on subgroups for a plantation
│   ├── useTrees.ts                ← useLiveQuery on trees for a subgroup
│   └── usePlantationSpecies.ts    ← Query species for plantation (read-only)
└── components/
    ├── SpeciesButtonGrid.tsx      ← 4-column grid, N/N button at top
    ├── SpeciesButton.tsx          ← Individual species button with flash feedback
    ├── TreeRow.tsx                ← Last-3 display row (position + code)
    └── SubGroupStateChip.tsx      ← Colored chip for activa/finalizada/sincronizada
```

### Expo Router Navigation Structure
The current (tecnico) group has only `plantaciones.tsx` and `perfil.tsx`. Phase 2 needs stack navigation inside the plantation flow:

```
app/
└── (tecnico)/
    ├── _layout.tsx               ← existing Tabs layout (unchanged)
    ├── plantaciones.tsx          ← replace placeholder with plantation list
    ├── perfil.tsx                ← unchanged
    └── plantation/               ← new folder for stack screens
        ├── [id].tsx              ← SubGroup list for plantation
        ├── subgroup/
        │   ├── [id].tsx          ← Tree registration screen
        │   └── nn-resolution.tsx ← N/N resolution screen
        └── nuevo-subgrupo.tsx    ← Create SubGroup form
```

**Important:** Expo Router uses file-based routing. The Tabs layout at `(tecnico)/_layout.tsx` wraps tab screens. Stack screens within a tab must be nested using a Stack layout or by using `router.push()` to navigate outside the tabs. The recommended approach is to push plantation screens as modal/stack routes within the `(tecnico)` group using a nested `_layout.tsx` with Stack navigator.

### Pattern: useLiveQuery for Reactive Tree Count
```typescript
// src/hooks/useTrees.ts
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../database/client';
import { trees } from '../database/schema';
import { eq, desc } from 'drizzle-orm';

export function useTreesForSubGroup(subgrupoId: string) {
  return useLiveQuery(
    db.select().from(trees)
      .where(eq(trees.subgrupoId, subgrupoId))
      .orderBy(desc(trees.posicion))
  );
}
```
When a tree is inserted, the hook auto-fires, the count updates, and the last-3 list refreshes. No manual state updates needed.

### Pattern: Position Auto-Increment (Safe Under Rapid Taps)
SQLite WAL mode (already enabled) makes concurrent reads safe. Position calculation:

```typescript
// In TreeRepository.ts
export async function insertTree(params: InsertTreeParams): Promise<Tree> {
  const [maxResult] = await db
    .select({ max: max(trees.posicion) })
    .from(trees)
    .where(eq(trees.subgrupoId, params.subgrupoId));

  const nextPosition = (maxResult?.max ?? 0) + 1;
  const subId = generateSubId(params.subgrupoCodigo, params.especieCodigo, nextPosition);

  const [inserted] = await db.insert(trees).values({
    id: crypto.randomUUID(),
    subgrupoId: params.subgrupoId,
    especieId: params.especieId,
    posicion: nextPosition,
    subId,
    fotoUrl: params.fotoUrl ?? null,
    usuarioRegistro: params.userId,
    createdAt: new Date().toISOString(),
  }).returning();

  return inserted;
}
```

**Pitfall:** Do NOT compute position in React state — always query MAX from DB. This prevents double-registration if the user taps twice very fast.

### Pattern: SubID Generation
```typescript
// src/utils/idGenerator.ts
export function generateSubId(
  subgrupoCodigo: string,
  especieCodigo: string,
  posicion: number
): string {
  return `${subgrupoCodigo}${especieCodigo}${posicion}`;
}
// Example: generateSubId('L23B', 'ANC', 12) → 'L23BANC12'
// N/N:    generateSubId('L23B', 'NN', 5)   → 'L23BNN5'
```

### Pattern: Reverse Order (Transaction)
```typescript
// src/utils/reverseOrder.ts
export function computeReversedPositions(
  trees: { id: string; posicion: number }[]
): { id: string; newPosicion: number }[] {
  const total = trees.length;
  return trees.map(t => ({
    id: t.id,
    newPosicion: total - t.posicion + 1,
  }));
}

// In TreeRepository.ts
export async function reverseTreeOrder(subgrupoId: string, subgrupoCodigo: string): Promise<void> {
  const allTrees = await db.select().from(trees).where(eq(trees.subgrupoId, subgrupoId));
  const reversed = computeReversedPositions(allTrees);

  // Fetch species codes for SubID recalculation
  await db.transaction(async (tx) => {
    for (const { id, newPosicion } of reversed) {
      const tree = allTrees.find(t => t.id === id)!;
      const species = await tx.select({ codigo: speciesTable.codigo })
        .from(speciesTable).where(eq(speciesTable.id, tree.especieId ?? ''));
      const especieCodigo = species[0]?.codigo ?? 'NN';
      const newSubId = generateSubId(subgrupoCodigo, especieCodigo, newPosicion);
      await tx.update(trees)
        .set({ posicion: newPosicion, subId: newSubId })
        .where(eq(trees.id, id));
    }
  });
}
```

**Key insight:** Reverse order must also recalculate SubIDs — not just positions. SubID embeds position number.

### Pattern: N/N Photo Capture
```typescript
// src/services/PhotoService.ts
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export async function captureNNPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
  });

  if (result.canceled) return null;

  const uri = result.assets[0].uri;
  // CRITICAL: Copy from temp location to permanent documentDirectory
  const filename = `nn_${Date.now()}.jpg`;
  const dest = `${FileSystem.documentDirectory}photos/${filename}`;
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}photos/`, { intermediates: true });
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}
```

**Critical pitfall:** expo-image-picker returns a temp URI. If you store that URI in SQLite and restart the app, the file may be gone. Always copy to `FileSystem.documentDirectory` before saving the path.

### Pattern: Button Tap Visual Feedback
Use React Native's built-in `Pressable` with `onPressIn` to trigger a local state flash — no animation library needed:

```typescript
// SpeciesButton.tsx
const [pressed, setPressed] = useState(false);

<Pressable
  onPressIn={() => setPressed(true)}
  onPressOut={() => setPressed(false)}
  onPress={() => onRegister(species)}
  style={[styles.button, pressed && styles.buttonPressed]}
>
  <Text style={styles.code}>{species.codigo}</Text>
  <Text style={styles.name}>{species.nombre}</Text>
</Pressable>
```

Using `Pressable` with `onPressIn`/`onPressOut` gives instant visual feedback without blocking the registration call on `onPress`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive tree count | useState + manual refresh | `useLiveQuery` (Drizzle) | Auto-fires on INSERT; no stale counts |
| Photo permission handling | Custom permission flow | `expo-image-picker` built-in | Handles iOS/Android permission dialogs declaratively |
| Photo URI permanence | Store temp picker URI | `expo-file-system` copy to documentDirectory | Picker temp URIs are not guaranteed to survive app restarts |
| SQLite transactions for reverse | Manual BEGIN/COMMIT | `db.transaction(async (tx) => {...})` | Drizzle wraps expo-sqlite transactions cleanly |
| UUID generation | Custom ID function | `crypto.randomUUID()` | Available in React Native 0.73+ / Expo SDK 50+; no dependency needed |
| Unique constraint enforcement | SELECT + INSERT in app code | DB-level unique index + catch error | Application-level check has TOCTOU race; DB constraint is authoritative |

**Key insight:** SQLite + useLiveQuery eliminates the need for any external state management (Zustand, Context) for tree data. The database IS the reactive state.

---

## Common Pitfalls

### Pitfall 1: Storing expo-image-picker Temp URI in SQLite
**What goes wrong:** App stores `result.assets[0].uri` directly. After app restart or OS memory pressure, the temp file is gone. User opens N/N resolution screen — photo missing.
**Why it happens:** The picker returns a cache/temp path by design.
**How to avoid:** Always copy to `FileSystem.documentDirectory/photos/` immediately after capture. Store only the permanent path.
**Warning signs:** Photos disappear after phone restart during testing.

### Pitfall 2: Computing Next Position in React State
**What goes wrong:** Screen tracks `treeCount` in useState. User taps twice rapidly — both taps read count=5, both insert posicion=6, creating a duplicate position.
**Why it happens:** React state lags behind DB writes when taps are faster than re-renders.
**How to avoid:** Always compute `MAX(posicion) + 1` via DB query inside the INSERT function. Never trust React state for position.
**Warning signs:** Duplicate position numbers appearing in tree list.

### Pitfall 3: Forgetting to Recalculate SubIDs When Reversing Order
**What goes wrong:** Reverse order updates positions but leaves SubIDs stale. SubID embeds position number. Data is corrupt.
**Why it happens:** Easy to forget SubID contains position.
**How to avoid:** Reverse order must UPDATE both `posicion` AND `subId` for every tree. Must run in a transaction.
**Warning signs:** SubIDs don't match actual positions in export data.

### Pitfall 4: Navigation Architecture for Stack Screens Inside Tabs
**What goes wrong:** Plantation detail screens pushed inside the `(tecnico)` tab group don't show a back button or the tab bar disappears in unexpected ways.
**Why it happens:** Expo Router's Tab layout does not automatically create a Stack inside each tab.
**How to avoid:** Add a `_layout.tsx` inside the `plantation/` folder that wraps routes in a `<Stack>`. The Tabs layout at the top level handles the tab bar; Stack handles the push navigation within the plantation flow.
**Warning signs:** Tab bar visible on registration screen (should be hidden), or back navigation broken.

### Pitfall 5: Unique Constraint on SubGroup Code at Application Level Only
**What goes wrong:** Two technicians on the same device create SubGroups with the same code in the same plantation (e.g., rapid sequence). App-level check passes because the check and insert aren't atomic.
**Why it happens:** No DB-level unique constraint on `(plantacion_id, codigo)`.
**How to avoid:** Add unique index to subgroups schema. Catch SQLite UNIQUE constraint violation in the repository and surface as user-facing error "Este código ya existe en la plantación."
**Warning signs:** Duplicate codes visible in subgroup list.

### Pitfall 6: Missing plantation_species Table Causes Empty Grid
**What goes wrong:** Registration screen opens, species grid is empty. All species are seeded globally but `plantation_species` link table doesn't exist.
**Why it happens:** Domain model §6 requires plantation-species association, but Phase 1 schema omitted this table.
**How to avoid:** Add `plantation_species` table in schema + seed it with all species for the existing plantation, in the same Wave 0 task as schema migration.
**Warning signs:** Empty grid on registration screen.

### Pitfall 7: expo-image-picker Not Installed
**What goes wrong:** N/N button tap crashes — "Cannot find module 'expo-image-picker'".
**Why it happens:** The library is referenced in STACK.md but was not installed in Phase 1.
**How to avoid:** Install `expo-image-picker` and `expo-file-system` as the first task of Phase 2, before any N/N screen work.

---

## Code Examples

### SubGroup Repository Pattern (follow useAuth.ts structure)
```typescript
// src/repositories/SubGroupRepository.ts
import { db } from '../database/client';
import { subgroups } from '../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

export function useSubGroupsForPlantation(plantacionId: string) {
  return useLiveQuery(
    db.select().from(subgroups)
      .where(eq(subgroups.plantacionId, plantacionId))
      .orderBy(desc(subgroups.createdAt))
  );
}

export async function createSubGroup(params: {
  plantacionId: string;
  nombre: string;
  codigo: string;
  tipo: 'linea' | 'parcela';
  usuarioCreador: string;
}): Promise<{ success: true; id: string } | { success: false; error: 'codigo_duplicate' | 'unknown' }> {
  try {
    const id = crypto.randomUUID();
    await db.insert(subgroups).values({
      id,
      plantacionId: params.plantacionId,
      nombre: params.nombre,
      codigo: params.codigo.toUpperCase(),
      tipo: params.tipo,
      estado: 'activa',
      usuarioCreador: params.usuarioCreador,
      createdAt: new Date().toISOString(),
    });
    return { success: true, id };
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'codigo_duplicate' };
    }
    return { success: false, error: 'unknown' };
  }
}

export async function finalizeSubGroup(subgrupoId: string): Promise<void> {
  await db.update(subgroups)
    .set({ estado: 'finalizada' })
    .where(eq(subgroups.id, subgrupoId));
}
```

### Tree Hook (Live Query)
```typescript
// src/hooks/useTrees.ts
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../database/client';
import { trees } from '../database/schema';
import { eq, desc } from 'drizzle-orm';

export function useTrees(subgrupoId: string) {
  const { data } = useLiveQuery(
    db.select().from(trees)
      .where(eq(trees.subgrupoId, subgrupoId))
      .orderBy(desc(trees.posicion))
  );
  const allTrees = data ?? [];
  const lastThree = allTrees.slice(0, 3);
  const totalCount = allTrees.length;
  const unresolvedNN = allTrees.filter(t => t.especieId === null).length;
  return { allTrees, lastThree, totalCount, unresolvedNN };
}
```

### N/N Registration Flow
```typescript
// In registration screen — N/N button handler
async function handleNNTap() {
  const photoUri = await PhotoService.captureNNPhoto();
  if (!photoUri) return; // User cancelled camera — do NOT register tree

  await TreeRepository.insertTree({
    subgrupoId,
    subgrupoCodigo,
    especieId: null,     // null = N/N
    especieCodigo: 'NN',
    fotoUrl: photoUri,
    userId: session.userId,
  });
  // useLiveQuery fires automatically — no manual state update needed
}
```

### SubGroup Code Uniqueness Seed Issue
For Phase 2 to work, the existing plantation in the DB needs its species linked via `plantation_species`. A seed function following the `seedSpeciesIfNeeded` pattern:

```typescript
// src/database/seeds/seedPlantationSpecies.ts
export async function seedPlantationSpeciesIfNeeded(plantacionId: string): Promise<void> {
  const [result] = await db.select({ count: count() })
    .from(plantationSpecies)
    .where(eq(plantationSpecies.plantacionId, plantacionId));
  if (result.count > 0) return;

  const allSpecies = await db.select().from(species).orderBy(species.codigo);
  await db.insert(plantationSpecies).values(
    allSpecies.map((s, i) => ({
      id: crypto.randomUUID(),
      plantacionId,
      especieId: s.id,
      ordenVisual: i,
    }))
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Manual `useState` for tree list | `useLiveQuery` from Drizzle | useLiveQuery is the standard for expo-sqlite + Drizzle; auto-reactive |
| expo-camera for photo capture | `expo-image-picker` | Image picker handles both camera and gallery; simpler API; standard for 2025+ |
| Class-based repositories | Function-based repository modules | Consistent with Phase 1 pattern (no classes used) |
| Confirmation on every tree tap | Single tap, no confirmation | Explicitly required — doubles registration time unacceptably |

**Confirmed current as of 2026-03-17:** expo-image-picker ~16.x is SDK 52 compatible (SDK 52 = Expo 52 not 55 as STACK.md describes; same library, correct version resolved by `npx expo install`).

---

## Open Questions

1. **plantation_users scope for Phase 2**
   - What we know: Plantaciones screen must show assigned plantations to technician (domain rule). The `plantation_users` table is not in schema.
   - What's unclear: Should Phase 2 implement filtered plantation list (requires plantation_users table), or show all plantations (simpler, acceptable for 2-technician MVP)?
   - Recommendation: Show all plantations for Phase 2. Phase 3/4 handles assignment. Document as known simplification.

2. **Plantation seeded for demo?**
   - What we know: Phase 1 seeded species and users in Supabase. Local SQLite has species. No plantation exists in local DB.
   - What's unclear: Does a plantation need to be seeded locally for Phase 2 testing? The admin plantation creation is Phase 4.
   - Recommendation: Seed one demo plantation in local SQLite (similar to species seed pattern) so Phase 2 can be tested end-to-end. Wave 0 task.

3. **expo-image-picker API change in SDK 52**
   - What we know: `MediaTypeOptions` was deprecated in favor of `MediaType` in newer versions.
   - What's unclear: Exact API surface for SDK 52 compatible version.
   - Recommendation: Verify with `npx expo install expo-image-picker` output; check the installed version's changelog before writing photo service code.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | jest-expo ~52.0.0 + @testing-library/react-native ^12.9.0 |
| Config file | `mobile/jest.config.js` |
| Quick run command | `cd mobile && npx jest --testPathPattern="tests/(database\|auth)" --passWithNoTests` |
| Full suite command | `cd mobile && npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUBG-01 | Create SubGroup inserts correct row | unit | `npx jest tests/database/subgroup.test.ts -x` | ❌ Wave 0 |
| SUBG-02 | Duplicate code rejected | unit | `npx jest tests/database/subgroup.test.ts -x` | ❌ Wave 0 |
| SUBG-03 | Last SubGroup name returned | unit | `npx jest tests/database/subgroup.test.ts -x` | ❌ Wave 0 |
| SUBG-05 | Finalization blocked with N/N | unit | `npx jest tests/database/subgroup.test.ts -x` | ❌ Wave 0 |
| SUBG-07 | Only creator can edit | unit | `npx jest tests/database/subgroup.test.ts -x` | ❌ Wave 0 |
| TREE-02/03 | Insert tree increments position correctly | unit | `npx jest tests/database/tree.test.ts -x` | ❌ Wave 0 |
| TREE-04 | SubID generated correctly | unit | `npx jest tests/utils/idGenerator.test.ts -x` | ❌ Wave 0 |
| TREE-07 | Delete last tree only | unit | `npx jest tests/database/tree.test.ts -x` | ❌ Wave 0 |
| REVR-01/02 | Reverse recalculates positions AND SubIDs | unit | `npx jest tests/utils/reverseOrder.test.ts -x` | ❌ Wave 0 |
| NN-02 | N/N registration aborts without photo | manual-only | — | N/A — requires camera |
| TREE-01/06 | Species grid renders, camera opens | manual-only | — | N/A — requires device |

### Sampling Rate
- **Per task commit:** `cd mobile && npx jest tests/utils/ --passWithNoTests`
- **Per wave merge:** `cd mobile && npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `mobile/tests/database/subgroup.test.ts` — covers SUBG-01, SUBG-02, SUBG-03, SUBG-05, SUBG-07
- [ ] `mobile/tests/database/tree.test.ts` — covers TREE-02, TREE-03, TREE-07, NN-04, REVR-01, REVR-02
- [ ] `mobile/tests/utils/idGenerator.test.ts` — covers TREE-04
- [ ] `mobile/tests/utils/reverseOrder.test.ts` — covers REVR-01, REVR-02
- [ ] `mobile/tests/__mocks__/expo-image-picker.js` — mock for N/N tests (camera not available in test env)
- [ ] `mobile/tests/__mocks__/expo-file-system.js` — mock for photo service tests

---

## Sources

### Primary (HIGH confidence)
- `/mobile/src/database/schema.ts` — Confirmed actual schema; identified gaps
- `/mobile/src/database/client.ts` — WAL mode confirmed, Drizzle client confirmed
- `/mobile/src/hooks/useAuth.ts` — Hook pattern to mirror for new hooks
- `/mobile/package.json` — Actual installed versions (Expo SDK 52, not 55)
- `docs/domain-model.md` — Domain rules (SubID format, N/N rules, position rules)
- `docs/ui-ux-guidelines.md` — Field constraints (60pt buttons, no confirmations)
- `.planning/phases/02-field-registration/02-CONTEXT.md` — All locked decisions
- Drizzle ORM official docs (useLiveQuery pattern) — verified in ARCHITECTURE.md
- expo-image-picker official docs — verified in STACK.md

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — Reverse order pitfall, repository pattern
- `.planning/research/STACK.md` — expo-image-picker API, file-system copy pattern

### Tertiary (LOW confidence — verify at implementation time)
- expo-image-picker API surface for SDK 52 (`MediaType` vs `MediaTypeOptions`) — verify on install
- `crypto.randomUUID()` availability in Expo SDK 52 environment — verify in test setup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json + existing Phase 1 code
- Schema gaps: HIGH — confirmed by reading schema.ts against domain model requirements
- Architecture: HIGH — established in Phase 1 research + existing hook patterns
- N/N photo flow: MEDIUM — pattern is correct but expo-image-picker API version needs verification on install
- Navigation structure: MEDIUM — Expo Router nested Stack-in-Tab pattern is standard but needs validation in running app

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack; no fast-moving dependencies introduced)
