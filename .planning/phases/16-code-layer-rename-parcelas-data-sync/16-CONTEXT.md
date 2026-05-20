# Phase 16: Code layer rename + Parcelas data + Sync - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Source:** Derived from ROADMAP.md Phase 16 + Phase 15 CONTEXT (shared branch `feat/v1.1-schema-and-rename`)

<domain>
## Phase Boundary

Alinear toda la capa de código TypeScript con el schema nuevo introducido en Phase 15:
- Rename `SubGroup`→`Group`, `subgrupo`→`grupo` en repos, hooks, queries, services y tests (todos los identificadores de código TS).
- Implementar `ParcelaRepository`, `parcelaQueries`, `useParcelas` con validaciones (unicidad de `nombre` y `codigo` per-plantación, `descripcion <= 10.000 chars`, borrado bloqueado si hay grupos hijos).
- Extender `SyncService` para pull/push de `parcelas`, conflict detection (nombre/código duplicado al subir), y propagación de OrangeDot (`pending_sync`) en la pirámide Plantación→Parcela→Grupo→Árbol.

**En scope (Phase 16):**
- Rename masivo en los 19 archivos enumerados en ROADMAP D-16 (hooks, queries, repositories, services, tests integración) + cualquier archivo TS adicional que rompa tsc tras aplicar el rename del schema (objetivo: `npx tsc --noEmit` queda en 0 errores).
- Rename de identificadores TS en screens/components que importan tipos del schema (sin tocar textos visibles renderizados — eso es Phase 17).
- `ParcelaRepository.ts`, `parcelaQueries.ts`, `useParcelas(plantacionId)` con `useLiveData`.
- `SyncService` (pullService + pushService): pull parcelas, push pending parcelas, manejo de conflictos de unicidad.
- **Soft-delete (tombstone) de parcelas** con propagación bidireccional al server (D-16-19..D-16-22).
- Tests unitarios de `ParcelaRepository`/`parcelaQueries`/`useParcelas` y test de integración del sync con SQLite real.
- Tests existentes adaptados al rename sin perder cobertura.

**Fuera de scope (otras phases):**
- UI Parcelas: `ParcelasScreen`, `ParcelaRow`, `ParcelaFormModal`, header `+`, navegación 4-niveles, expansión en `PlantationCard` — Phase 17.
- Refactor `GruposScreen` (header `+`, recibir `parcelaId`) — Phase 17.
- Textos visibles en español "Subgrupo"→"Grupo" en JSX strings, títulos, labels — Phase 17.
- Feature flag `AUTO_PARCELA_DEFAULT` + creación automática de parcela default — Phase 18.
- Export CSV/Excel con columna Parcela — Phase 18.

</domain>

<decisions>
## Implementation Decisions

### Rename strategy
- **D-16-01:** Rename **directo, sin alias ni deprecación**. La firma vieja queda eliminada; toda referencia se actualiza en el mismo plan (consistente con D-16 de Phase 15: idGenerator firma vieja eliminada en P15, call sites actualizados en P16).
- **D-16-02:** Rename de **identificadores TS** (variables, types, props, function names, parámetros) en TODO archivo TS que los use, no solo los 19 con errores tsc. Phase 17 cubre solo textos renderizados (strings JSX/labels). Si un screen tiene `const subgrupoId = ...` o `interface Props { subgrupo: SubGroup }`, esos identificadores se renombran en 16-01.
- **D-16-03:** **Archivos histíricos preservados sin tocar**: migrations Drizzle/Supabase ya escritas (`0000_..0011_*.sql`, `001_..013_*.sql`), comentarios de evolución/changelogs, y archivos `.planning/` históricos. Solo se renombra código activo TS.
- **D-16-04:** **File renames** se aplican donde el nombre del archivo refleja el rename: `SubGroupRepository.ts`→`GroupRepository.ts`, `useNewSubgroup.ts`→`useNewGroup.ts` (cuando aplica), `subgroup-lifecycle.test.ts`→`group-lifecycle.test.ts`, `NuevoSubgrupoScreen.tsx`→`NuevoGrupoScreen.tsx` (archivo solo; ruta navegación queda como decida 16-01 — si la ruta se mantiene para no romper Phase 17, dejar explícito).
- **D-16-05:** Plan 16-01 termina con **`npx tsc --noEmit` limpio (0 errores)** y **`npm test` (unit) verde** como gate antes de avanzar a 16-02.

