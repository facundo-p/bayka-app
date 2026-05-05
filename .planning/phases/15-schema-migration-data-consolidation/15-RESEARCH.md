# Phase 15: Schema migration + data consolidation — Research

**Researched:** 2026-05-05
**Domain:** Drizzle SQLite migrations + Supabase PostgreSQL DDL + data consolidation batch
**Confidence:** HIGH (código fuente verificado directamente)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Despliegue en window coordinado simultáneo (4 técnicos). Supabase 012 + 013 + APK nuevo se aplican juntos.
- **D-02:** Sin gate técnico `client_schema_version` en RPC sync_subgroup. Confianza en el window humano.
- **D-03:** Pre-condición obligatoria: sync limpio antes del window. Los técnicos sincronizan todo antes de la migración.
- **D-04:** Primer sync post-migración: pull primero, luego push.
- **D-05:** Mapping plantación→Parcela especificado como tabla explícita en el SQL `013_data_consolidation.sql`. No se infiere por pattern matching.
- **D-06:** El mapping se genera ANTES del SQL vía auditoría a Supabase production (`scripts/audit-v1.1-consolidation.sql`).
- **D-07:** Mapping documentado en `supabase/migrations/data/015_consolidation_mapping.md` (ya existe el skeleton — pendiente de completar con resultados reales del audit).
- **D-08:** Edge cases en la auditoría = abortar el plan. Sin defaults ni auto-asignaciones.
- **D-09:** SQL `013_data_consolidation.sql` envuelto en una sola transacción `BEGIN..COMMIT`.
- **D-10:** Validación exhaustiva post-migración para los 6.776 árboles.
- **D-11:** El número exacto de árboles se re-confirma con la auditoría; esa cifra actualiza REQUIREMENTS.md + ROADMAP antes de mergear.
- **D-12:** Recovery: ROLLBACK transaccional de Postgres + backup R2 como último recurso. Sin backup intermedio entre 012 y 013.
- **D-13:** Drizzle migration usa recreate-table pattern de SQLite: CREATE `groups` → INSERT SELECT FROM `subgroups` → DROP `subgroups` → recrear índices.
- **D-14:** Tabla `parcelas` local empieza vacía; se llena via pull en primer sync post-migración.
- **D-15:** SubIDs locales se actualizan via pull bidireccional (ON CONFLICT REPLACE). Sin lógica de re-compute en cliente.
- **D-16:** `idGenerator` firma vieja eliminada en Phase 15. La app NO compila entre P15 y P16. Phase 15 + Phase 16 viajan en la misma branch/PR: `feat/v1.1-schema-and-rename`.

### Claude's Discretion

- Forma exacta del verification SQL script (mismo `013` con `RAISE EXCEPTION` vs script separado `verify-013.sql`)
- Ubicación de la query de auditoría pre-mapping (ya resuelta: `scripts/audit-v1.1-consolidation.sql` — existente)
- Si índices únicos viejos de `subgroups` se renombran o se DROP+CREATE (recomendación: DROP+CREATE en 012)
- Cómo se ejecuta el SQL 012 y 013 en server (recomendación: Supabase dashboard SQL editor, ya que `supabase db push` requiere CLI conectado a proyecto)
- Manejo de `tipo='parcela'` legacy: si auditoría confirma 0 filas, drop directo en 012; si aparece alguna, abortar
- Retención de `subgroup_id` legacy en `trees`: rename directo a `group_id` sin columna paralela

### Deferred Ideas (OUT OF SCOPE)

- Gate `client_schema_version` en RPC sync_subgroup
- Backup intermedio entre 012 y 013
- Wrapper deprecated en idGenerator
- Pattern matching de nombres para mapping plantación→Parcela
- Restauración offline de pending_sync post-migración
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARC-01 | Tabla `parcelas` en SQLite local con columnas y FK | Drizzle recreate-table pattern; nueva tabla se agrega en 0011 migration |
| PARC-02 | Tabla `parcelas` en Supabase con FK, CHECK descripcion, RLS | 012_parcelas_and_rename.sql — patron de RLS copiado de `subgroups` |
| PARC-03 | Unicidad parcela (plantacion_id, nombre) y (plantacion_id, codigo) | `uniqueIndex` en schema.ts + `UNIQUE` constraint en 012 |
| PARC-04 | Rename `subgroups`→`groups` en SQLite (migración Drizzle versionada) | SQLite no soporta ALTER TABLE RENAME TABLE; recreate-table es el único camino |
| PARC-05 | Rename `subgroups`→`groups` en Supabase, `subgroup_id`→`group_id` en trees | ALTER TABLE RENAME + ALTER TABLE RENAME COLUMN en Postgres (soportado) |
| PARC-06 | Columna `groups.parcela_id` (FK) agregada | ALTER TABLE ADD COLUMN en 012; DEFAULT NULL para no romper filas existentes |
| PARC-07 | Tipo `bosquete` agregado, `parcela` deprecado | ALTER TABLE ADD CONSTRAINT CHECK + DROP CHECK anterior en Postgres |
| PARC-08 | SubID formato `ParcelaCode + GroupCode + SpeciesCode + Position` | idGenerator.ts firma nueva — pure string concatenation como antes |
| PARC-09 | Unicidad de Grupo cambia: `(parcela_id, nombre)` y `(parcela_id, codigo)` | DROP old unique indexes + CREATE new ones in 012 |
| PARC-10 | `idGenerator` actualizado con firma nueva | 2 callers en repos + 1 test unitario — break intencional hasta P16 |
| MIGR-01 | Backup pre-migración con `scripts/supabase-backup.sh` | Script existente; requiere DATABASE_URL + credenciales R2 en env |
| MIGR-02 | `012_parcelas_and_rename.sql` versionado en supabase/migrations/ | Numerado como 012 (último es 011); DDL Postgres transaccional |
| MIGR-03 | `013_data_consolidation.sql` en supabase/migrations/ | BEGIN..COMMIT explícito; INSERT + UPDATE en una transacción |
| MIGR-04 | Cluster A: SSS con 17 parcelas, 215 grupos, 6.321 árboles | Mapping skeleton existe en data/015_consolidation_mapping.md — pendiente audit real |
| MIGR-05 | Cluster B: Pruebas-SSS con 2 parcelas, 5 grupos, 114 árboles | Idem |
| MIGR-06 | Cluster C: Pruebas-La Morita con 2 parcelas, 5 grupos, 341 árboles | Idem |
| MIGR-07 | Eliminar 11 plantaciones (CASCADE) | 8-char prefixes de UUIDs en REQUIREMENTS — deben expandirse a full UUIDs vía audit |
| MIGR-08 | Normalizar `sincronizada`→`finalizada` en grupos del server | UPDATE sencillo dentro de 013 transacción |
| MIGR-09 | Re-cálculo batch de SubIDs | UPDATE masivo con expresión de concatenación SQL |
| MIGR-10 | Verificación post-migración (conteos, FKs, unicidad) | RAISE EXCEPTION checks al final de 013 o verify-013.sql separado |
| MIGR-11 | SQLite local sincroniza via pull bidireccional existente | ON CONFLICT REPLACE pattern de Phase 13; sin cambios en SyncService para P15 |
</phase_requirements>

