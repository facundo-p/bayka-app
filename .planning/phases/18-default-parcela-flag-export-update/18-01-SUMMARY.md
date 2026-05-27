---
phase: 18
plan: 1
subsystem: plantation-creation
tags: [feature-flag, parcela, atomicity, trial]
requires:
  - ParcelaRepository.createParcela (Phase 16-02)
  - PlantationRepository.createPlantation / createPlantationLocally (Phase 16-01)
provides:
  - AUTO_PARCELA_DEFAULT compile-time flag
  - createPlantationWithDefaultParcela helper (online + offline)
affects:
  - usePlantationAdmin.handleCreateSubmit (single user-initiated call site)
tech_stack:
  patterns:
    - "First feature-flag file (mobile/src/config/featureFlags.ts) — sets pattern for v1.1 trial flags"
    - "Service-layer orchestration of multiple repositories under a single helper"
    - "Manual rollback (catch + db.delete) instead of db.transaction — runtime-agnostic across better-sqlite3 (tests) and expo-sqlite (prod)"
key_files:
  created:
    - mobile/src/config/featureFlags.ts
    - mobile/src/services/PlantationCreationService.ts
    - mobile/tests/config/featureFlags.test.ts
    - mobile/tests/integration/PlantationCreationService.test.ts
  modified:
    - mobile/src/hooks/usePlantationAdmin.ts
decisions:
  - "D-18-04 best-effort: db.transaction wraps async work but better-sqlite3 driver is sync. Implementación cambió a manual rollback explícito (Rule 1 fix) para garantizar comportamiento consistente test/prod."
  - "Integration test placed under tests/integration/ (no tests/services/ como planeado) porque better-sqlite3 sólo está wired en jest.integration.config.js."
metrics:
  duration: "~30 min"
  completed: "2026-05-27"
  tasks: "4/4"
  commits: 4
---

# Phase 18 Plan 1: Feature flag AUTO_PARCELA_DEFAULT + helper Summary

Flag compile-time `AUTO_PARCELA_DEFAULT` (default ON v1.1) + servicio aislado `createPlantationWithDefaultParcela` que crea plantación + `Parcela 1`/`P1` con rollback manual ante fallo de la parcela.

## Outcomes

- Constante `AUTO_PARCELA_DEFAULT = true` en `mobile/src/config/featureFlags.ts` con JSDoc explicativo (trial v1.1, cómo desactivar, no-backfill D-18-07).
- `PlantationCreationService.createPlantationWithDefaultParcela({lugar,periodo,organizacionId,creadoPor,mode})` orquesta:
  1. Plantation create (online via `createPlantation` o offline via `createPlantationLocally` según `mode`).
  2. Si flag ON → `createParcela({nombre:'Parcela 1',codigo:'P1',descripcion:null,plantacionId})`.
  3. Si parcela falla → `db.delete(plantations)` por id (manual rollback) + rethrow.
- Single call site: `usePlantationAdmin.handleCreateSubmit` con NetInfo branching preservado (online try / offline fallback / network-error fallback). Imports de `createPlantation` / `createPlantationLocally` removidos del hook (sólo el helper).
- 5 marker comments `// FEATURE: auto-parcela trial — …` distribuidos en service header, bloque interno del flag, helper helper, import del hook, y función `handleCreateSubmit` para remoción mecánica (PDEF-03).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1.1 | Create `featureFlags.ts` with `AUTO_PARCELA_DEFAULT` + JSDoc | f25f6a7 |
| 1.2 | Implement `PlantationCreationService.ts` + helper | 7d8e585 |
| 1.3 | Integrate helper in `usePlantationAdmin.handleCreateSubmit` | 7ffc62a |
| 1.4 | Unit + integration tests + Rule-1 fix (manual rollback) | 535cb8a |

## Success Criteria

- [x] **SC#1** `featureFlags.ts` con `AUTO_PARCELA_DEFAULT = true` + JSDoc (trial scope, disable steps, no-backfill).
- [x] **SC#2** Helper con flag ON deja plantación + parcela `Parcela 1` / `P1` / `descripcion=null` / `pendingSync=true` vinculadas por `plantacionId` (integration test passing).
- [x] **SC#3** Lógica del trial en 1 archivo (`PlantationCreationService.ts`) + 1 call site (`usePlantationAdmin.ts`); ambos con marker; `AUTO_PARCELA_DEFAULT` referenciado en exactamente 2 archivos de `src/` (`featureFlags.ts` def + JSDoc, `PlantationCreationService.ts` import + branch).
- [x] **SC#4** Flag OFF → solo plantación, 0 parcelas (integration test verifica).
- [x] **SC#6** Tests: flag value, flag=true (ambos rows), flag=false (solo plantación), rollback (plantación NO existe), idempotencia.

## Verification Gates

