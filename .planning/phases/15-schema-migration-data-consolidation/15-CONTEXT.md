# Phase 15: Schema migration + data consolidation - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Establecer la nueva estructura de schema (tabla `parcelas` con `descripcion`, rename `subgroups`→`groups` con unicidad **per-parcela**, tipo `linea | bosquete`, SubID con prefijo de Parcela) tanto en SQLite local como en Supabase, y ejecutar la consolidación de datos acordada con re-cálculo batch de los SubIDs preservados (~6.776, número a re-confirmar via auditoría).

**En scope (Phase 15):**
- Drizzle migration local: rename `subgroups`→`groups`, agregar tabla `parcelas`, agregar `groups.parcela_id` FK, swap unique indexes a per-parcela, tipo `bosquete`
- `idGenerator.generateSubId(parcelaCode, groupCode, speciesCode, position)` — firma nueva, vieja eliminada
- Supabase migration `012_parcelas_and_rename.sql`: schema (rename + tabla parcelas + CHECK constraint descripcion + RLS)
- Supabase migration `013_data_consolidation.sql`: consolidación 32→3 plantaciones + 21 parcelas + re-cálculo batch SubIDs + normalización `sincronizada`→`finalizada` + eliminación 11 plantaciones
- Backup pre-migración (`scripts/supabase-backup.sh`)
- Verification SQL script post-migration

**Fuera de scope (otras phases):**
- Rename TS `SubGroup`→`Group` en repos/hooks/queries/components/services (Phase 16)
- `ParcelaRepository`, `parcelaQueries`, `useParcelas` hook (Phase 16)
- `SyncService` extension para parcelas pull/push (Phase 16)
- UI (`ParcelasScreen`, expansión en `PlantationCard`, header `+`) (Phase 17)
- Feature flag `AUTO_PARCELA_DEFAULT` (Phase 18)
- Export CSV/Excel con columna Parcela (Phase 18)

</domain>

<decisions>
## Implementation Decisions

### Coordinación de despliegue
- **D-01:** Despliegue en **window coordinado simultáneo**. Se anuncia a los 4 técnicos un window específico; durante ese window se aplican Supabase 012 + 013 y se publica el APK con Drizzle local. Sync se reanuda con todos en schema nuevo.
- **D-02:** Sin gate técnico en RPC `sync_subgroup` (no se agrega `client_schema_version`). Se confía en el window humano. Trade-off aceptado: si un técnico no actualiza el APK a tiempo, su sync fallará con error genérico (columna no existe), pero el equipo es chico (4 personas) y la coordinación es manejable.
- **D-03:** Pre-condición obligatoria del window: **sync limpio antes**. Anuncio explícito: "Antes del window, sincronicen todos sus subgrupos pendientes". Reduce riesgo de pérdida y simplifica el primer pull post-migración.
- **D-04:** Tras la migración server, primer sync del cliente nuevo: **pull primero, luego push** (consistente con el bidireccional ya implementado en Phase 13). El cliente baja la nueva estructura del server (3 plantaciones, 21 parcelas, groups con parcela_id, SubIDs nuevos) y reemplaza su data local; después push de cualquier pending_sync residual.

### Mapping plantación origen → Parcela destino
- **D-05:** Mapping especificado como **tabla explícita** en el SQL `013_data_consolidation.sql` (`VALUES (source_plantation_id, target_parcela_codigo)` con 21 filas concretas). No se infiere por pattern matching de nombres. El mapping es auditable, revisable en PR.
- **D-06:** El mapping concreto **se genera ANTES del SQL** mediante una **auditoría a Supabase**: query que lista cada plantación origen con `id, nombre, lugar, periodo, count(grupos), count(árboles)`, y se mapea cada una a su Parcela destino (Loma-P1..P13, Medio-P1..P4, Selva Original / P3 Vieja, La Morita / Zona 1).
- **D-07:** Mapping documentado en **`supabase/migrations/data/015_consolidation_mapping.md`** (versionado en repo, revisable en PR de Phase 15). Incluye: tabla origen→destino, query SQL de auditoría usada para generarlo, checksums esperados (counts por cluster). Aprobado por el usuario antes de escribir el SQL 013.
- **D-08:** **Edge cases en la auditoría = abortar el plan**. Cualquier desviación vs lo esperado (3 plantaciones / 21 parcelas / 225 grupos / ~6.776 árboles) frena el avance hasta resolución manual. Sin defaults, sin auto-asignaciones a parcela genérica.