---

## Summary

Phase 15 es una migración de schema en dos sistemas (SQLite/Drizzle local y Supabase/Postgres) seguida de una consolidación masiva de datos de producción. El trabajo está bien acotado en tres planes: (1) Drizzle migration local, (2) DDL Supabase, (3) consolidación de datos.

El principal desafío no es técnico sino operacional: el mapping concreto de 21 plantaciones origen a 21 parcelas destino **debe obtenerse ejecutando `scripts/audit-v1.1-consolidation.sql` en producción** antes de escribir el SQL 013. El skeleton `supabase/migrations/data/015_consolidation_mapping.md` ya existe y define exactamente qué datos capturar; está pendiente de completar. Hasta que ese documento esté firmado, el SQL 013 no puede ser correcto.

La migración Drizzle local requiere respetar la restricción de SQLite (no hay `RENAME TABLE` ni `RENAME COLUMN` sin recrear), lo que implica el recreate-table pattern: CREATE `groups` + `parcelas` → INSERT SELECT FROM `subgroups` → DROP `subgroups` → DROP `trees` + CREATE nueva `trees` con `group_id` → INSERT SELECT FROM vieja `trees`. Los tres archivos del bundle Drizzle (SQL, journal, migrations.js) deben actualizarse sincrónicamente — el olvido del `migrations.js` causa splash hang silencioso (lección Phase 13).

En Supabase, `ALTER TABLE RENAME` y `ALTER TABLE RENAME COLUMN` son DDL transaccional en Postgres, por lo que la migración 012 puede fallar y hacer ROLLBACK completo. La consolidación de datos (013) va en `BEGIN..COMMIT` explícito y es atómica.

**Recomendación primaria:** El plan 15-03 NO puede escribir el SQL 013 real hasta que el audit esté ejecutado y `015_consolidation_mapping.md` esté completado y aprobado. El planeador debe incluir eso como Wave 0 / pre-condición bloqueante del plan 15-03.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema Drizzle local (SQLite) | Mobile (Drizzle ORM) | — | Drizzle genera y aplica migrations en SQLite vía `useMigrations` hook al arrancar la app |
| Schema Supabase server | Supabase (PostgreSQL DDL) | — | SQL files en supabase/migrations/ aplicados manualmente vía SQL editor o CLI |
| Data consolidation / SubID recompute | Supabase (PostgreSQL batch) | — | 6.776 filas en server; clientes reciben resultado via pull bidireccional |
| idGenerator nueva firma | Mobile (utils) | — | Función pura en `mobile/src/utils/idGenerator.ts`; call sites en repos |
| Backup pre-migración | Scripts / CI | — | `scripts/supabase-backup.sh` — pg_dump a R2, ejecución manual pre-window |
| Sincronización post-migración | Mobile (SyncService Phase 13) | — | Mecanismo existente; sin cambios en P15 |

---

## Standard Stack

### Core (verificado en codebase)

| Librería | Versión | Propósito | Estado |
|----------|---------|-----------|--------|
| drizzle-orm | ya instalada | ORM + schema SQLite | En uso — schema.ts, client.ts |
| drizzle-kit | ya instalada | Genera migration SQL desde schema diff | En uso — genera archivos en mobile/drizzle/ |
| expo-sqlite | ya instalada | SQLite en Expo/React Native | En uso |
| @supabase/supabase-js | ya instalada | Client Supabase | En uso |
| PostgreSQL (Supabase hosted) | — | Base de datos server | En uso |

[VERIFIED: codebase grep] — todas las dependencias ya están instaladas, no se instala nada nuevo en Phase 15.

### Herramientas externas

| Herramienta | Propósito | Disponibilidad |
|-------------|-----------|----------------|
| pg_dump | Backup pre-migración vía supabase-backup.sh | Requiere DATABASE_URL Supabase en env |
| AWS CLI (o compatible) | Upload backup a Cloudflare R2 | Requiere credenciales R2 en env |
| Supabase SQL Editor (dashboard) | Ejecutar 012 y 013 en producción | Online — browser |

---

## Architecture Patterns

### Drizzle Migration — Recreate-Table Pattern (SQLite)

SQLite no soporta `ALTER TABLE RENAME TABLE`, `ALTER TABLE RENAME COLUMN` ni `DROP COLUMN`. Para renombrar `subgroups`→`groups` y `trees.subgrupo_id`→`trees.group_id`, drizzle-kit genera automáticamente el recreate-table pattern cuando se modifica schema.ts. El patrón manual equivale a:

```sql
-- Source: SQLite docs + drizzle-kit output pattern (VERIFIED: drizzle/0000_*.sql como ejemplo base)

-- 1. Crear tabla nueva groups con nuevo schema
CREATE TABLE `groups` (
  `id` text PRIMARY KEY NOT NULL,
  `plantacion_id` text NOT NULL,
  `parcela_id` text REFERENCES `parcelas`(`id`),
  `nombre` text NOT NULL,
  `codigo` text NOT NULL,
  `tipo` text DEFAULT 'linea' NOT NULL,
  `estado` text DEFAULT 'activa' NOT NULL,
  `usuario_creador` text NOT NULL,
  `created_at` text NOT NULL,
  `pending_sync` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`plantacion_id`) REFERENCES `plantations`(`id`) ON DELETE no action
);
--> statement-breakpoint

-- 2. Copiar datos de subgroups → groups (parcela_id = NULL por default)
INSERT INTO `groups`
  SELECT id, plantacion_id, NULL as parcela_id, nombre, codigo, tipo, estado,
         usuario_creador, created_at, pending_sync
  FROM `subgroups`;
--> statement-breakpoint

-- 3. Crear tabla nueva trees con group_id en lugar de subgrupo_id
CREATE TABLE `trees_new` (
  `id` text PRIMARY KEY NOT NULL,
  `group_id` text NOT NULL REFERENCES `groups`(`id`),
  -- ... resto de columnas igual
);
--> statement-breakpoint

-- 4. Copiar trees (subgrupo_id → group_id, los UUIDs son los mismos)
INSERT INTO `trees_new` SELECT id, subgrupo_id AS group_id, ... FROM `trees`;
--> statement-breakpoint

-- 5. Drop tablas viejas
DROP TABLE `trees`;
--> statement-breakpoint
DROP TABLE `subgroups`;
--> statement-breakpoint

-- 6. Rename trees_new → trees
ALTER TABLE `trees_new` RENAME TO `trees`;
--> statement-breakpoint

-- 7. Crear tabla parcelas (nueva, empieza vacía)
CREATE TABLE `parcelas` (
  `id` text PRIMARY KEY NOT NULL,
  `plantacion_id` text NOT NULL REFERENCES `plantations`(`id`),
  `nombre` text NOT NULL,
  `codigo` text NOT NULL,
  `descripcion` text,
  `pending_sync` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint

-- 8. Crear índices únicos nuevos (per-parcela en lugar de per-plantación)
CREATE UNIQUE INDEX `groups_parcela_code_unique` ON `groups` (`parcela_id`, `codigo`);
--> statement-breakpoint
CREATE UNIQUE INDEX `groups_parcela_name_unique` ON `groups` (`parcela_id`, `nombre`);
--> statement-breakpoint
CREATE UNIQUE INDEX `parcelas_plantation_code_unique` ON `parcelas` (`plantacion_id`, `codigo`);
--> statement-breakpoint
CREATE UNIQUE INDEX `parcelas_plantation_name_unique` ON `parcelas` (`plantacion_id`, `nombre`);
```