### Parcela data layer
- **D-16-06:** `ParcelaRepository` espeja la API de `PlantationRepository`/`GroupRepository`: `create`, `update`, `delete`, `findById`, `findByPlantacion`, `markPendingSync`. CRUDs marcan `pending_sync=true` automáticamente.
- **D-16-07:** **Validaciones de unicidad en el repository** (no en el screen): `create`/`update` consulta la DB local; si hay colisión, lanza `UniqueConstraintError` con detalle de qué campo (`nombre` o `codigo`) y la parcela en conflicto. Pattern espejo del que tenga `PlantationRepository`/`SubGroupRepository` actual; si no existe, se introduce con este shape.
- **D-16-08:** **`descripcion <= 10.000 chars`** validado en el repository (tanto `create` como `update`). Server tiene CHECK constraint (P15-MIGR-CHK); cliente valida primero para UX inmediato.
- **D-16-09:** **Borrado bloqueado si hay grupos hijos**: `delete(parcelaId)` cuenta grupos asociados (filtrando tombstones); si `> 0`, lanza `HasChildrenError`. La pantalla muestra el error; no se borra cascada. Espejo del comportamiento Plantation→Grupo si existe; si no, este es el pattern canónico.
- **D-16-10:** **`parcelaQueries.ts`** expone agregaciones reutilizables: conteo de grupos, conteo de árboles, lista con stats, freshness. Mismo split que las queries existentes (CLAUDE.md §9: queries reutilizables fuera de pantallas).
- **D-16-11:** **`useParcelas(plantacionId)`** retorna `{ parcelas, isLoading, error }` reactivo vía `useLiveData` (pattern de Phase 13). Sin queries SQL en el hook — invoca `parcelaQueries.listByPlantacion(plantacionId)`.

### Sync extension
- **D-16-12:** **Pull parcelas** se integra al `pullService` existente. Mismo flujo bidireccional Phase 13: descarga `parcelas` del server con `ON CONFLICT REPLACE`. El pull de parcelas ocurre **antes** que el pull de groups (los groups tienen FK a parcelas, hay que tener la parcela antes para no violar la FK).
- **D-16-13:** **Push parcelas** se integra al `pushService`. Sube `parcelas` con `pending_sync=true`. Push de parcelas **antes** que push de groups (FK).
- **D-16-14:** **Conflict detection** en push: si server rechaza por unicidad (nombre/código duplicado en otra parcela del mismo plantación), el cliente NO limpia el `pending_sync`. Muestra error al usuario y deja la parcela local pendiente. Pattern espejo del conflict handling de árboles (Phase 13) donde `conflict_especie_id` queda persistido.
- **D-16-15:** **OrangeDot propagation**: el pending_sync de una parcela debe propagarse "hacia arriba" para que el contador `usePendingSyncCount` lo refleje. Si ya hay un agregador global, se extiende para incluir parcelas; si no, se agrega `parcelas` al conteo. Pattern espejo del actual para subgroups.
- **D-16-16:** **Atomic Grupo como unidad de sync** se preserva. Subir un grupo finalizado sigue siendo all-or-nothing; ahora se asegura primero que la parcela del grupo esté sincronizada (si la parcela está `pending_sync`, el grupo no puede subir hasta que la parcela suba — orden lógico).

