# Phase 18: Default Parcela trial flag + Export update - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md Phase 18 + REQUIREMENTS PDEF-01..04 + EXPO-PARC-01..02

<domain>
## Phase Boundary

Cerrar el milestone v1.1 con dos features finales:

1. **Feature flag `AUTO_PARCELA_DEFAULT`** — auto-crear una Parcela "Parcela 1" / código "P1" al crear una Plantación nueva, funciona online y offline. Aislado en una función única para fácil remoción si la prueba en campo no convence.

2. **Export CSV/Excel actualizado** — agregar columna "Parcela" en el reporte final, con orden: ID Global, ID Parcial, Zona, Plantación, **Parcela**, Grupo, SubID, Periodo, Especie.

**En scope (Phase 18):**
- `mobile/src/config/featureFlags.ts` con la constante `AUTO_PARCELA_DEFAULT` y JSDoc explicativo.
- Helper `createPlantationWithDefaultParcela(plantationData)` que crea plantation + parcela default atomicamente (transacción local + push como unidad).
- Integración del helper en los call sites de creación de plantación (online + offline).
- Comentario marker `// FEATURE: auto-parcela trial — remove block if dropped` en la función + invocaciones para que la remoción sea mecánica.
- `ExportService` actualizado: agregar columnas Plantación + Parcela, renombrar SubGrupo→Grupo si aún no está hecho (puede que Phase 17-03 lo cubra).
- `exportQueries` actualizado: JOIN con parcelas para traer `parcela.nombre` por tree.
- Tests unitarios: flag on/off (crea/no crea parcela default), columnas de export presentes y con valores correctos.

**Fuera de scope (futuro):**
- UI toggle para que el usuario active/desactive el flag (en v1.1 el flag es compile-time constant; cambiar requiere build).
- Migración batch de plantaciones existentes para que tengan una parcela default (las 3 plantaciones consolidadas ya tienen sus parcelas reales — no necesitan default).
- Format Excel `.xlsx` si el actual es solo CSV (mantener formato actual; mejorar es out-of-scope v1.1).
- Validación adicional de la "Parcela 1" creada (ej. si el usuario después la rename, su comportamiento es como cualquier otra parcela).

</domain>

<decisions>
## Implementation Decisions

### Feature flag
- **D-18-01:** Flag es **compile-time constant** en `mobile/src/config/featureFlags.ts`. Ejemplo: `export const AUTO_PARCELA_DEFAULT = true;`. Cambiar requiere rebuild + redistribución del APK — aceptable porque es una prueba de campo, no setting de usuario.
- **D-18-02:** Default ON para v1.1 (`AUTO_PARCELA_DEFAULT = true`). El equipo prueba la feature; si la odian post-deploy, se cambia a `false` en el siguiente build (1-archivo edit + APK rebuild).
- **D-18-03:** Función `createPlantationWithDefaultParcela(plantationData)` vive en `mobile/src/services/PlantationCreationService.ts` (archivo nuevo) o como helper en `PlantationRepository.ts`. Preferencia: archivo nuevo (`PlantationCreationService.ts`) para que la remoción sea borrar 1 archivo + 1 import.
- **D-18-04:** La función orquesta: `await PlantationRepository.create(plantation)` → si flag activo `await ParcelaRepository.create({ plantationId, nombre: 'Parcela 1', codigo: 'P1' })`. Ambas mutaciones en una transacción local (Drizzle `db.transaction` si disponible) para garantizar atomicidad. Push usa el flujo normal: ambas marcadas `pending_sync=true`, el `uploadOfflinePlantations` y `pushParcelas` las suben en orden correcto (parcelas tras plantation por FK).