[VERIFIED: codebase — drizzle/0000_peaceful_winter_soldier.sql muestra el patrón de CREATE TABLE + índices]
[VERIFIED: codebase — drizzle/0009_add_subgroup_pending_sync.sql muestra ALTER TABLE ADD COLUMN para casos simples]

**IMPORTANTE:** `parcela_id` en `groups` debe ser NULLABLE en la migración local (para preservar datos existentes). Los grupos locales residuales (esperados vacíos por pre-condición de sync limpio) quedarán con `parcela_id = NULL` hasta el siguiente pull.

### Actualización obligatoria de los 3 archivos Drizzle

[VERIFIED: codebase — mobile/drizzle/migrations.js existente; lección Phase 13 en STATE.md]

El bundle de migrations de Expo SQLite requiere **exactamente 3 archivos** actualizados de forma sincrónica:

1. **`mobile/drizzle/0011_<nombre>.sql`** — el SQL de migration generado por drizzle-kit
2. **`mobile/drizzle/meta/_journal.json`** — nueva entrada con `idx: 11`, `tag: "0011_<nombre>"`, `when: <timestamp>`
3. **`mobile/drizzle/migrations.js`** — agregar `import m0011 from './0011_<nombre>.sql'` y la clave `m0011` en el objeto

Si `migrations.js` no se actualiza, la app arranca sin error visible pero la migration no corre (splash hang silencioso).

### Supabase DDL — Migration 012

PostgreSQL soporta `ALTER TABLE RENAME TO` y `ALTER TABLE RENAME COLUMN` como DDL transaccional. La secuencia en `012_parcelas_and_rename.sql`:

```sql
-- Source: PostgreSQL docs (VERIFIED: supabase/migrations/006_add_cascade_deletes.sql como patrón DDL)

BEGIN;

-- 1. Crear tabla parcelas ANTES del rename (subgroups puede referenciarla durante la transacción)
CREATE TABLE parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id uuid NOT NULL REFERENCES plantations(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  codigo text NOT NULL,
  descripcion text,
  pending_sync boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parcelas_plantation_nombre_unique UNIQUE (plantation_id, nombre),
  CONSTRAINT parcelas_plantation_codigo_unique UNIQUE (plantation_id, codigo),
  CONSTRAINT parcelas_descripcion_length CHECK (char_length(descripcion) <= 10000)
);

-- 2. Rename subgroups → groups
ALTER TABLE subgroups RENAME TO groups;

-- 3. Agregar columna parcela_id a groups (NULL por defecto — se rellena en 013)
ALTER TABLE groups ADD COLUMN parcela_id uuid REFERENCES parcelas(id);

-- 4. Rename constraint FK de groups (renombrar la constraint existente)
ALTER TABLE groups
  DROP CONSTRAINT subgroups_plantation_id_fkey,
  ADD CONSTRAINT groups_plantation_id_fkey
    FOREIGN KEY (plantation_id) REFERENCES plantations(id) ON DELETE CASCADE;

-- 5. Drop unique indexes viejos (per-plantation)
DROP INDEX IF EXISTS subgroups_plantation_id_codigo_key;
DROP INDEX IF EXISTS subgroups_plantation_id_nombre_key;
-- (verificar nombres exactos con \d subgroups en Supabase antes de correr)

-- 6. Crear unique indexes nuevos per-parcela
CREATE UNIQUE INDEX groups_parcela_codigo_unique ON groups (parcela_id, codigo);
CREATE UNIQUE INDEX groups_parcela_nombre_unique ON groups (parcela_id, nombre);

-- 7. Cambiar tipo CHECK: remover 'parcela', agregar 'bosquete'
ALTER TABLE groups DROP CONSTRAINT IF EXISTS subgroups_tipo_check;
ALTER TABLE groups ADD CONSTRAINT groups_tipo_check CHECK (tipo IN ('linea', 'bosquete'));

-- 8. Rename trees.subgroup_id → trees.group_id
ALTER TABLE trees RENAME COLUMN subgroup_id TO group_id;

-- 9. Rename FK constraint en trees
ALTER TABLE trees
  DROP CONSTRAINT trees_subgroup_id_fkey,
  ADD CONSTRAINT trees_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;

-- 10. Estado check: remover 'sincronizada' (se migran datos en 013, no aquí)
-- NOTA: No cambiar aquí — esperar a después de MIGR-08 en 013 para evitar violación de constraint

-- 11. RLS para parcelas
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read parcelas"
  ON parcelas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Plantation members can insert parcelas"
  ON parcelas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plantation_users pu
      WHERE pu.plantation_id = plantation_id
      AND pu.user_id = auth.uid()
    )
  );

CREATE POLICY "Plantation members can update parcelas"
  ON parcelas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plantation_users pu
      WHERE pu.plantation_id = plantation_id
      AND pu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plantation_users pu
      WHERE pu.plantation_id = plantation_id
      AND pu.user_id = auth.uid()
    )
  );

COMMIT;
```

[VERIFIED: codebase — supabase/migrations/001_initial_schema.sql + 010_trees_update_policy.sql + 011_trees_insert_policy_members.sql para patrones RLS]
[ASSUMED] — Los nombres exactos de las constraints UNIQUE de `subgroups` en Supabase producción (paso 5) deben verificarse vía `\d subgroups` o `SELECT conname FROM pg_constraint WHERE conrelid = 'subgroups'::regclass` antes de correr 012.