### Soft-delete (tombstone) para parcelas
- **D-16-19:** Parcela delete es **soft-delete con tombstone**. `parcelas.deleted_at TEXT NULL` (local SQLite via Drizzle + server Supabase via migration nueva; tipo TEXT/ISO-string para alinearse con el pattern de `createdAt`/`updatedAt` ya usados en la tabla `parcelas` — ver "Schema notes" abajo). `delete(parcelaId)` hace `UPDATE parcelas SET deleted_at = ?, pending_sync = true WHERE id = ?` con `localNow()`. Queries de lectura filtran `WHERE deleted_at IS NULL` por default. Sync push sube el tombstone (server hace lo mismo); sync pull respeta el tombstone del server (no resurrecciona la fila ni pisa un tombstone local pendiente). El delete sigue bloqueado si la parcela tiene grupos hijos no-tombstoned (D-16-09 sigue valiendo).
- **D-16-20:** **Drizzle migration `0012_parcelas_deleted_at.sql`** se crea en Plan 16-02 (3 archivos: SQL + journal + migrations.js — lección Phase 13 `feedback_drizzle_migrations.md`). Solo agrega columna NULLABLE; no rompe data existente. Schema.ts agrega `deletedAt: text('deleted_at')` en el bloque de `parcelas`.
- **D-16-21:** **Supabase migration `014_parcelas_deleted_at.sql`** se crea en Plan 16-03 (donde vive el sync). Solo `ALTER TABLE parcelas ADD COLUMN deleted_at TIMESTAMPTZ NULL`. RLS existente sigue aplicando. Se ejecuta antes del integration test E2E del Task 3.6.
- **D-16-22:** **Bulk-delete cascada** no entra en scope: si una plantación se borra (futura feature), la cascada a parcelas no es responsabilidad de Phase 16. Phase 16 solo cubre delete explícito de una parcela.

### Testing
- **D-16-17:** **Tests existentes adaptados** al rename (renombrar identificadores, archivos `*subgroup*.test.ts`→`*group*.test.ts`). El conteo de assertions debe quedar igual o mayor.
- **D-16-18:** **Tests nuevos** mínimos: (a) `ParcelaRepository`: create/update/delete + unicidad + bloqueo por hijos + validación de descripcion + tombstone + restore; (b) `parcelaQueries.listByPlantacion`: orden y agregados, filtro `deleted_at IS NULL`; (c) `useParcelas`: reactivity con `useLiveData`, no incluye tombstones; (d) **integración sync end-to-end con SQLite real**: parcela creada offline → online → aparece en server; pull trae parcela del server → aparece local; conflict de unicidad al subir → error + pending_sync persistido; delete offline → online → server tombstoneado; tombstone server → pull → local tombstoneado.

### Claude's Discretion
- Si renombrar la ruta de navegación `nuevo-subgrupo`→`nuevo-grupo` (afecta deep links y Phase 17) o mantener la ruta para minimizar diff. Recomendación: mantener ruta hasta Phase 17 si reduce risk; el archivo TS sí se renombra.
- Forma exacta de exponer errores del repository: clase de error custom (`UniqueConstraintError`, `HasChildrenError`) vs strings discriminados — preferir alinear con lo que ya use `PlantationRepository`.
- Si `useNewSubgroup` se renombra a `useNewGroup` o si su lógica de creación se mueve a `useGroups` (decisión interna del rename, ambas son válidas mientras compile y tests pasen).
- Si el pull/push de parcelas se implementa como funciones separadas (`syncParcelas`) o como hooks en `pullService.run()`/`pushService.run()` — preferir el patrón existente del servicio.
- Orden interno del pull cuando un Grupo del server referencia una parcela aún no descargada: dos pasadas vs ordenamiento explícito. La FK es NOT NULL en server-side post-P15, así que orden explícito (parcelas → groups) es suficiente.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y plan de milestone
- `.planning/REQUIREMENTS.md` §"Milestone v1.1 Requirements" — GRPN-01..09 (code-layer rename), PCRD-01..07 (Parcela CRUD/repo), SYNC-PARC-01..05 (sync extension), TEST-PARC-01..03 (testing).
- `.planning/PROJECT.md` §"Current Milestone: v1.1" — contexto del milestone.
- `.planning/ROADMAP.md` §"Phase 16" — goal completo, success criteria (8 items), lista de 3 plans, Scope D-16 con los 19 archivos enumerados.