### Rollback y validación
- **D-09:** SQL `013_data_consolidation.sql` envuelto en **una sola transacción `BEGIN..COMMIT`** (todo o nada). Postgres garantiza ROLLBACK automático ante cualquier error. El SQL 012 (DDL) puede ir en su propia migración separada antes (DDL en Postgres también es transaccional).
- **D-10:** **Validación exhaustiva post-migración**: para cada uno de los ~6.776 árboles preservados, calcular el SubID esperado desde la data origen (parcela código + grupo código + especie código + posición) y comparar contra el resultado en server. Cualquier divergencia falla el verification script. Conteos también verificados (3 / 21 / 225 / N árboles).
- **D-11:** **Discrepancia de conteo a resolver**: el análisis previo mencionó ~7000 árboles pero MIGR-09 dice 6.776. **La auditoría pre-SQL re-confirma el número real** — esa cifra se vuelve la fuente de verdad y actualiza REQUIREMENTS.md (MIGR-09, MIGR-10) y el ROADMAP success criteria #7 antes de mergear. El verification script usa el número re-confirmado.
- **D-12:** **Recovery playbook**: ROLLBACK transaccional de Postgres es suficiente para volver al estado pre-013. Si el ROLLBACK no fuese suficiente por algún motivo, restore desde backup R2 (`scripts/supabase-backup.sh` + procedimiento documentado). Sin backup intermedio entre 012 y 013.

### Re-sync local + Drizzle rename
- **D-13:** Drizzle migration usa el **recreate-table pattern de SQLite**: CREATE `groups` con schema nuevo → `INSERT INTO groups SELECT ... FROM subgroups` con `parcela_id` default → DROP `subgroups` → recrear índices únicos per-parcela. Drizzle-kit lo genera automáticamente; preserva data local pre-window (esperada vacía gracias a la pre-condición de sync limpio, pero el patrón la conserva por si quedara algo).
- **D-14:** **Tabla `parcelas` local empieza vacía**; se llena via pull desde server en el primer sync post-migración. Lo mismo para `groups.parcela_id` de cualquier registro local residual: el server tiene el dato correcto, el pull lo sobreescribe.
- **D-15:** **SubIDs locales se actualizan via pull bidireccional** (mecanismo existente de Phase 13): el sync re-baja árboles del server con `ON CONFLICT REPLACE` (o equivalente). Tras la migración server, los árboles del server tienen SubIDs nuevos; el primer pull los reemplaza en local. **Sin lógica de re-compute de SubID en cliente** — server es source of truth para SubIDs.
- **D-16:** **`idGenerator`: firma vieja eliminada en Phase 15**. La nueva firma `generateSubId(parcelaCode, groupCode, speciesCode, position)` reemplaza completamente. Implicación aceptada: la app NO compila entre Phase 15 y Phase 16 (call sites siguen llamando con firma vieja). **Mitigación: Phase 15 + Phase 16 viven en la misma branch/PR** (`feat/v1.1-schema-and-rename`); no se mergea P15 sola. El window de despliegue cubre P15+P16 juntas.