### Supabase Data Consolidation — Migration 013

```sql
-- Source: basado en patrón de 013_data_consolidation.sql diseño (VERIFIED: CONTEXT.md D-09)

BEGIN;

-- 1. Actualizar estado sincronizada → finalizada (MIGR-08)
--    Hacerlo ANTES de dropear el CHECK de estado en groups
UPDATE groups SET estado = 'finalizada' WHERE estado = 'sincronizada';

-- 2. Ahora se puede actualizar el CHECK de estado (ya no hay filas 'sincronizada')
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_estado_check;
ALTER TABLE groups ADD CONSTRAINT groups_estado_check
  CHECK (estado IN ('activa', 'finalizada'));

-- 3. Crear 3 plantaciones nuevas (UUIDs fijos, generados de antemano)
INSERT INTO plantations (id, organizacion_id, lugar, periodo, estado, creado_por, created_at) VALUES
  ('<UUID-SSS>',    '<org_id>', 'San Sebastián de la Selva', 'Otoño 2026',    'activa', '<admin_user_id>', now()),
  ('<UUID-PSSS>',   '<org_id>', 'Pruebas - SSS',             'Otoño 2026',    'activa', '<admin_user_id>', now()),
  ('<UUID-PLM>',    '<org_id>', 'Pruebas - La Morita',       'Primavera 2026','activa', '<admin_user_id>', now());

-- 4. Crear 21 parcelas (una por cada plantation origen de los clusters A/B/C)
--    (tabla explícita con mapping completo desde 015_consolidation_mapping.md)
INSERT INTO parcelas (id, plantation_id, nombre, codigo, created_at, updated_at) VALUES
  -- Cluster A — SSS Loma
  ('<UUID-LP1>',  '<UUID-SSS>', 'Loma-P1',  'LP1',  now(), now()),
  ('<UUID-LP2>',  '<UUID-SSS>', 'Loma-P2',  'LP2',  now(), now()),
  -- ... LP3..LP13
  -- Cluster A — SSS Medio
  ('<UUID-MP1>',  '<UUID-SSS>', 'Medio-P1', 'MP1',  now(), now()),
  -- ... MP2..MP4
  -- Cluster B
  ('<UUID-SO>',   '<UUID-PSSS>', 'Selva Original', 'SO',  now(), now()),
  ('<UUID-P3V>',  '<UUID-PSSS>', 'P3 Vieja',       'P3V', now(), now()),
  -- Cluster C
  ('<UUID-LM>',   '<UUID-PLM>', 'La Morita', 'LM', now(), now()),
  ('<UUID-Z1>',   '<UUID-PLM>', 'Zona 1',    'Z1',  now(), now());

-- 5. Reasignar grupos: UPDATE plantation_id + parcela_id por cada grupo origen
--    (mapping explícito: fuente es grupos de plantation_id origen → parcela destino)
UPDATE groups SET
  plantation_id = '<UUID-SSS>',
  parcela_id = '<UUID-LP1>'
WHERE plantation_id = '<source-LP1-UUID>';
-- ... repetir para cada plantation origen

-- 6. Batch UPDATE de SubIDs (MIGR-09)
--    Formato nuevo: ParcelaCode + GroupCode + SpeciesCode + Position
--    La posición ya es correcta (se preserva); solo cambia el prefijo
UPDATE trees t
SET sub_id = p.codigo || g.codigo || (
  SELECT COALESCE(sp.codigo, 'NN')
  FROM species sp WHERE sp.id = t.species_id
) || t.posicion::text
FROM groups g
JOIN parcelas p ON p.id = g.parcela_id
WHERE t.group_id = g.id;

-- 7. Eliminar 11 plantaciones TO_DELETE (CASCADE elimina grupos y árboles)
DELETE FROM plantations WHERE id IN (
  '<UUID-00000000>', '<UUID-e072775e>', '<UUID-80b85acd>',
  '<UUID-26e190db>', '<UUID-747981d3>', '<UUID-0eea0006>',
  '<UUID-a536bd66>', '<UUID-09a315e2>', '<UUID-203beee5>',
  '<UUID-6d2e80b0>', '<UUID-7fea8850>'
);

-- 8. Verificaciones post-consolidación (RAISE EXCEPTION si falla alguna)
DO $$
DECLARE
  v_plantations INTEGER;
  v_parcelas    INTEGER;
  v_groups      INTEGER;
  v_trees       INTEGER;
  v_null_subids INTEGER;
  v_null_parcela INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_plantations FROM plantations;
  SELECT COUNT(*) INTO v_parcelas    FROM parcelas;
  SELECT COUNT(*) INTO v_groups      FROM groups;
  SELECT COUNT(*) INTO v_trees       FROM trees;
  SELECT COUNT(*) INTO v_null_subids FROM trees WHERE sub_id IS NULL OR trim(sub_id) = '';
  SELECT COUNT(*) INTO v_null_parcela FROM groups WHERE parcela_id IS NULL;

  IF v_plantations <> 3 THEN
    RAISE EXCEPTION 'VERIFICACION FALLIDA: se esperaban 3 plantaciones, hay %', v_plantations;
  END IF;
  IF v_parcelas <> 21 THEN
    RAISE EXCEPTION 'VERIFICACION FALLIDA: se esperaban 21 parcelas, hay %', v_parcelas;
  END IF;
  IF v_groups <> 225 THEN
    RAISE EXCEPTION 'VERIFICACION FALLIDA: se esperaban 225 grupos, hay %', v_groups;
  END IF;
  -- v_trees se compara contra el número RE-CONFIRMADO por la auditoría (actualizar antes de correr)
  IF v_trees <> 6776 THEN
    RAISE EXCEPTION 'VERIFICACION FALLIDA: se esperaban 6776 árboles, hay %', v_trees;
  END IF;
  IF v_null_subids <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION FALLIDA: % árboles con sub_id NULL o vacío', v_null_subids;
  END IF;
  IF v_null_parcela <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION FALLIDA: % grupos sin parcela_id', v_null_parcela;
  END IF;

  RAISE NOTICE 'Verificacion exitosa: % plantaciones, % parcelas, % grupos, % arboles',
    v_plantations, v_parcelas, v_groups, v_trees;
END $$;

COMMIT;
```

[VERIFIED: codebase — supabase/migrations/009_sync_subgroup_update_trees.sql para patron EXCEPTION WHEN OTHERS]
[ASSUMED] — UUIDs de las 11 plantaciones a eliminar deben obtenerse del audit (los REQUIREMENTS tienen 8-char prefixes, no UUIDs completos).