### Phase 15 (upstream — schema ya migrado)
- `.planning/phases/15-schema-migration-data-consolidation/15-CONTEXT.md` — decisiones D-13..D-16 sobre Drizzle migration y atomicidad P15+P16.
- `.planning/phases/15-schema-migration-data-consolidation/15-RESEARCH.md` — research sobre recreate-table pattern y consideraciones del rename.
- `.planning/phases/15-schema-migration-data-consolidation/15-PATTERNS.md` — pattern map de Phase 15.
- `.planning/phases/15-schema-migration-data-consolidation/15-VALIDATION.md` — qué quedó verificado en P15.

### Schema (post-Phase 15)
- `mobile/src/database/schema.ts` — schema con tabla `parcelas` y `groups` (post-P15).
- `mobile/src/utils/idGenerator.ts` — firma nueva `generateSubId(parcelaCode, groupCode, speciesCode, position)`.
- `supabase/migrations/012_parcelas_and_rename.sql` y `013_data_consolidation.sql` — referencias del shape de server.

### Archivos a modificar (D-16 del ROADMAP — 19 archivos)
- **Hooks (2):** `mobile/src/hooks/usePendingSyncCount.ts`, `mobile/src/hooks/useTrees.ts`
- **Queries (6):** `mobile/src/queries/adminQueries.ts`, `catalogQueries.ts`, `dashboardQueries.ts`, `exportQueries.ts`, `freshnessQueries.ts`, `plantationDetailQueries.ts`
- **Repositories (3):** `mobile/src/repositories/PlantationRepository.ts`, `SubGroupRepository.ts` (rename a `GroupRepository.ts`), `TreeRepository.ts`
- **Services (3):** `mobile/src/services/sync/photoService.ts`, `pullService.ts`, `pushService.ts`
- **Tests integración (5):** `mobile/tests/integration/cascade-delete.test.ts`, `role-based-access.test.ts`, `subgroup-lifecycle.test.ts` (rename a `group-lifecycle.test.ts`), `sync-pipeline.test.ts`, `tree-registration.test.ts`

Adicionalmente — identificadores TS en consumidores no compilables (screens/components/hooks que aún no rompen tsc pero usan `subgrupo`/`SubGroup` en variables/props):
- Hooks: `useNewSubgroup.ts`, `useNNFlow.ts`, `useNNResolution.ts`, `useTreeRegistration.ts`, `usePlantationDetail.ts`, `usePlantationAdmin.ts`, `useAssignTechnicians.ts`, `usePlantaciones.ts`, `useCatalog.ts`.
- Components/screens (solo identificadores TS, sin tocar strings JSX renderizados): `NuevoSubgrupoScreen.tsx`, `TreeRegistrationScreen.tsx`, `NNResolutionScreen.tsx`, `PlantationDetailScreen.tsx`, `SubgrupoForm.tsx`, `TreeRowItem.tsx`, `CatalogPlantationCard.tsx`, `TipoSegmentedControl.tsx`, `LastThreeTrees.tsx`, `SyncProgressModal.tsx`, `AdminBottomSheet.tsx`, `PlantationDetailHeader.tsx`, `PlantationCard.tsx`.

(El planner debe ejecutar `grep -rn "subgrupo\\|SubGroup" mobile/src mobile/tests` y mapear cada match a una de estas dos categorías: "identifier rename" o "visible string — defer Phase 17".)

