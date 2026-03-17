---
phase: 02-field-registration
verified: 2026-03-17T22:30:00Z
status: gaps_found
score: 22/23 must-haves verified
re_verification: false
gaps:
  - truth: "Technician can attach optional photo to any tree (camera or gallery)"
    status: partial
    reason: "TREE-06 — handleAddPhotoToTree is implemented in the repository (updateTreePhoto) and defined in the screen, but it is never called from any UI element. TreeRow has no photo prop and the JSX in subgroup/[id].tsx never renders a button that invokes handleAddPhotoToTree."
    artifacts:
      - path: "mobile/app/(tecnico)/plantation/subgroup/[id].tsx"
        issue: "handleAddPhotoToTree defined at line 92 but never rendered in JSX — dead code"
      - path: "mobile/src/components/TreeRow.tsx"
        issue: "No onAttachPhoto prop, no camera button in the component"
    missing:
      - "Add a camera icon/button to TreeRow that calls onAttachPhoto when pressed"
      - "Pass handleAddPhotoToTree to TreeRow via onAttachPhoto prop in the screen"
human_verification:
  - test: "Plantation list shows demo plantation"
    expected: "La Maluka - Zona Alta Lote 1 / Otoño 2026 visible in Plantaciones tab"
    why_human: "Cannot run app or verify SQLite state programmatically"
  - test: "Species grid appears with 4-column layout and N/N at top"
    expected: "10 species in 4-column grid, N/N button yellow/orange and full-width above grid"
    why_human: "Visual layout verification requires running device/simulator"
  - test: "Button press visual flash works in the field"
    expected: "Tapping species button shows brief color change before registering tree"
    why_human: "onPressIn/onPressOut behavior verified in code but visual quality needs human"
  - test: "useLiveQuery reactive update speed"
    expected: "Tree count and last-3 list update instantly after each tap"
    why_human: "Reactivity timing requires real device interaction"
---

# Phase 2: Field Registration Verification Report