**Observación crítica sobre el UPDATE de SubIDs:** El UPDATE masivo usa un JOIN trees → groups → parcelas → species. La especie viene de `trees.species_id`. Para árboles N/N (`species_id IS NULL`), el código debe ser 'NN'. La expresión SQL usa `COALESCE(sp.codigo, 'NN')` — pero si el JOIN a species falla (NULL species_id), la subquery debe manejarlo. Se recomienda una LEFT JOIN en lugar de la subquery:

```sql
-- Forma robusta para N/N (species_id nullable):
UPDATE trees t
SET sub_id = p.codigo || g.codigo || COALESCE(sp.codigo, 'NN') || t.posicion::text
FROM groups g
JOIN parcelas p ON p.id = g.parcela_id
LEFT JOIN species sp ON sp.id = t.species_id
WHERE t.group_id = g.id;
```

[VERIFIED: codebase — TreeRepository.ts línea 35: `generateSubId(params.subgrupoCodigo, params.especieCodigo, nextPosition)` — `especieCodigo` es 'NN' para árboles N/N, confirmando que la string 'NN' es el código correcto]

### idGenerator — Cambio de Firma

**Estado actual** [VERIFIED: mobile/src/utils/idGenerator.ts]:
```typescript
export function generateSubId(
  subgrupoCodigo: string,
  especieCodigo: string,
  posicion: number
): string {
  return `${subgrupoCodigo}${especieCodigo}${posicion}`;
}
```

**Nueva firma** (Phase 15):
```typescript
/**
 * Generates the SubID for a tree.
 * Format: {parcelaCodigo}{grupoCodigo}{especieCodigo}{posicion}
 * Examples:
 *   generateSubId('LP1', 'L23B', 'ANC', 12) → 'LP1L23BANC12'
 *   generateSubId('MP3', 'L1', 'NN', 5)    → 'MP3L1NN5'
 */
export function generateSubId(
  parcelaCodigo: string,
  grupoCodigo: string,
  especieCodigo: string,
  posicion: number
): string {
  return `${parcelaCodigo}${grupoCodigo}${especieCodigo}${posicion}`;
}
```

**Call sites actuales** [VERIFIED: grep codebase]:
1. `mobile/src/repositories/TreeRepository.ts` — 4 llamadas con firma 3-arga (`subgrupoCodigo, especieCodigo, posicion`)
2. `mobile/src/repositories/SubGroupRepository.ts` — 1 llamada (línea 237)
3. `mobile/tests/utils/idGenerator.test.ts` — 4 tests de la firma actual

**Implicación (D-16):** Al cambiar la firma en Phase 15, los 2 repos + 1 test file compilarán con error TypeScript hasta que Phase 16 actualice los call sites. La app no compila sola entre P15 y P16. Esto es intencional — P15 y P16 viajan en la misma branch.

---

## Don't Hand-Roll

| Problema | No construir | Usar | Por qué |
|----------|-------------|------|---------|
| SQLite rename tabla/columna | Script SQL custom ad-hoc | drizzle-kit recreate-table (output automático) | SQLite no tiene ALTER TABLE RENAME; drizzle-kit conoce el patrón y lo genera correctamente |
| Backup PostgreSQL | Script curl manual | `scripts/supabase-backup.sh` (ya existe) | pg_dump + rotación R2 ya implementados |
| Transaccionalidad de 013 | Múltiples statements sueltos | `BEGIN..COMMIT` explícito en Postgres | Un error a mitad deja el DB en estado intermedio corrupto sin transacción |
| Verificación post-migración | Conteos manuales en dashboard | `RAISE EXCEPTION` dentro del mismo BEGIN..COMMIT | Si los conteos fallan, toda la transacción hace ROLLBACK automático |
| SubID para árboles N/N | Lógica especial de rama | `COALESCE(sp.codigo, 'NN')` en el UPDATE | Mismo patrón que el cliente; consistencia garantizada |

---

## Runtime State Inventory

> Esta phase es una migración/rename — la inventario es obligatorio.

| Categoría | Items encontrados | Acción requerida |
|-----------|------------------|------------------|
| Stored data (Supabase) | Tabla `subgroups` con ~225 rows (groups reales + grupos de 11 plantaciones a eliminar); `trees.subgroup_id` FK activa; `trees.sub_id` con formato viejo | DDL rename en 012 + UPDATE masivo en 013 |
| Stored data (SQLite local, dispositivos) | Tabla `subgroups` con groups locales (esperados vacíos por pre-condición de sync limpio); `trees.subgrupo_id` | Drizzle migration 0011 — recreate-table en app boot |
| Live service config | RPC `sync_subgroup` en Supabase referencia tabla `subgroups` explícitamente (líneas 19, 29, 44 en 009_sync_subgroup_update_trees.sql) | Requiere UPDATE de la función RPC para referenciar `groups` — decisión: en P15 o P16. Ver sección Open Questions |
| Live service config (RLS) | Policies en `trees` referencian `subgroups` en JOIN (010_trees_update_policy.sql línea 9, 011_trees_insert_policy_members.sql línea 11) | Deben actualizarse en 012 para referenciar `groups` |
| OS-registered state | Ninguno — no hay tareas de SO que referencien `subgroups` | Ninguna |
| Secrets/env vars | `DATABASE_URL` necesario para supabase-backup.sh; las credenciales R2 necesarias en el mismo script | Verificar que están disponibles antes de ejecutar backup |
| Build artifacts | `mobile/drizzle/migrations.js` — bundle de migrations | Actualizar con m0011 o splash hang silencioso |

**Crítico detectado:** Las policies RLS de `trees` (010 y 011) hacen JOIN con `subgroups`:
```sql
-- 010_trees_update_policy.sql línea 9:
WHERE sg.id = trees.subgroup_id  -- ← referencia a columna subgroup_id
-- 011_trees_insert_policy_members.sql línea 11:
WHERE sg.id = subgroup_id        -- ← también referencia a subgroup_id
```
Después del rename en 012 (`subgroup_id` → `group_id`), estas policies estarán rotas. La migración 012 **debe** hacer `DROP POLICY` + `CREATE POLICY` para estas dos policies con la nueva referencia `group_id`.

---

## Common Pitfalls

### Pitfall 1: Olvidar actualizar migrations.js
**Qué falla:** App arranca sin error pero la migración no corre. Splash hang o datos viejos.
**Por qué ocurre:** El bundle de Expo SQLite lee `migrations.js` para saber qué migrations ejecutar. Si no incluye m0011, drizzle-kit nunca ve la nueva migration.
**Cómo evitar:** Siempre actualizar los 3 archivos atomicamente: SQL + journal + migrations.js (lección Phase 13).
**Señal de alerta:** App arranca normalmente pero `groups` table no existe / `subgroups` sigue existiendo.