### Claude's Discretion
- Forma exacta del verification SQL script (mismo `013_data_consolidation.sql` con `RAISE EXCEPTION` ante mismatch, vs script `.sql` separado ejecutado después de COMMIT)
- Ubicación de la query de auditoría pre-mapping (script en `scripts/`, notebook, o queries inline en el doc 015_consolidation_mapping.md)
- Si los índices únicos viejos de `subgroups` (`subgroups_plantation_code_unique`, `subgroups_plantation_name_unique`) se renombran o se DROP+CREATE
- Cómo se ejecuta el SQL `012` y `013` en server (dashboard SQL editor, supabase CLI, script de Node) — preferencia razonable: supabase CLI `db push` para que quede versionado
- Manejo de la columna `tipo='parcela'` legacy: REQUIREMENTS dice 0 filas; si la auditoría confirma 0, drop directo; si aparece alguna, abortar (consistente con D-08)
- Retención del `subgroup_id` legacy en `trees` (rename a `group_id` directo, sin columna paralela)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements y plan de milestone
- `.planning/REQUIREMENTS.md` §"Milestone v1.1 Requirements" — PARC-01..10 (schema), MIGR-01..11 (data migration), traceability table v1.1
- `.planning/PROJECT.md` §"Current Milestone: v1.1" — goal, target features, key context
- `.planning/ROADMAP.md` §"Phase 15" — goal completo, success criteria (10 items), plan list (3 plans)

### Schema local (Drizzle / SQLite)
- `mobile/src/database/schema.ts` — schema actual: `subgroups` (líneas 25-38, índices únicos plantation-level que cambian a per-parcela), `trees` (líneas 40-54, `subgrupoId` que pasa a `groupId`)
- `mobile/drizzle/migrations.js` — registro central de migrations (debe agregar la nueva). **Lección Phase 13:** olvidar este archivo causa splash hang silencioso.
- `mobile/drizzle/meta/_journal.json` — journal de Drizzle (también requiere update)
- `mobile/drizzle/0010_add_tree_conflict_columns.sql` — última migration aplicada; la nueva será `0011_*.sql`

### Schema y data en Supabase
- `supabase/migrations/001_initial_schema.sql` — esquema base con `subgroups`, `trees`, FKs
- `supabase/migrations/006_add_cascade_deletes.sql` — cascade FK actuales (necesarios para preservar al renombrar)
- `supabase/migrations/009_sync_subgroup_update_trees.sql` — RPC `sync_subgroup` (revisar si referencia tabla `subgroups` en su body)
- `supabase/migrations/010_trees_update_policy.sql`, `011_trees_insert_policy_members.sql` — RLS más reciente, deben sobrevivir al rename
- **Nuevos a crear en Phase 15:**
  - `supabase/migrations/012_parcelas_and_rename.sql` — schema migration (rename + tabla parcelas + RLS + CHECK descripcion)
  - `supabase/migrations/013_data_consolidation.sql` — data migration en una sola transacción
  - `supabase/migrations/data/015_consolidation_mapping.md` — mapping documentado pre-SQL

### Generación de IDs
- `mobile/src/utils/idGenerator.ts` — firma actual `generateSubId(subgrupoCodigo, especieCodigo, posicion)` (líneas 8-14). **Phase 15 reemplaza por `generateSubId(parcelaCodigo, grupoCodigo, especieCodigo, posicion)`** y elimina firma vieja.

### Backup y operaciones
- `scripts/supabase-backup.sh` — backup pg_dump → R2 (verified existing). Pre-condición de Phase 15: ejecutar y confirmar backup en R2 antes de cualquier migration.

### Sync (lectura — los cambios de sync vienen en Phase 16)
- `mobile/src/services/SyncService.ts` — `syncPlantation()`, `pullFromServer()`, `uploadSubGroup()`. Phase 15 NO toca este archivo, pero Drizzle migration debe ser compatible con su lógica de `ON CONFLICT REPLACE` para árboles.
- `mobile/src/hooks/useSync.ts` — sync bidireccional Phase 13.

### Convenciones del proyecto
- `.claude/CLAUDE.md` §3 (calidad), §8 (diseño centralizado), §9 (separación lógica/datos) — toda función que toque idGenerator o repositories debe respetar estas reglas.
- `.planning/codebase/CONVENTIONS.md` — convenciones existentes (scout antes de planning).