**Phase Goal:** Technicians can create SubGroups, register trees by tapping species buttons, handle N/N trees, reverse order, and finalize SubGroups — entirely offline
**Verified:** 2026-03-17T22:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Schema has plantation_species table and unique index on (plantacion_id, codigo) in subgroups | VERIFIED | `schema.ts` exports `plantationSpecies` table; `subgroups` has `uniqueIndex('subgroups_plantation_code_unique')` on `(plantacionId, codigo)` |
| 2 | Drizzle migration 0001_noisy_triton.sql generated with both DDL statements | VERIFIED | `drizzle/0001_noisy_triton.sql` contains `CREATE TABLE plantation_species` and `CREATE UNIQUE INDEX subgroups_plantation_code_unique` |
| 3 | Demo plantation and species links exist as seed data wired into app startup | VERIFIED | `seedPlantation.ts` + `seedPlantationSpecies.ts` created; both wired into `app/_layout.tsx` after `seedSpeciesIfNeeded()` |
| 4 | generateSubId returns correct format and computeReversedPositions applies formula correctly | VERIFIED | Functions exist in `utils/idGenerator.ts` and `utils/reverseOrder.ts`; 8 unit tests pass |
| 5 | All unit tests pass (39 tests across 6 suites) | VERIFIED | `npx jest tests/utils/ tests/database/` exits 0 with 39 passing tests, 0 failures |
| 6 | createSubGroup inserts with estado=activa and rejects duplicate codigo with error 'codigo_duplicate' | VERIFIED | `SubGroupRepository.ts` lines 44-70; try/catch on UNIQUE constraint; 12 unit tests pass |
| 7 | insertTree reads MAX(posicion) from DB, never from React state | VERIFIED | `TreeRepository.ts` line 24-27 explicitly queries `max(trees.posicion)` before inserting |
| 8 | deleteLastTree deletes only the tree with MAX(posicion) | VERIFIED | `TreeRepository.ts` lines 47-57 selects `max(trees.posicion)` then deletes by ID |
| 9 | reverseTreeOrder updates both posicion AND subId atomically in a transaction | VERIFIED | `TreeRepository.ts` lines 59-88 uses `db.transaction()` and calls `generateSubId` per tree |
| 10 | resolveNNTree sets especieId and recalculates subId | VERIFIED | `TreeRepository.ts` lines 90-110 fetches species codigo, calls `generateSubId`, updates row |
| 11 | finalizeSubGroup is blocked when unresolvedNN > 0 | VERIFIED | `SubGroupRepository.ts` lines 77-92; counts `isNull(trees.especieId)` before finalizing |
| 12 | Plantation list shows live plantations with navigation to SubGroup list | VERIFIED | `plantaciones.tsx` uses `useLiveQuery` on plantations table; `router.push` to `/(tecnico)/plantation/${item.id}` |
| 13 | SubGroup list shows state chips (Activa/Finalizada/Sincronizada) with correct colors | VERIFIED | `plantation/[id].tsx` renders `<SubGroupStateChip>` per row; chip maps all 3 states to correct colors |
| 14 | Create SubGroup form shows last SubGroup reference, validates unique code, shows error on duplicate | VERIFIED | `nuevo-subgrupo.tsx` calls `getLastSubGroupName` on mount, renders "Último SubGrupo: {name}", shows 'Este código ya existe en la plantación' on `codigo_duplicate` |
| 15 | Finalizar blocked with Spanish message when N/N unresolved | VERIFIED | `plantation/[id].tsx` and `subgroup/[id].tsx` both handle `unresolved_nn` error with Spanish Alert messages |
| 16 | Only SubGroup creator sees Finalizar option | VERIFIED | `plantation/[id].tsx` line 99: `{isOwner && item.estado === 'activa' && ...}` using `canEdit()` |
| 17 | Tapping activa SubGroup navigates to tree registration; finalizada/sincronizada are read-only | VERIFIED | `plantation/[id].tsx` line 71: `if (subgroup.estado !== 'activa') return;`; line 89: `disabled={item.estado !== 'activa'}` |
| 18 | Tapping species button creates tree instantly — no dialog, no visible loading | VERIFIED | `subgroup/[id].tsx` `handleSpeciesPress` calls `insertTree()` directly; no confirmation dialog |
| 19 | N/N button opens camera immediately; if cancelled, no tree registered | VERIFIED | `handleNNPress`: `const photoUri = await captureNNPhoto(); if (!photoUri) return;` |
| 20 | Last 3 trees displayed above species grid, most recent first | VERIFIED | `subgroup/[id].tsx` uses `lastThree` from `useTrees` (DESC order); renders `TreeRow` components |
| 21 | Undo deletes only the last tree | VERIFIED | `isLast={index === 0}` and `onDelete={index === 0 ? handleUndo : undefined}`; `handleUndo` calls `deleteLastTree` |
| 22 | Reverse button shows confirmation; on confirm all positions and SubIDs recalculated | VERIFIED | `Alert.alert('Revertir Orden', ...)` before calling `reverseTreeOrder()` |
| 23 | Technician can attach optional photo to any tree | FAILED | `handleAddPhotoToTree` defined but never wired to UI — TreeRow has no camera button, JSX never calls it |