### Pitfall 2: RLS policies de trees referenciando `subgroup_id` después del rename
**Qué falla:** Cualquier INSERT o UPDATE en `trees` falla con "column subgroup_id does not exist" después de correr 012.
**Por qué ocurre:** Las policies 010 y 011 tienen JOINs hardcodeados con el nombre viejo de la columna.
**Cómo evitar:** DROP + CREATE de las policies afectadas dentro de la misma migración 012 (antes del COMMIT).
**Señal de alerta:** Sync falla con error genérico al insertar árboles post-migración.

### Pitfall 3: RPC `sync_subgroup` referencia tabla `subgroups` por nombre
**Qué falla:** Todo sync de grupos falla post-012 porque el RPC busca la tabla `subgroups` que ya no existe.
**Por qué ocurre:** El body de la función en 009_sync_subgroup_update_trees.sql usa `FROM subgroups` y `INSERT INTO subgroups`.
**Cómo evitar:** `CREATE OR REPLACE FUNCTION sync_subgroup` en 012 actualizando referencias a `groups` y `group_id`.
**Señal de alerta:** Sync falla con "relation subgroups does not exist" inmediatamente después de 012.

### Pitfall 4: Nombre exacto de constraints UNIQUE de subgroups en Supabase
**Qué falla:** `DROP INDEX IF EXISTS subgroups_plantation_id_codigo_key` puede fallar silenciosamente (IF EXISTS) o fallar si el nombre es distinto al esperado.
**Por qué ocurre:** Los nombres de constraints UNIQUE en Postgres se generan automáticamente y pueden diferir del patrón `{tabla}_{col1}_{col2}_key`.
**Cómo evitar:** Verificar nombres exactos con `SELECT conname FROM pg_constraint WHERE conrelid = 'subgroups'::regclass AND contype = 'u';` antes de escribir 012.
**Señal de alerta:** Nuevo índice per-parcela se crea pero el viejo per-plantación sigue activo (INSERT con mismo código en distintas parcelas falla inesperadamente).

### Pitfall 5: Unique index conflict durante recreate-table en SQLite
**Qué falla:** El nuevo índice `groups_parcela_codigo_unique` sobre `(parcela_id, codigo)` permite NULL en parcela_id (todos los grupos migrados tienen `parcela_id = NULL`). SQLite trata NULLs como distintos en UNIQUE indexes — no hay colisión. Pero si se pusiera un `NOT NULL` en `parcela_id`, el INSERT SELECT FROM subgroups fallaría.
**Cómo evitar:** `parcela_id` debe ser NULLABLE en la Drizzle migration local. El índice único `(parcela_id, codigo)` sobre NULLs es seguro en SQLite.

### Pitfall 6: Mapping incompleto en 013 (UUIDs de 8 chars en vez de full UUIDs)
**Qué falla:** `DELETE FROM plantations WHERE id = '00000000'` no matchea nada (Postgres UUID comparison es exacta).
**Por qué ocurre:** REQUIREMENTS.md tiene 8-char prefixes, no UUIDs completos.
**Cómo evitar:** El audit (`scripts/audit-v1.1-consolidation.sql`) devuelve UUIDs completos. `015_consolidation_mapping.md` debe tener los UUIDs completos antes de escribir 013.

### Pitfall 7: Estado CHECK constraint en groups durante 013
**Qué falla:** Si el CHECK `estado IN ('activa', 'finalizada')` se agrega en 012, luego en 013 el UPDATE `sincronizada→finalizada` viola el constraint y la transacción hace ROLLBACK.
**Cómo evitar:** Dentro de 013, **primero** `UPDATE groups SET estado = 'finalizada' WHERE estado = 'sincronizada'`, **luego** `ALTER TABLE groups DROP CONSTRAINT + ADD CONSTRAINT` para remover 'sincronizada'. O mantener 'sincronizada' en el CHECK de 012 y solo dropearlo en 013 después del UPDATE.

### Pitfall 8: SubIDs de árboles N/N en batch UPDATE
**Qué falla:** `species_id IS NULL` → el JOIN a species no devuelve fila → el resultado de la concatenación es NULL.
**Cómo evitar:** Usar `LEFT JOIN species sp ON sp.id = t.species_id` + `COALESCE(sp.codigo, 'NN')` en la expresión del UPDATE.

---

## Code Examples

### Entrada journal.json para migration 0011

```json
{
  "idx": 11,
  "version": "6",
  "when": 1746500000000,
  "tag": "0011_groups_parcelas_migration",
  "breakpoints": true
}
```

[VERIFIED: codebase — mobile/drizzle/meta/_journal.json — formato exacto de entradas existentes]

### Actualización de migrations.js

```javascript
// Agregar al final de los imports
import m0011 from './0011_groups_parcelas_migration.sql';

// Agregar en el objeto migrations
export default {
  journal,
  migrations: {
    m0000, m0001, m0002, m0003, m0004,
    m0005, m0006, m0007, m0008, m0009,
    m0010,
    m0011  // ← nueva entrada
  }
}
```

[VERIFIED: codebase — mobile/drizzle/migrations.js formato exacto]

### schema.ts actualizado

```typescript
// Tabla groups reemplaza subgroups
export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  parcelaId: text('parcela_id').references(() => parcelas.id),  // nullable en local
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  tipo: text('tipo').notNull().default('linea'),     // constraint via migration
  estado: text('estado').notNull().default('activa'),
  usuarioCreador: text('usuario_creador').notNull(),
  createdAt: text('created_at').notNull(),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  uniqueCode: uniqueIndex('groups_parcela_code_unique').on(t.parcelaId, t.codigo),
  uniqueName: uniqueIndex('groups_parcela_name_unique').on(t.parcelaId, t.nombre),
}));

// Nueva tabla parcelas
export const parcelas = sqliteTable('parcelas', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  descripcion: text('descripcion'),  // nullable, sin CHECK en SQLite (CHECK en server)
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  uniqueCode: uniqueIndex('parcelas_plantation_code_unique').on(t.plantacionId, t.codigo),
  uniqueName: uniqueIndex('parcelas_plantation_name_unique').on(t.plantacionId, t.nombre),
}));

// trees actualizada con group_id
export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id),  // renombrado
  // ... resto de columnas igual
});
```

[VERIFIED: codebase — mobile/src/database/schema.ts — estructura base verificada]

---

## State of the Art