### Contexto de phases anteriores
- `.planning/phases/13-unificar-sync-bidireccional/13-CONTEXT.md` — pull-before-push pattern, `pending_sync` dirty flag, `useLiveData` reactivity. Lecciones de migración local.
- `.planning/phases/14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo/14-CONTEXT.md` — sync de N/N, RPC `sync_subgroup` mecánica.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/supabase-backup.sh`**: backup completo a R2 con rotación. Listo para usar pre-migración (MIGR-01).
- **Drizzle ORM + drizzle-kit**: ya en uso, genera migrations en `mobile/drizzle/`. Recreate-table pattern es output natural de drizzle-kit cuando detecta rename + cambios de constraint.
- **`ON CONFLICT REPLACE` en pull bidireccional (Phase 13)**: ya re-baja árboles desde server. Permite que SubIDs nuevos lleguen al cliente sin lógica adicional.
- **`pending_sync` flag pattern**: aplica a `parcelas` también (PCRD-06). Patrón consistente con `subgroups`/`plantations`/`trees`.

### Established Patterns
- **3-archivos para Drizzle migration** (SQL + journal + migrations.js): violar = splash hang. Lección Phase 13 ya guardada en feedback memory.
- **RLS por rol admin/tecnico** en Supabase: tabla `parcelas` debe replicar policies análogas a las de `subgroups` (admin: all org, tecnico: assigned only).
- **CHECK constraint server-side** ya usado en otras tablas — `descripcion <= 10000 chars` sigue el patrón.
- **Migrations Supabase numeradas secuencialmente** (`001_`..`011_`); las nuevas son `012_` y `013_`.
- **State `sincronizada`** ya inexistente local (Phase 13). Server sigue con 269 grupos; normalizar a `finalizada` en MIGR-08.

### Integration Points
- `mobile/src/database/schema.ts`: actualizar export `subgroups` → `groups`, agregar `parcelas`, cambiar índices, agregar `parcela_id` FK en groups.
- `mobile/drizzle/migrations.js`: agregar `m0011` import (recreate-table SQL).
- `mobile/src/utils/idGenerator.ts`: reemplazar firma. Call sites (`TreeRepository`, posibles tests, exports) compilarán roto hasta Phase 16 — aceptado.
- `supabase/migrations/`: agregar `012_*.sql`, `013_*.sql`, y carpeta `data/` con `015_consolidation_mapping.md`.
- RPC `sync_subgroup` (Supabase): revisar si hace referencia explícita a `subgroups` (probable). Renombrar a `sync_group` o mantener nombre con body actualizado — decisión menor, queda en Phase 16 si toca el cliente.

</code_context>

<specifics>
## Specific Ideas

- "Verificar bien la cantidad de árboles para rechequear que sean 6.776 (previamente el análisis había detectado unos 7000)" — la auditoría pre-SQL es la fuente de verdad; cualquier discrepancia actualiza requirements y success criteria antes de avanzar.
- "Phase 15 + Phase 16 en la misma branch/PR" — el feature branch se llama `feat/v1.1-schema-and-rename` (sugerencia; nombre exacto puede ajustarse). No se mergea P15 sola; ambas viajan juntas hasta main.
- "Confiar en el window humano" — el equipo tiene 4 técnicos, comunicación directa; no se agregan defensas técnicas adicionales en el RPC.
- "Sync limpio antes del window" — anuncio explícito al equipo como precondición operativa, no automatizado.

</specifics>

<deferred>
## Deferred Ideas

- **Gate de `client_schema_version` en RPC sync_subgroup** — descartado para Phase 15 (confianza en el window humano). Si en el futuro hay más técnicos o despliegues más complejos, considerar.
- **Backup intermedio entre migrations 012 y 013** — descartado; el backup pre-012 + ROLLBACK transaccional son suficientes.
- **Wrapper deprecated en idGenerator** — descartado a favor de reemplazo directo + atomicidad P15+P16.
- **Pattern matching de nombres para mapping plantación→Parcela** — descartado a favor de tabla explícita.
- **Restauración offline de pending_sync** post-migración — fuera de scope; la pre-condición de "sync limpio antes" lo evita.

### Reviewed Todos (not folded)
None — no GitHub todos cross-referenced for Phase 15.

</deferred>

---

*Phase: 15-schema-migration-data-consolidation*
*Context gathered: 2026-05-05*