**Score:** 22/23 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mobile/src/database/schema.ts` | plantation_species table + unique index on subgroups | VERIFIED | plantationSpecies exported, uniqueIndex on (plantacionId, codigo) |
| `mobile/src/utils/idGenerator.ts` | generateSubId pure function | VERIFIED | Exports `generateSubId`, correct string concatenation |
| `mobile/src/utils/reverseOrder.ts` | computeReversedPositions pure function | VERIFIED | Exports `computeReversedPositions`, formula: total - oldPosicion + 1 |
| `mobile/src/repositories/SubGroupRepository.ts` | SubGroup CRUD | VERIFIED | Exports createSubGroup, finalizeSubGroup, getLastSubGroupName, canEdit, useSubGroupsForPlantation |
| `mobile/src/repositories/TreeRepository.ts` | Tree CRUD | VERIFIED | Exports insertTree, deleteLastTree, reverseTreeOrder, resolveNNTree, updateTreePhoto |
| `mobile/src/repositories/PlantationSpeciesRepository.ts` | Species for plantation | VERIFIED | Exports getSpeciesForPlantation with innerJoin and ordenVisual ordering |
| `mobile/src/services/PhotoService.ts` | Camera/gallery with permanent file copy | VERIFIED | captureNNPhoto and attachTreePhoto both call copyToDocument (via FileSystem.copyAsync) |
| `mobile/src/hooks/useSubGroups.ts` | Live query hook | VERIFIED | Exports useSubGroupsForPlantation using useLiveQuery |
| `mobile/src/hooks/useTrees.ts` | Live query with derived totals | VERIFIED | Exports useTrees with allTrees, lastThree, totalCount, unresolvedNN |
| `mobile/src/hooks/usePlantationSpecies.ts` | Species hook | VERIFIED | Exports usePlantationSpecies via useState+useEffect |
| `mobile/app/(tecnico)/plantaciones.tsx` | Plantation list screen | VERIFIED | useLiveQuery on plantations, FlatList, router.push on tap |
| `mobile/app/(tecnico)/plantation/_layout.tsx` | Stack navigator | VERIFIED | Stack with green header styling |
| `mobile/app/(tecnico)/plantation/[id].tsx` | SubGroup list for plantation | VERIFIED | useSubGroupsForPlantation, SubGroupStateChip, finalizeSubGroup, canEdit |
| `mobile/app/(tecnico)/plantation/nuevo-subgrupo.tsx` | Create SubGroup form | VERIFIED | createSubGroup, codigo_duplicate handling, last name reference |
| `mobile/src/components/SubGroupStateChip.tsx` | Colored state chip | VERIFIED | All 3 states with correct colors (activa=green, finalizada=orange, sincronizada=blue) |
| `mobile/src/components/SpeciesButton.tsx` | Species button with flash feedback | VERIFIED | onPressIn/onPressOut, minHeight: 60, N/N variant with yellow/orange |
| `mobile/src/components/SpeciesButtonGrid.tsx` | 4-column grid with N/N at top | VERIFIED | numColumns={4}, N/N SpeciesButton above FlatList |
| `mobile/src/components/TreeRow.tsx` | Last-3 tree row with undo | VERIFIED | posicion + subId displayed, "Deshacer" on isLast=true only |
| `mobile/app/(tecnico)/plantation/subgroup/[id].tsx` | Tree registration screen | PARTIAL | insertTree, captureNNPhoto, reverseTreeOrder, finalizeSubGroup all wired — but TREE-06 photo attachment not exposed in UI |
| `mobile/app/(tecnico)/plantation/subgroup/nn-resolution.tsx` | N/N resolution screen | VERIFIED | resolveNNTree, unresolvedTrees filter, photo display, species picker, navigation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TreeRepository.ts` | `idGenerator.ts` | `import { generateSubId }` | WIRED | Line 4: `import { generateSubId } from '../utils/idGenerator'` — used in insertTree, reverseTreeOrder, resolveNNTree |
| `TreeRepository.ts` | `reverseOrder.ts` | `import { computeReversedPositions }` | WIRED | Line 5: `import { computeReversedPositions }` — used in reverseTreeOrder |
| `useTrees.ts` | `schema.ts` | `useLiveQuery(db.select().from(trees))` | WIRED | Lines 7-11: useLiveQuery reactive query on trees table |
| `plantation/[id].tsx` | `useSubGroups.ts` | `import useSubGroupsForPlantation` | WIRED | Line 8: imported and called at line 27 |
| `plantation/[id].tsx` | `SubGroupRepository.ts` | `import finalizeSubGroup, canEdit` | WIRED | Line 8: imported; finalizeSubGroup called in handleFinalizar; canEdit called in renderSubGroup |
| `nuevo-subgrupo.tsx` | `SubGroupRepository.ts` | `import createSubGroup, getLastSubGroupName` | WIRED | Line 14: imported; both called in component |
| `subgroup/[id].tsx` | `TreeRepository.ts` | `import insertTree, deleteLastTree, reverseTreeOrder` | WIRED | Lines 15-19: imported; all three called from handlers |
| `subgroup/[id].tsx` | `useTrees.ts` | `import useTrees` | WIRED | Line 12: imported; called at line 46 |
| `subgroup/[id].tsx` | `PhotoService.ts` | `import captureNNPhoto` | WIRED | Line 21: imported; called in handleNNPress |
| `nn-resolution.tsx` | `TreeRepository.ts` | `import resolveNNTree` | WIRED | Line 16: imported; called in handleGuardar |
| `subgroup/[id].tsx` | `PhotoService.ts` | `attachTreePhoto` called via `handleAddPhotoToTree` | ORPHANED | Function defined but never invoked from JSX — TREE-06 UI gap |