| Approach anterior | Approach actual | Cambio | Impacto |
|-------------------|----------------|--------|---------|
| SubID = `GroupCode + SpeciesCode + Position` | SubID = `ParcelaCode + GroupCode + SpeciesCode + Position` | Phase 15 | Prefijo de parcela previene colisiones cuando dos parcelas tienen grupos con el mismo código |
| Unicidad de Grupo per-plantación | Unicidad de Grupo per-parcela | Phase 15 | Permite que dos parcelas distintas bajo la misma plantación tengan grupos con el mismo código (necesario para consolidar 17 plantaciones SSS) |
| `subgroups` (tipo `linea` o `parcela`) | `groups` (tipo `linea` o `bosquete`) | Phase 15 | Valor `parcela` estaba siendo usado como workaround; `bosquete` es el concepto correcto |
| Estado de grupo incluye `sincronizada` | Solo `activa` y `finalizada` | Phase 13 → alineado en server en Phase 15 | Simplificación — inmutabilidad determinada por estado de plantación |

---

## Assumptions Log

| # | Claim | Sección | Riesgo si es incorrecto |
|---|-------|---------|------------------------|
| A1 | Los nombres de constraints UNIQUE de `subgroups` en Postgres siguen el patrón `subgroups_plantation_id_{campo}_key` | Pitfall 4, código 012 | DROP INDEX falla o no encuentra el index correcto; los viejos índices per-plantación quedan activos |
| A2 | El número exacto de árboles preservados es 6.776 (per REQUIREMENTS.md) | MIGR-09, verification DO $$ | El RAISE EXCEPTION falla si el número real difiere; se debe actualizar antes de correr |
| A3 | Las 11 plantaciones a eliminar no tienen grupos/árboles que no estén en la lista de los clusters A/B/C | MIGR-07, 013 DELETE | Si hay grupos en esas plantaciones que sí se deben preservar, el CASCADE DELETE los elimina irrecuperablemente |
| A4 | Los UUIDs de 8-char en REQUIREMENTS.md son únicos (no hay dos plantaciones con el mismo prefijo) | MIGR-07 | El audit confirmará los UUIDs completos — este assumption solo aplica si no se corre el audit |
| A5 | La columna `pending_sync` en `groups` (SQLite) se llama exactamente `pending_sync` en la tabla `subgroups` actual | Schema.ts / migration 0011 | Si el nombre difiere en la DB real vs schema.ts, el INSERT SELECT fallará |

**Claims A2, A3 y A4 se resuelven completamente ejecutando el audit.**

---

## Open Questions

1. **¿Actualizar el RPC `sync_subgroup` en Phase 15 o Phase 16?**
   - Lo que sabemos: La función referencia `subgroups` y `subgroup_id` en su body (009_sync_subgroup_update_trees.sql). Después de 012, esos nombres no existen.
   - Lo que no está claro: CONTEXT.md dice "Renombrar a `sync_group` o mantener nombre con body actualizado — decisión menor, queda en Phase 16 si toca el cliente." Pero si el RPC falla post-012, cualquier sync falla. No es una decisión menor.
   - **Recomendación:** Incluir `CREATE OR REPLACE FUNCTION sync_subgroup(...)` en 012 con el body actualizado para `groups` y `group_id`. El nombre de la función puede quedar como `sync_subgroup` por ahora (Phase 16 renombra la función y el call site juntos). Esto desbloquea el sync post-migración sin esperar a P16.

2. **¿Cómo se ejecuta 012 y 013 en Supabase producción?**
   - Opciones: (a) Supabase dashboard SQL editor (manual, requiere acceso browser), (b) `supabase db push` vía CLI (requiere proyecto linkeado y acceso a red).
   - **Recomendación:** Dashboard SQL editor. Es más seguro para migraciones manuales únicas (permite ver resultados inmediatos, ROLLBACK visible). `supabase db push` aplica todas las migrations pendientes de una vez, más riesgoso si algo falla.

3. **¿Los datos locales de dispositivos de técnicos son un problema real?**
   - Lo que sabemos: D-03 dice "sync limpio antes del window" — se espera que los dispositivos estén vacíos de pending_sync antes de la migración.
   - Lo que no está claro: ¿Qué pasa si un técnico no sincronizó? La Drizzle migration local corre en el próximo boot de la app (con o sin sync).
   - Análisis: La recreate-table pattern preserva todos los datos locales (INSERT SELECT FROM subgroups). Los grupos locales quedarán con `parcela_id = NULL`. El primer pull los sobreescribirá con `ON CONFLICT REPLACE`. No hay pérdida de datos — solo posible redundancia temporal.

---

## Environment Availability

| Dependencia | Requerida por | Disponible | Notas |
|-------------|--------------|------------|-------|
| pg_dump | scripts/supabase-backup.sh | Depende del entorno | Debe verificarse en el entorno donde se ejecuta el backup |
| aws CLI (o compatible) | scripts/supabase-backup.sh (upload R2) | Depende del entorno | Requiere AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME |
| DATABASE_URL (Supabase) | supabase-backup.sh + audit query | En .env o secrets | Debe obtenerse de Supabase dashboard antes del window |
| Supabase dashboard (browser) | Ejecutar 012 y 013 | Online | Requiere conectividad |
| Node.js / npm | drizzle-kit para generar migration SQL | [VERIFIED: presente en proyecto] | `mobile/` tiene package.json con drizzle-kit |

---

## Validation Architecture

### Test Framework

| Propiedad | Valor |
|-----------|-------|
| Framework | Jest (Node) — detectado en `mobile/tests/` |
| Config file | `mobile/jest.config.js` (o `package.json` jest key) |
| Quick run command | `cd mobile && npm test -- tests/utils/idGenerator.test.ts` |
| Full suite command | `cd mobile && npm test` |

### Phase 15 Requirements → Test Map

| Req ID | Comportamiento | Tipo de test | Comando / Verificación |
|--------|---------------|--------------|----------------------|
| PARC-01 | Tabla `parcelas` existe en SQLite local | Migration test | `tests/database/migrations.test.ts` — verificar que `parcelas` se importa desde schema ❌ Wave 0 |
| PARC-04 | Tabla `groups` existe (rename de subgroups) | Migration test | `tests/database/migrations.test.ts` — verificar que `groups` existe y `subgroups` no ❌ Wave 0 |
| PARC-08/10 | `generateSubId(parcelaCodigo, grupoCodigo, especieCodigo, posicion)` retorna formato correcto | Unit test | `tests/utils/idGenerator.test.ts` — actualizar tests existentes ✅ (existe, necesita update) |
| MIGR-09 | SubIDs re-computados tienen formato correcto | SQL verification | `RAISE EXCEPTION` en 013 transacción (no automatizable unitariamente) |
| MIGR-10 | Conteos post-migración: 3/21/225/N | SQL verification | `RAISE EXCEPTION` en DO $$ dentro de 013 (no automatizable) |
| MIGR-08 | Ningún grupo con estado `sincronizada` | SQL assertion | Incluida en DO $$ |
| PARC-03/09 | Unique indexes existen y funcionan | SQL check | Verificar con `\d groups` y `\d parcelas` post-012 |