### Archivos a crear (Parcela layer)
- `mobile/src/repositories/ParcelaRepository.ts`
- `mobile/src/queries/parcelaQueries.ts`
- `mobile/src/hooks/useParcelas.ts`
- `mobile/tests/unit/ParcelaRepository.test.ts`
- `mobile/tests/unit/parcelaQueries.test.ts`
- `mobile/tests/unit/useParcelas.test.ts`
- `mobile/tests/integration/parcela-sync.test.ts`

### Archivos a crear (tombstone migrations — D-16-20, D-16-21)
- `mobile/drizzle/0012_parcelas_deleted_at.sql` (+ update `mobile/drizzle/meta/_journal.json` + `mobile/drizzle/migrations.js`) — Plan 16-02 Task 2.1.
- `supabase/migrations/014_parcelas_deleted_at.sql` — Plan 16-03 Task 3.1.

### Sync (Phase 16 modifica estos)
- `mobile/src/services/sync/pullService.ts` — agregar pull de parcelas (antes que groups).
- `mobile/src/services/sync/pushService.ts` — agregar push de parcelas (antes que groups) y conflict handling de unicidad.
- `mobile/src/services/sync/types.ts` — extender tipos para parcelas si aplica.
- `mobile/src/hooks/usePendingSyncCount.ts` — incluir parcelas en el conteo (también está en la lista D-16).
- `mobile/src/hooks/useSync.ts` — verificar si necesita ajustes para reflejar progreso de parcelas.

### Convenciones del proyecto
- `.claude/CLAUDE.md` §3 (calidad — refactor si función >20 líneas, no duplicar), §8 (diseño centralizado), §9 (separación lógica/datos — cero queries en pantallas/componentes).
- `.planning/codebase/CONVENTIONS.md` — convenciones existentes.
- `tasks/lessons.md` — lecciones acumuladas (en particular Drizzle migrations 3-archivos, refactor audit, atomic functions).

### Contexto de phases anteriores relevantes
- `.planning/phases/13-unificar-sync-bidireccional/13-CONTEXT.md` — pull-before-push, `pending_sync`, `useLiveData`, conflict persistence.
- `.planning/phases/14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo/14-CONTEXT.md` — sync atómico del grupo, RPC `sync_subgroup`.
- `.planning/phases/11-unificar-pantallas-eliminar-screen-de-gesti-n-e-integrar-sus-acciones-en-plantationcard/` — pattern de extracción de hooks y reuso de componentes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`PlantationRepository`** — pattern de CRUD + validación + `pending_sync` flag a espejar para `ParcelaRepository`.
- **`SubGroupRepository` (→ `GroupRepository`)** — pattern de unicidad per-plantación que ahora debe ser per-parcela; en P16, además sirve de plantilla para `ParcelaRepository.create`/`update`.
- **`useLiveData`** (Phase 13) — hook reactivo para SQLite changes. `useParcelas` lo invoca.
- **`pullService.run()` / `pushService.run()`** — orquestadores de sync bidireccional Phase 13. Punto de extensión para parcelas.
- **`ON CONFLICT REPLACE`** en pull — ya implementado para grupos/árboles; se replica para parcelas.

### Established Patterns
- **CLAUDE.md §9 (cero queries en pantallas):** `ParcelaRepository` para mutaciones; `parcelaQueries` para lecturas complejas; `useParcelas` solo orquesta. Ninguna llamada `db.select`/`db.insert` desde screens.
- **CLAUDE.md §3 (función >20 líneas se refactoriza):** Repos/queries deben respetar este límite. Lessons memory `feedback_atomic_functions.md` enfatiza extraer helpers.
- **`pending_sync` boolean flag** — al crear/editar/borrar local, set `true`; push lo limpia a `false` al éxito; ante conflicto, queda `true`.
- **Spanish naming para estados** (`activa`/`finalizada`/`sincronizada`) — feedback memory `feedback_spanish_naming.md`. Aplica a errores user-facing si emergen de Parcela.
- **3-archivos Drizzle migration** aplica solamente para la migration de tombstone (`0012_parcelas_deleted_at.sql`, ver D-16-20); cualquier OTRA migration en Phase 16 sigue siendo un smell. La de tombstone es la única excepción justificada (delete-as-sync requiere la columna).