### Auto-creación offline
- **D-18-05:** Offline first: la parcela default se crea inmediatamente en SQLite local al crear la plantación, sin esperar al sync. El `pending_sync=true` flag se setea en ambas; sync sube las dos cuando hay conectividad.
- **D-18-06:** Si la creación de plantación falla (ej. unique constraint violation), no se crea la parcela. Si la plantación se crea OK pero la parcela falla (improbable — código "P1" debería ser único en una plantación nueva sin parcelas), se hace rollback de la plantación (transacción).
- **D-18-07:** **Caso edge** — usuario activa AUTO_PARCELA_DEFAULT después de tener plantaciones sin parcela default. NO se hace backfill automático. La feature solo aplica a plantaciones creadas con el flag activo. Plantaciones existentes quedan como estén; usuario crea parcelas manualmente.

### Export
- **D-18-08:** Orden de columnas (per ROADMAP success criterion #5): `ID Global, ID Parcial, Zona, Plantación, Parcela, Grupo, SubID, Periodo, Especie`. **9 columnas**.
- **D-18-09:** Columna "Plantación" muestra `plantation.lugar`. Columna "Parcela" muestra `parcela.nombre` (NO codigo, EXPO-PARC-02). Columna "Grupo" muestra `group.nombre` (con rename Phase 17-03 ya aplicado o aplicar aquí si no).
- **D-18-10:** Si una plantación NO tiene parcela (legacy, no creada con flag), la columna "Parcela" muestra `""` (string vacío) en lugar de "N/A" o similar — minimal noise en CSV.
- **D-18-11:** Formato sigue siendo CSV (mantener compatibilidad con scripts existentes downstream). Si el actual usa `.xlsx`, mantener xlsx — sin cambio de formato.

### Tests
- **D-18-12:** Unit tests:
  - `featureFlags.test.ts` (trivial — flag value exists).
  - `PlantationCreationService.test.ts`: flag=true crea ambas; flag=false crea solo plantation; rollback funciona si parcela create falla.
  - `ExportService.test.ts`: 9 columnas en header; valores correctos en filas; "Plantación" tiene lugar; "Parcela" tiene nombre o "" si null.
- **D-18-13:** NO integration test E2E para esta phase — la lógica es simple, unit tests cubren. Visual checkpoint manual: crear plantación nueva en device, verificar que aparece "Parcela 1" en ParcelasScreen.

### Claude's Discretion
- Si la "Parcela 1" default tiene `descripcion = NULL` o algún placeholder. Preferencia: `NULL` (consistente con cualquier parcela creada vacía).
- Si la auto-creación de parcela aparece en algún `onCreate` callback de UI o se hace silenciosamente en background. Preferencia: silenciosa en background dentro del helper — el usuario ve la plantación creada y al entrar a ParcelasScreen encuentra "Parcela 1" ya ahí.
- Si la "Parcela 1" tiene un OrangeDot inicial (porque está `pending_sync`). Comportamiento esperado: SÍ, porque acaba de crearse y aún no se sincronizó. El sync la sube en cuanto pueda.

</decisions>

<canonical_refs>
## Canonical References

### Requirements y plan
- `.planning/REQUIREMENTS.md` §"Milestone v1.1 Requirements" — PDEF-01..04, EXPO-PARC-01..02.
- `.planning/ROADMAP.md` §"Phase 18" — goal, 6 success criteria, 2 plans.

### Phase 15-17 upstream (already done)
- Phase 15..17 completas. Phase 17-01..03 entrega: ParcelasScreen, ParcelaFormModal, useParcelas, PlantationCard expansible, GruposScreen refactor con parcelaId, textos visibles renombrados.

### Data layer (consumir, no modificar)
- `mobile/src/repositories/PlantationRepository.ts` — create method.
- `mobile/src/repositories/ParcelaRepository.ts` — create method.
- `mobile/src/repositories/GroupRepository.ts` — para el JOIN en export.
- `mobile/src/queries/exportQueries.ts` — query existente del export, debe extenderse con JOIN a parcelas.

### Export pipeline
- `mobile/src/services/ExportService.ts` — donde se genera el CSV (ver línea 39 header, línea 79+ row mapping).
- `mobile/src/queries/exportQueries.ts` — queries que arman las rows.

### Convenciones
- `.claude/CLAUDE.md` §3 ≤20 líneas, §8 centralizar, §9 cero queries en pantallas.
- Memory `feedback_atomic_functions.md`, `feedback_no_duplicate_centralize.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PlantationRepository.create`**: existe, retorna la plantación creada con su id.
- **`ParcelaRepository.create`**: existe (Phase 16-02), retorna la parcela. Tiene validación de unicidad (no aplicará para "Parcela 1" en plantación nueva — siempre única).
- **`exportQueries`**: existe, devuelve filas con `plantationLugar`, `grupoNombre`, `subId`, etc. Falta agregar `parcelaNombre`.
- **Drizzle `db.transaction(...)`**: disponible en SQLite cliente para garantizar atomicidad del create plantation + parcela default.

### Established Patterns
- **Feature flag pattern**: no hay precedente en el repo. Phase 18-01 introduce el pattern (file `featureFlags.ts`). Mantenerlo simple: solo `export const NAME = true | false;` con JSDoc.
- **Service file pattern**: `mobile/src/services/*Service.ts` existentes (OfflineAuthService, ExportService, etc.).
- **CSV generation**: pattern en `ExportService.ts` líneas 39 (header) + 79 (row mapping). Agregar columnas requiere editar ambas + actualizar tipo de la row.

### Integration Points
- **Plantation create call sites**: en hooks/screens que crean plantación (probablemente `useNewPlantation` o similar). Localizar via grep `PlantationRepository.create` o `db.insert(plantations)`. Reemplazar por `createPlantationWithDefaultParcela(...)` en los call sites de usuario (NO en el sync/pull que crea plantations al bajar del server — eso ya tiene su propia parcela del server).
- **`pullService.pullPlantationMetadata`**: NO debe invocar `createPlantationWithDefaultParcela` — al pull, las parcelas vienen del server (Phase 16-03 ya implementó `pullParcelas`).

### Conflict / regression risks
- **`createPlantationWithDefaultParcela` invocado dos veces**: si el call site no protege, se duplican parcelas. Mitigación: la transacción + unicidad de codigo "P1" by plantation_id es defense-in-depth.
- **Flag deshabilitado mid-sync**: si un técnico crea plantación con flag=true, sube parcela "P1", luego se desactiva el flag y se actualiza APK. Las plantaciones antiguas tienen "P1" — sigue funcionando porque "Parcela 1" es como cualquier otra. No requiere migración.
- **Export con plantaciones legacy sin parcela**: campo "Parcela" vacío. Verifica que el CSV parsea OK sin choking.

</code_context>

<specifics>
## Specific Ideas

- **Nombre/código de la parcela default:** `"Parcela 1"` / `"P1"`. Hardcoded en `createPlantationWithDefaultParcela` per ROADMAP. No customizable en v1.1.
- **Marker comments para remoción fácil:**
  - En la función: `// FEATURE: auto-parcela trial — remove block if dropped` arriba del bloque `if (AUTO_PARCELA_DEFAULT) { await ParcelaRepository.create(...); }`.
  - En los call sites: `// FEATURE: auto-parcela trial — call createPlantationWithDefaultParcela; if dropped revert to PlantationRepository.create directly`.
- **Distribución de 2 plans:**
  - **18-01:** Feature flag infrastructure + helper service + integration en call sites + tests (PDEF-01..04).
  - **18-02:** Export update — agregar columnas Plantación + Parcela en CSV, actualizar exportQueries, tests, visual checkpoint final (EXPO-PARC-01..02).

</specifics>

<deferred>
## Deferred Ideas

- **UI runtime toggle** del feature flag (settings screen) — futuro si la feature se queda y se quiere dar control al usuario.
- **Backfill** de plantaciones legacy con parcela default — manual o on-demand, no automático.
- **Múltiples parcelas default** configurables (ej. "Norte"/"Sur" para plantaciones grandes) — futuro.
- **Export en Excel `.xlsx`** si el actual es CSV — futuro si stakeholders piden.
- **Tests E2E del export pipeline** — fuera de scope v1.1 (unit tests suficientes).

</deferred>

---

*Phase: 18-default-parcela-flag-export-update*
*Context gathered: 2026-05-27*