1. `cd mobile && npx tsc --noEmit` → **exit 0, 0 errors**.
2. `cd mobile && npx jest --watchman=false tests/config/featureFlags.test.ts` → **1/1 pass**.
3. `cd mobile && npx jest --config jest.integration.config.js --watchman=false tests/integration/PlantationCreationService.test.ts` → **4/4 pass**.
4. `cd mobile && npx jest --watchman=false tests/hooks/usePlantationAdmin.test.ts tests/admin/ tests/config/` → **43/43 pass, 0 regresiones**.
5. `grep -rn "// FEATURE: auto-parcela trial" mobile/src` → 4 hits (service ×2 + hook ×2) ≥ plan-stipulated 3.
6. `grep -rn "AUTO_PARCELA_DEFAULT" mobile/src` → only `featureFlags.ts` + `PlantationCreationService.ts` (matches plan SC#3).
7. Full default suite: **354/367 pass** (13 pre-existing Phase 16 failures unchanged: pullFromServer, SyncPhotoFlow, CrossDeviceSync).
8. Full integration suite: **78/80 pass** (2 pre-existing Phase 16 failures: group-lifecycle, sync-pipeline).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] db.transaction async-rejection escapes Jest catch on better-sqlite3**
- **Found during:** Task 1.4 (running the rollback test).
- **Issue:** `drizzle-orm/better-sqlite3` implementa `db.transaction(fn)` **síncronamente** (lo confirma `node_modules/drizzle-orm/better-sqlite3/session.cjs` — usa `this.client.transaction(transaction)` y `nativeTx[behavior](tx)` sin await). Cuando `fn` es async y rejecta, la rejection escapa del await chain externo y crashea Node (`Unhandled error event`). Risk #3 del plan ya anticipaba el problema parcialmente.
- **Fix:** Cambié `PlantationCreationService` de envolver el flow en `db.transaction(async () => …)` a un patrón explícito: crear plantación → `try { insertDefaultParcela } catch { db.delete(plantations).where(eq(id)); throw }`. Es runtime-agnostic (mismo comportamiento en better-sqlite3 y expo-sqlite) y verificable.
- **Caveat documentado in-file:** Online mode no rollbackea la fila de Supabase (ya commiteada cuando llegamos al catch). Risk #3 ya aceptaba esto como best-effort.
- **Files modified:** `mobile/src/services/PlantationCreationService.ts`.
- **Commit:** `535cb8a` (rebund con tests porque son una unidad lógica).

### Path Deviation (documented, not a bug)

**2. PlantationCreationService.test.ts ubicación**
- Plan dice `mobile/tests/services/PlantationCreationService.test.ts`.
- Ubicación elegida: `mobile/tests/integration/PlantationCreationService.test.ts`.
- **Razón:** El test necesita real SQLite (better-sqlite3) que sólo está wired en `jest.integration.config.js`. El default jest-expo preset no resuelve better-sqlite3 sin más mocks. Mover el test a `tests/integration/` lo ejecuta con el config correcto sin tocar `jest.config.js`.
- `featureFlags.test.ts` SÍ está en la ruta planeada (`tests/config/`) porque es trivial y no requiere SQLite.

## Pre-existing Test Failures (NOT introduced)

Confirmados pre-existing post-Phase 17 (mencionados en task brief):

- `tests/sync/pullFromServer.test.ts`
- `tests/sync/SyncPhotoFlow.test.ts`
- `tests/sync/CrossDeviceSync.test.ts`
- `tests/integration/group-lifecycle.test.ts`
- `tests/integration/sync-pipeline.test.ts`

13 default + 2 integration test failures, todos pre-existing. Nuevo código no los toca.

## Risks Tracked (Plan-level)

- **Risk #3 (db.transaction async limitation):** mitigado mediante Rule-1 fix (manual rollback). Documentado in-file.
- **Risk #2 (pull/sync inadvertently calls helper):** verificado vía grep — helper sólo importado en `usePlantationAdmin.ts`.
- **Risk #4 (hardcode "P1" collision):** N/A en práctica (flag ON día uno + no backfill).

## Removal Recipe (if trial dropped)

1. `rm mobile/src/services/PlantationCreationService.ts`
2. `rm mobile/src/config/featureFlags.ts` (o flip a `false` si querés mantener el archivo para futuras flags).
3. En `mobile/src/hooks/usePlantationAdmin.ts`:
   - Restore imports `createPlantation, createPlantationLocally` from `../repositories/PlantationRepository`.
   - Remove import `createPlantationWithDefaultParcela`.
   - Restore `handleCreateSubmit` to call `createPlantation` / `createPlantationLocally` directly (revert commit 7ffc62a o reescribir las 3 llamadas).
4. `rm mobile/tests/integration/PlantationCreationService.test.ts mobile/tests/config/featureFlags.test.ts`.
5. Commit: 1 commit mecánico, ~30 líneas de diff.

## Self-Check: PASSED

Files verified to exist:
- FOUND: mobile/src/config/featureFlags.ts
- FOUND: mobile/src/services/PlantationCreationService.ts
- FOUND: mobile/tests/config/featureFlags.test.ts
- FOUND: mobile/tests/integration/PlantationCreationService.test.ts

Commits verified to exist:
- FOUND: f25f6a7 (Task 1.1)
- FOUND: 7d8e585 (Task 1.2)
- FOUND: 7ffc62a (Task 1.3)
- FOUND: 535cb8a (Task 1.4)