### Schema notes (post-Phase 15)
- `parcelas.createdAt` y `parcelas.updatedAt` están tipados como **`text('created_at')` / `text('updated_at')`** en `mobile/src/database/schema.ts` (líneas 32-33) — ISO 8601 strings, NO unix-ms integers. Por consistencia, `deleted_at` se introduce como **`text('deleted_at')`** (nullable). El helper `localNow()` ya devuelve ISO string en el resto del codebase; reutilizarlo en el delete del repo.

### Integration Points
- `mobile/src/database/schema.ts`: se LEE y se MODIFICA solo para agregar `deletedAt: text('deleted_at')` a la tabla `parcelas` (D-16-20). Ningún otro cambio de schema.
- `mobile/src/services/sync/pullService.ts` + `pushService.ts`: punto principal de extensión sync.
- `mobile/src/hooks/usePendingSyncCount.ts`: incluir parcelas en el cómputo.
- Tests integración: el harness existente en `mobile/tests/integration/` usa SQLite real (better-sqlite3 o similar). Replicar setup para `parcela-sync.test.ts`.

### Conflict / regression risk
- **`useNewSubgroup` (creación de grupo)**: si el grupo se crea sin `parcela_id`, viola la FK. Verificar que el rename y el flujo de creación lo incluyan (incluso si UI todavía no expone la selección de parcela — Phase 17 — debe haber un fallback temporal: la parcela default de la plantación, o explícito error).
- **OrangeDot agregador**: si la lógica vive en `usePendingSyncCount` (D-16 list), un olvido propaga silenciosamente "todo verde" cuando hay parcelas pendientes. Lección `feedback_state_lifecycle_audit.md` aplica.
- **Tests rotos por rename**: lección `feedback_refactor_audit.md` (diff old vs new tras refactor) es directamente aplicable. Plan 16-01 debe incluir un step de auditoría post-rename.

</code_context>

<specifics>
## Specific Ideas

- Phase 16 vive en la misma branch que Phase 15 (`feat/v1.1-schema-and-rename` o equivalente — confirmar nombre real con `git branch --show-current`). No se mergea hasta que ambas estén verdes (D-16 de Phase 15).
- Tras 16-01, `npx tsc --noEmit` debe quedar limpio. Es el gate primario.
- Tras 16-02, `ParcelaRepository` y `useParcelas` deben estar listos para que Phase 17 sólo construya UI sobre ellos.
- Tras 16-03, un test E2E offline→online de parcela debe pasar con SQLite real, incluyendo el roundtrip de tombstone.

</specifics>

<deferred>
## Deferred Ideas

- **UI de Parcelas** (`ParcelasScreen`, `ParcelaRow`, `ParcelaFormModal`, header `+`, navegación 4-niveles, expansión en `PlantationCard`) — Phase 17.
- **Textos visibles** "Subgrupo"→"Grupo" en JSX/strings renderizados — Phase 17.
- **Feature flag `AUTO_PARCELA_DEFAULT`** + creación automática de parcela default al crear plantación — Phase 18.
- **Export CSV/Excel con columna Parcela** — Phase 18.
- **Tests E2E con Detox/Maestro** sobre el flujo completo de Parcela en UI — fuera de scope v1.1 (manual UAT cubre).
- **Bulk-delete cascada** (plantación borrada → cascade a parcelas hijas) — D-16-22, fuera de scope.

</deferred>

---

*Phase: 16-code-layer-rename-parcelas-data-sync*
*Context derived: 2026-05-19 (manual, gsd-sdk tooling unavailable)*
*Amended 2026-05-19: D-16-19..D-16-22 (tombstone) + schema notes (TEXT type) en respuesta a checker findings.*