### Wave 0 Gaps

- [ ] `mobile/tests/database/migrations.test.ts` — agregar tests: `groups` table importable desde schema, `subgroups` no existe en schema exportado, `parcelas` importable desde schema
- [ ] `mobile/tests/utils/idGenerator.test.ts` — actualizar firma de todos los tests (requiere 4 parámetros), agregar test con parcelaCodigo

### Sampling Rate

- **Por task commit:** `cd mobile && npm test -- tests/utils/idGenerator.test.ts`
- **Por wave merge:** `cd mobile && npm test`
- **Phase gate:** Suite completa verde antes de `/gsd-verify-work`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Aplica | Control estándar |
|---------------|--------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | Sí | RLS policies en `parcelas` — patrón copiado de `subgroups` (plantation_users JOIN) |
| V5 Input Validation | Sí | CHECK `char_length(descripcion) <= 10000` en Supabase server-side |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Patrón | STRIDE | Mitigación estándar |
|--------|--------|---------------------|
| RLS bypass en parcelas | Elevation of Privilege | Policy con `plantation_users` JOIN (mismo patrón que trees policies 010 y 011) |
| Inyección en batch UPDATE SubIDs | Tampering | UPDATE con JOINs parametrizados — sin input externo en 013 |
| Pérdida de datos irrecuperable en DELETE CASCADE de 11 plantaciones | Denial of Service | Backup R2 pre-migración + transacción ROLLBACK automática en 013 |

---

## Sources

### Primary (HIGH confidence)

- `mobile/src/database/schema.ts` — schema actual Drizzle, verificado directamente
- `mobile/src/utils/idGenerator.ts` — firma actual, 3 parámetros, verificado
- `mobile/drizzle/migrations.js` — bundle de migrations, entradas m0000..m0010
- `mobile/drizzle/meta/_journal.json` — formato exacto de journal entries
- `supabase/migrations/001_initial_schema.sql` — schema base Supabase, constraints y RLS
- `supabase/migrations/006_add_cascade_deletes.sql` — patrón DDL ALTER TABLE con FK
- `supabase/migrations/009_sync_subgroup_update_trees.sql` — RPC sync_subgroup body (referencia `subgroups`)
- `supabase/migrations/010_trees_update_policy.sql` — RLS policy con JOIN a `subgroups`
- `supabase/migrations/011_trees_insert_policy_members.sql` — RLS policy con JOIN a `subgroups`
- `supabase/migrations/data/015_consolidation_mapping.md` — mapping skeleton (existente, pendiente de completar)
- `scripts/audit-v1.1-consolidation.sql` — queries de auditoría completas (existentes)
- `scripts/supabase-backup.sh` — backup script pg_dump → R2 (existente)
- `.planning/phases/15-schema-migration-data-consolidation/15-CONTEXT.md` — decisiones bloqueadas

### Secondary (MEDIUM confidence)

- SQLite documentation — restricciones de ALTER TABLE: no soporta RENAME TABLE, RENAME COLUMN, DROP COLUMN en versiones antiguas [ASSUMED general knowledge, comportamiento consistente con drizzle-kit output observado en codebase]
- PostgreSQL documentation — DDL transaccional (RENAME TABLE, RENAME COLUMN dentro de BEGIN..COMMIT) [ASSUMED general knowledge]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — todo el stack ya está instalado y verificado en el codebase
- Architecture patterns: HIGH — código existente verificado directamente; patrones copiados de migrations existentes
- Pitfalls: HIGH — la mayoría detectados por inspección directa del código (RLS policies con nombres viejos, RPC referencia tabla vieja)
- Data mapping: LOW — el mapping concreto de UUIDs **no existe aún** (skeleton solamente). Requiere auditoría contra Supabase producción.

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (estable — no hay dependencias de terceros cambiantes)

---

## RESEARCH COMPLETE

**Phase:** 15 — Schema migration + data consolidation
**Confidence:** HIGH (código verificado) / LOW (data mapping pendiente de audit)

### Key Findings

- **Bloqueante crítico:** El SQL 013 no puede escribirse hasta que se ejecute `scripts/audit-v1.1-consolidation.sql` en producción y se complete `supabase/migrations/data/015_consolidation_mapping.md`. El plan 15-03 debe incluir esto como Wave 0 / pre-condición.
- **Pitfall oculto de RLS:** Las policies de `trees` (010 y 011) referencian `subgroups` y `subgroup_id` por nombre. Deben dropearse y recrearse en 012 con los nombres nuevos (`groups`, `group_id`), o todo sync falla post-migración.
- **RPC sync_subgroup referencia tabla vieja:** El body de la función Supabase tiene `FROM subgroups` y `INSERT INTO subgroups`. Debe actualizarse como parte de 012 (no esperar a P16) para no romper el sync post-migración durante el window.
- **idGenerator rompe compilación intencionalmente:** 2 repos + 1 test se rompen al cambiar la firma en P15. Esto es aceptado (D-16); la branch no se puede mergear sola sin P16.
- **Los 3 archivos Drizzle son obligatorios:** SQL + journal + migrations.js — omitir migrations.js = splash hang silencioso (lección Phase 13 confirmada en codebase).
- **Constraint CHECK de estado:** Debe actualizarse en 013 DESPUÉS del UPDATE `sincronizada→finalizada`, no en 012, para evitar violación de constraint durante la data migration.

### File Created

`.planning/phases/15-schema-migration-data-consolidation/15-RESEARCH.md`

### Confidence Assessment

| Area | Level | Razón |
|------|-------|-------|
| Standard stack | HIGH | Todo verificado en codebase; nada nuevo que instalar |
| Architecture patterns | HIGH | SQL patterns copiados directamente de migrations existentes |
| Drizzle migration | HIGH | Patrón de 0010 y journal verificados; recreate-table es output estándar de drizzle-kit |
| Pitfalls RLS + RPC | HIGH | Detectados por inspección directa del SQL de policies y función |
| Data mapping (013) | LOW | Depende de ejecutar el audit en producción — skeleton existe pero sin datos reales |

### Open Questions

1. ¿El RPC `sync_subgroup` se actualiza en el plan 15-02 (dentro de 012) o en 15-03? (Recomendación: en 15-02 dentro de 012.)
2. ¿El número exacto de árboles preservados es 6.776? Solo el audit lo confirma.
3. ¿UUIDs completos de las 11 plantaciones a eliminar? Solo el audit los provee.

### Ready for Planning

Research completo para planes 15-01 y 15-02. Plan 15-03 bloqueado hasta completar el audit de producción.