### Requirements Coverage

| Requirement | Description | Source Plan | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SUBG-01 | Technician can create a SubGroup with name, code, and type | 02-01, 02-02, 02-03 | SATISFIED | createSubGroup in SubGroupRepository + nuevo-subgrupo.tsx form |
| SUBG-02 | SubGroup code must be unique within the plantation | 02-01, 02-02 | SATISFIED | uniqueIndex in schema + UNIQUE constraint handling in createSubGroup |
| SUBG-03 | System shows last created SubGroup name when creating new one | 02-02, 02-03 | SATISFIED | getLastSubGroupName + "Último SubGrupo" display in nuevo-subgrupo.tsx |
| SUBG-04 | Technician can view list of SubGroups with state indicators | 02-02, 02-03 | SATISFIED | plantation/[id].tsx with SubGroupStateChip (3 states) |
| SUBG-05 | Technician can finalize a SubGroup (activa → finalizada) | 02-02, 02-03 | SATISFIED | finalizeSubGroup + Alert confirmation in both plantation/[id].tsx and subgroup/[id].tsx |
| SUBG-06 | Synced SubGroups are immutable | 02-02, 02-03 | SATISFIED | `disabled={item.estado !== 'activa'}` in plantation/[id].tsx covers all non-activa states |
| SUBG-07 | Technician can only edit SubGroups they created | 02-02, 02-03 | SATISFIED | canEdit() checks usuarioCreador === userId AND estado !== 'sincronizada' |
| TREE-01 | Technician sees species button grid when registering trees | 02-04 | SATISFIED | SpeciesButtonGrid with 4-column layout in subgroup/[id].tsx |
| TREE-02 | One tap creates tree instantly — no confirmation | 02-02, 02-04 | SATISFIED | handleSpeciesPress calls insertTree() directly, no Alert |
| TREE-03 | Tree position increments automatically | 02-01, 02-02 | SATISFIED | insertTree reads MAX(posicion)+1 from DB |
| TREE-04 | SubID generated automatically | 02-01, 02-02 | SATISFIED | generateSubId used in insertTree, reverseTreeOrder, resolveNNTree |
| TREE-05 | Last 3 registered trees displayed on registration screen | 02-02, 02-04 | SATISFIED | useTrees.lastThree mapped to TreeRow components |
| TREE-06 | Technician can attach optional photo to any tree | 02-02, 02-04 | BLOCKED | updateTreePhoto + attachTreePhoto implemented and tested at data layer, handleAddPhotoToTree defined in screen, but no UI button calls it — camera icon missing from TreeRow |
| TREE-07 | Technician can delete the last registered tree (undo) | 02-02, 02-04 | SATISFIED | deleteLastTree called from handleUndo; isLast guard on TreeRow |
| NN-01 | Technician can register unidentified tree as N/N | 02-01, 02-02 | SATISFIED | insertTree accepts especieId=null with especieCodigo='NN' |
| NN-02 | Photo is mandatory when registering N/N tree | 02-02, 02-04 | SATISFIED | handleNNPress returns early if captureNNPhoto returns null |
| NN-03 | N/N resolution screen shows photo and species selector | 02-04 | SATISFIED | nn-resolution.tsx renders Image + FlatList species grid |
| NN-04 | Technician can resolve N/N by selecting correct species | 02-02, 02-04 | SATISFIED | resolveNNTree called in handleGuardar with validation |
| NN-05 | SubGroup with unresolved N/N cannot be synced (finalized) | 02-02, 02-03, 02-04 | SATISFIED | finalizeSubGroup blocks with 'unresolved_nn' error; both list and registration screens enforce this |
| REVR-01 | Technician can reverse tree order within a SubGroup | 02-01, 02-02, 02-04 | SATISFIED | reverseTreeOrder called via handleReverseOrder |
| REVR-02 | Reverse recalculates all tree positions | 02-01, 02-02 | SATISFIED | computeReversedPositions + generateSubId in transaction updates all rows |
| REVR-03 | Reverse only allowed before SubGroup is synced | 02-02, 02-04 | SATISFIED | Navigation gate: only activa SubGroups can be tapped in plantation/[id].tsx — so tree registration screen is only reached from activa SubGroups; reverse button has no additional state guard but structural gate prevents access for finalizada/sincronizada |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `subgroup/[id].tsx` | 92 | `handleAddPhotoToTree` defined but never invoked in JSX | Blocker | TREE-06 feature completely invisible to user — dead code |
| `subgroup/[id].tsx` | 189 | `especieCodigo={tree.especieId === null ? 'N/N' : null}` | Warning | Non-N/N trees render "N/N" in last-3 display because TreeRow falls back to `displayCode = especieCodigo ?? 'N/N'`; species code for regular trees is not shown |

### Human Verification Required

#### 1. Plantation List Shows Demo Plantation

**Test:** Launch app as tecnico, tap "Plantaciones" tab
**Expected:** "La Maluka - Zona Alta Lote 1 / Otoño 2026" visible as first plantation card
**Why human:** Cannot run Expo app or query live SQLite state programmatically

#### 2. Species Grid Visual Layout

**Test:** Navigate into an activa SubGroup
**Expected:** 10 species appear in 4-column grid, N/N button full-width in yellow/orange above grid
**Why human:** Visual layout verified in code (numColumns=4, nnRow above FlatList) but actual rendering and spacing needs device check

#### 3. One-Tap Instant Feedback

**Test:** Tap a species button
**Expected:** Button flashes color immediately (onPressIn), tree count increments instantly
**Why human:** onPressIn/onPressOut wiring confirmed in code; latency and visual quality are perceptual

#### 4. Offline Behavior

**Test:** Put device in airplane mode, register several trees including N/N
**Expected:** All operations succeed — SQLite is local, no network needed
**Why human:** Offline mode requires physical device with network toggle

### Gaps Summary

One requirement is blocked: **TREE-06** (attach optional photo to any tree).

The data layer is complete — `updateTreePhoto` in TreeRepository and `attachTreePhoto` in PhotoService both exist and work. The screen (`subgroup/[id].tsx`) even defines `handleAddPhotoToTree`. However, no UI element ever calls this handler. `TreeRow` has no camera button prop, and the JSX renders `TreeRow` components without any photo attachment trigger.

Additionally, there is a display issue (warning severity): non-N/N trees in the last-3 list render "N/N" as their species code because `especieCodigo` is passed as `null` for non-N/N trees, and `TreeRow` falls back to `'N/N'` via the nullish coalescing operator. The `subId` still shows correctly (e.g., "L1ANC3"), so the tree can be identified, but the code column is misleading.

The REVR-03 requirement (reverse only before sync) is satisfied structurally: `plantation/[id].tsx` gates navigation so only `activa` subgroups enter the tree registration screen. This is an acceptable architectural enforcement rather than an explicit state check in the screen.

---

_Verified: 2026-03-17T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
