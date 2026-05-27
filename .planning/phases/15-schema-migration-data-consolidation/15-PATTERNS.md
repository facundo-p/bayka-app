# Phase 15: Schema migration + data consolidation — Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 9 archivos nuevos o modificados
**Analogs found:** 9 / 9

---

## File Classification

| Archivo nuevo / modificado | Rol | Data Flow | Analog más cercano | Calidad de match |
|---|---|---|---|---|
| `mobile/drizzle/0011_groups_parcelas_migration.sql` | migration | batch / transform | `mobile/drizzle/0000_peaceful_winter_soldier.sql` | exact (recreate-table pattern) |
| `mobile/drizzle/meta/_journal.json` | config | — | `mobile/drizzle/meta/_journal.json` (entrada idx 10) | exact |
| `mobile/drizzle/migrations.js` | config | — | `mobile/drizzle/migrations.js` (entradas m0000..m0010) | exact |
| `mobile/src/database/schema.ts` | model | CRUD | `mobile/src/database/schema.ts` (tabla `subgroups`, líneas 25-38) | exact (modificación in-place) |
| `mobile/src/utils/idGenerator.ts` | utility | transform | `mobile/src/utils/idGenerator.ts` (firma actual) | exact (modificación in-place) |
| `mobile/tests/utils/idGenerator.test.ts` | test | — | `mobile/tests/utils/idGenerator.test.ts` (tests actuales) | exact (modificación in-place) |
| `supabase/migrations/012_parcelas_and_rename.sql` | migration | batch / DDL | `supabase/migrations/006_add_cascade_deletes.sql` + `supabase/migrations/009_sync_subgroup_update_trees.sql` | role-match |
| `supabase/migrations/013_data_consolidation.sql` | migration | batch / transform | `supabase/migrations/009_sync_subgroup_update_trees.sql` (EXCEPTION pattern) | role-match |
| `supabase/migrations/data/015_consolidation_mapping.md` | doc / config | — | skeleton ya existente | exact (rellenar skeleton) |

---

## Pattern Assignments

### `mobile/drizzle/0011_groups_parcelas_migration.sql` (migration, batch/transform)

**Analog:** `mobile/drizzle/0000_peaceful_winter_soldier.sql`

**Patrón de CREATE TABLE con FK y breakpoints** (líneas 20-45 del analog):
```sql
CREATE TABLE `subgroups` (
	`id` text PRIMARY KEY NOT NULL,
	`plantacion_id` text NOT NULL,
	`nombre` text NOT NULL,
	`codigo` text NOT NULL,
	`tipo` text DEFAULT 'linea' NOT NULL,
	`estado` text DEFAULT 'activa' NOT NULL,
	`usuario_creador` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plantacion_id`) REFERENCES `plantations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trees` (
	`id` text PRIMARY KEY NOT NULL,
	`subgrupo_id` text NOT NULL,
	`especie_id` text,
	`posicion` integer NOT NULL,
	`sub_id` text NOT NULL,
	`foto_url` text,
	`plantacion_id` integer,
	`global_id` integer,
	`usuario_registro` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`subgrupo_id`) REFERENCES `subgroups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`especie_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action
);
```

**Patrón de ALTER TABLE para columnas simples** (`mobile/drizzle/0010_add_tree_conflict_columns.sql` líneas 1-2):
```sql
ALTER TABLE `trees` ADD `conflict_especie_id` text;--> statement-breakpoint
ALTER TABLE `trees` ADD `conflict_especie_nombre` text;
```

**Patrón de UNIQUE INDEX** (`mobile/drizzle/0000_peaceful_winter_soldier.sql` línea 19):
```sql
CREATE UNIQUE INDEX `species_codigo_unique` ON `species` (`codigo`);
```

**Patrón recreate-table para Phase 15** — copiar exactamente este orden:
1. `CREATE TABLE \`groups\`` (con `parcela_id` NULLABLE, FK a `parcelas`)
2. `--> statement-breakpoint`
3. `INSERT INTO \`groups\` SELECT id, plantacion_id, NULL as parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at, pending_sync FROM \`subgroups\``
4. `--> statement-breakpoint`
5. `CREATE TABLE \`trees_new\`` (con `group_id` en lugar de `subgrupo_id`)
6. `--> statement-breakpoint`
7. `INSERT INTO \`trees_new\` SELECT ... FROM \`trees\`` (mapear `subgrupo_id` → `group_id`)
8. `--> statement-breakpoint`
9. `DROP TABLE \`trees\``
10. `--> statement-breakpoint`
11. `DROP TABLE \`subgroups\``
12. `--> statement-breakpoint`
13. `ALTER TABLE \`trees_new\` RENAME TO \`trees\``
14. `--> statement-breakpoint`
15. `CREATE TABLE \`parcelas\`` (empieza vacía)
16. `--> statement-breakpoint`
17. Índices únicos nuevos: `groups_parcela_code_unique`, `groups_parcela_name_unique`, `parcelas_plantation_code_unique`, `parcelas_plantation_name_unique`

**CRÍTICO:** `parcela_id` en `groups` debe ser NULLABLE. SQLite trata NULLs como distintos en UNIQUE — no hay colisión aunque todos los rows tengan `parcela_id = NULL`.

---

### `mobile/drizzle/meta/_journal.json` (config)

**Analog:** `mobile/drizzle/meta/_journal.json` — entradas existentes

**Formato exacto de entrada** (ejemplo entrada idx 10, líneas 75-81):
```json
{
  "idx": 10,
  "version": "6",
  "when": 1745000000000,
  "tag": "0010_add_tree_conflict_columns",
  "breakpoints": true
}
```

**Nueva entrada a agregar al array `entries`:**
```json
{
  "idx": 11,
  "version": "6",
  "when": 1746500000000,
  "tag": "0011_groups_parcelas_migration",
  "breakpoints": true
}
```

El campo `"version"` siempre es `"6"` (string, no número). El campo `when` es epoch milliseconds. El objeto raíz tiene `"version": "7"` (dialecto journal) — no confundir con el `"version": "6"` de cada entrada.

---

### `mobile/drizzle/migrations.js` (config)

**Analog:** `mobile/drizzle/migrations.js` — estructura completa (líneas 1-31)

**Patrón exacto de import y registro** (archivo completo actual, líneas 1-31):
```javascript
// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_peaceful_winter_soldier.sql';
// ... (imports m0001..m0009)
import m0010 from './0010_add_tree_conflict_columns.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
// ...
m0010
    }
  }
```

**Cambio a aplicar** — agregar al final de imports y en el objeto:
```javascript
import m0011 from './0011_groups_parcelas_migration.sql';

// En el objeto migrations, agregar después de m0010:
m0011
```

**CRÍTICO:** Omitir esta actualización causa splash hang silencioso (lección Phase 13 confirmada en codebase).

---

### `mobile/src/database/schema.ts` (model, CRUD)

**Analog:** `mobile/src/database/schema.ts` — definición de `subgroups` (líneas 25-38) y `trees` (líneas 40-54)

**Patrón de tabla con uniqueIndex compuesto** (líneas 25-38 del archivo actual):
```typescript
export const subgroups = sqliteTable('subgroups', {
  id: text('id').primaryKey(),
  plantacionId: text('plantacion_id').notNull().references(() => plantations.id),
  nombre: text('nombre').notNull(),
  codigo: text('codigo').notNull(),
  tipo: text('tipo').notNull().default('linea'),
  estado: text('estado').notNull().default('activa'),
  usuarioCreador: text('usuario_creador').notNull(),
  createdAt: text('created_at').notNull(),
  pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  uniqueCode: uniqueIndex('subgroups_plantation_code_unique').on(t.plantacionId, t.codigo),
  uniqueName: uniqueIndex('subgroups_plantation_name_unique').on(t.plantacionId, t.nombre),
}));
```

**Patrón de tabla con FK nullable** — copiar de `trees` (líneas 40-54):
```typescript
export const trees = sqliteTable('trees', {
  id: text('id').primaryKey(),
  subgrupoId: text('subgrupo_id').notNull().references(() => subgroups.id),
  especieId: text('especie_id').references(() => species.id),  // FK nullable: sin .notNull()
  // ...
});
```

**Cambios a aplicar en schema.ts:**
1. Reemplazar la definición de `subgroups` por `groups` con las mismas columnas + `parcelaId: text('parcela_id').references(() => parcelas.id)` (nullable, sin `.notNull()`)
2. Cambiar índices únicos de `(plantacionId, codigo)` → `(parcelaId, codigo)` con nuevos nombres
3. Reemplazar `subgrupoId` en `trees` por `groupId: text('group_id').notNull().references(() => groups.id)`
4. Agregar nueva tabla `parcelas` (con los mismos índices únicos que `subgroups` pero sobre `plantacionId`)

**Imports necesarios** (línea 1 del archivo actual — sin cambios):
```typescript
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
```

---

### `mobile/src/utils/idGenerator.ts` (utility, transform)

**Analog:** `mobile/src/utils/idGenerator.ts` — archivo completo (líneas 1-14)

**Código actual completo:**
```typescript
/**
 * Generates the SubID for a tree.
 * Format: {subgrupoCodigo}{especieCodigo}{posicion}
 * Examples:
 *   generateSubId('L23B', 'ANC', 12) → 'L23BANC12'
 *   generateSubId('L23B', 'NN', 5)   → 'L23BNN5'
 */
export function generateSubId(
  subgrupoCodigo: string,
  especieCodigo: string,
  posicion: number
): string {
  return `${subgrupoCodigo}${especieCodigo}${posicion}`;
}
```

**Reemplazo completo — misma estructura, 4 parámetros:**
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

**Call sites que compilarán roto hasta Phase 16 (aceptado — D-16):**
- `mobile/src/repositories/TreeRepository.ts` — 4 llamadas con firma 3-arg
- `mobile/src/repositories/SubGroupRepository.ts` — 1 llamada (línea 237)
- `mobile/tests/utils/idGenerator.test.ts` — 4 tests con firma 3-arg (también se actualiza en Phase 15)

---

### `mobile/tests/utils/idGenerator.test.ts` (test)

**Analog:** `mobile/tests/utils/idGenerator.test.ts` — archivo completo (líneas 1-19)

**Estructura de test actual:**
```typescript
import { generateSubId } from '../../src/utils/idGenerator';

describe('generateSubId', () => {
  it('generates correct SubID for standard tree', () => {
    expect(generateSubId('L23B', 'ANC', 12)).toBe('L23BANC12');
  });

  it('generates correct SubID for N/N tree', () => {
    expect(generateSubId('L23B', 'NN', 5)).toBe('L23BNN5');
  });

  it('generates correct SubID for short codes', () => {
    expect(generateSubId('PA', 'LAP', 1)).toBe('PALAP1');
  });

  it('handles position 0', () => {
    expect(generateSubId('L23B', 'ANC', 0)).toBe('L23BANC0');
  });
});
```

**Cambio — actualizar todos los tests a 4 parámetros + agregar test de prefijo parcela:**
```typescript
import { generateSubId } from '../../src/utils/idGenerator';

describe('generateSubId', () => {
  it('generates correct SubID for standard tree', () => {
    expect(generateSubId('LP1', 'L23B', 'ANC', 12)).toBe('LP1L23BANC12');
  });

  it('generates correct SubID for N/N tree', () => {
    expect(generateSubId('LP1', 'L23B', 'NN', 5)).toBe('LP1L23BNN5');
  });

  it('generates correct SubID for short codes', () => {
    expect(generateSubId('MP3', 'L1', 'LAP', 1)).toBe('MP3L1LAP1');
  });

  it('handles position 0', () => {
    expect(generateSubId('LP1', 'L23B', 'ANC', 0)).toBe('LP1L23BANC0');
  });

  it('includes parcela code as prefix', () => {
    expect(generateSubId('SO', 'G1', 'ANC', 3)).toBe('SOG1ANC3');
  });
});
```

---

### `supabase/migrations/012_parcelas_and_rename.sql` (migration, DDL)

**Analogs:**
- `supabase/migrations/006_add_cascade_deletes.sql` — patrón `DROP CONSTRAINT + ADD CONSTRAINT` para FKs
- `supabase/migrations/001_initial_schema.sql` — patrón `CREATE TABLE` con `CHECK`, `UNIQUE`, `REFERENCES`
- `supabase/migrations/009_sync_subgroup_update_trees.sql` — patrón `CREATE OR REPLACE FUNCTION`
- `supabase/migrations/010_trees_update_policy.sql` y `011_trees_insert_policy_members.sql` — patrón RLS con `plantation_users` JOIN

**Patrón DROP+ADD FK** (`supabase/migrations/006_add_cascade_deletes.sql` líneas 4-14):
```sql
alter table subgroups
  drop constraint subgroups_plantation_id_fkey,
  add constraint subgroups_plantation_id_fkey
    foreign key (plantation_id) references plantations(id) on delete cascade;

alter table trees
  drop constraint trees_subgroup_id_fkey,
  add constraint trees_subgroup_id_fkey
    foreign key (subgroup_id) references subgroups(id) on delete cascade;
```

**Patrón CHECK constraint** (`supabase/migrations/001_initial_schema.sql` líneas 58-68):
```sql
create table subgroups (
  id uuid primary key default gen_random_uuid(),
  plantation_id uuid not null references plantations(id),
  tipo text not null default 'linea' check (tipo in ('linea', 'parcela')),
  estado text not null default 'activa' check (estado in ('activa', 'finalizada', 'sincronizada')),
  unique (plantation_id, codigo),
  unique (plantation_id, nombre)
);
```

**Patrón RLS con plantation_users JOIN** (`supabase/migrations/010_trees_update_policy.sql` líneas 7-25):
```sql
CREATE POLICY "Plantation members can update trees"
ON trees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM subgroups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = trees.subgroup_id
    AND pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM subgroups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = trees.subgroup_id
    AND pu.user_id = auth.uid()
  )
);
```

**Patrón RLS INSERT con WITH CHECK** (`supabase/migrations/011_trees_insert_policy_members.sql` líneas 8-18):
```sql
CREATE POLICY "Plantation members can insert trees"
ON trees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM subgroups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = subgroup_id
    AND pu.user_id = auth.uid()
  )
);
```

**Patrón CREATE OR REPLACE FUNCTION con SECURITY DEFINER** (`supabase/migrations/009_sync_subgroup_update_trees.sql` líneas 8-12):
```sql
CREATE OR REPLACE FUNCTION sync_subgroup(
  p_subgroup JSONB,
  p_trees    JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
```

**Estructura de 012 — orden obligatorio (para evitar violación de constraint):**
1. `BEGIN;`
2. `CREATE TABLE parcelas (...)` — con `CHECK (char_length(descripcion) <= 10000)`, `UNIQUE (plantation_id, nombre)`, `UNIQUE (plantation_id, codigo)`
3. `ALTER TABLE subgroups RENAME TO groups;`
4. `ALTER TABLE groups ADD COLUMN parcela_id uuid REFERENCES parcelas(id);` — DEFAULT NULL
5. `DROP CONSTRAINT subgroups_plantation_id_fkey` + `ADD CONSTRAINT groups_plantation_id_fkey` (copiar patrón de 006)
6. `DROP INDEX IF EXISTS` unique indexes viejos per-plantation (verificar nombres exactos con `SELECT conname FROM pg_constraint WHERE conrelid = 'subgroups'::regclass AND contype = 'u'` antes de correr)
7. `CREATE UNIQUE INDEX groups_parcela_codigo_unique ON groups (parcela_id, codigo);`
8. `CREATE UNIQUE INDEX groups_parcela_nombre_unique ON groups (parcela_id, nombre);`
9. `ALTER TABLE groups DROP CONSTRAINT IF EXISTS subgroups_tipo_check;` + `ADD CONSTRAINT groups_tipo_check CHECK (tipo IN ('linea', 'bosquete'));`
10. **NO** actualizar el CHECK de estado aquí — esperar a 013 después de MIGR-08
11. `ALTER TABLE trees RENAME COLUMN subgroup_id TO group_id;`
12. `DROP CONSTRAINT trees_subgroup_id_fkey` + `ADD CONSTRAINT trees_group_id_fkey` (copiar patrón de 006)
13. `DROP POLICY "Plantation members can update trees" ON trees;` + `CREATE POLICY` nuevo con `group_id` (copiar patrón de 010)
14. `DROP POLICY "Plantation members can insert trees" ON trees;` + `CREATE POLICY` nuevo con `group_id` (copiar patrón de 011)
15. `CREATE OR REPLACE FUNCTION sync_subgroup(...)` — body actualizado para referenciar `groups` y `group_id` (copiar estructura de 009, reemplazar `subgroups`→`groups`, `subgroup_id`→`group_id`)
16. `ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;`
17. `CREATE POLICY "Authenticated users can read parcelas"` (copiar patrón SELECT de 001)
18. `CREATE POLICY "Plantation members can insert parcelas"` (copiar patrón INSERT de 011 adaptado)
19. `CREATE POLICY "Plantation members can update parcelas"` (copiar patrón UPDATE de 010 adaptado)
20. `COMMIT;`

---

### `supabase/migrations/013_data_consolidation.sql` (migration, batch/transform)

**Analog:** `supabase/migrations/009_sync_subgroup_update_trees.sql` — patrón `EXCEPTION WHEN OTHERS` + estructura DO $$

**Patrón EXCEPTION y RAISE** (`supabase/migrations/009_sync_subgroup_update_trees.sql` líneas 63-65):
```sql
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;
```

**Patrón DO $$ con DECLARE y RAISE EXCEPTION** — usar para verificaciones post-consolidación:
```sql
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM plantations;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'VERIFICACION FALLIDA: se esperaban 3 plantaciones, hay %', v_count;
  END IF;
  RAISE NOTICE 'OK: % plantaciones', v_count;
END $$;
```

**Patrón UPDATE masivo con JOIN** — mirrear de `scripts/audit-v1.1-consolidation.sql` JOIN pattern:
```sql
-- Forma robusta para N/N (species_id nullable):
UPDATE trees t
SET sub_id = p.codigo || g.codigo || COALESCE(sp.codigo, 'NN') || t.posicion::text
FROM groups g
JOIN parcelas p ON p.id = g.parcela_id
LEFT JOIN species sp ON sp.id = t.species_id
WHERE t.group_id = g.id;
```

**Estructura de 013 — orden obligatorio (para evitar violación de constraints):**
1. `BEGIN;`
2. `UPDATE groups SET estado = 'finalizada' WHERE estado = 'sincronizada';` — MIGR-08 PRIMERO
3. `ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_estado_check;` + `ADD CONSTRAINT ... CHECK (estado IN ('activa', 'finalizada'));` — DESPUÉS del UPDATE
4. `INSERT INTO plantations (...)` — 3 nuevas plantaciones con UUIDs fijos (del mapping)
5. `INSERT INTO parcelas (...)` — 21 parcelas (del mapping completado en 015_consolidation_mapping.md)
6. `UPDATE groups SET plantation_id = ..., parcela_id = ... WHERE plantation_id = '<source-uuid>';` — repetir para cada fuente (21 UPDATEs con UUIDs completos del audit)
7. `UPDATE trees t SET sub_id = ...` — batch SubID recompute con LEFT JOIN species (COALESCE 'NN')
8. `DELETE FROM plantations WHERE id IN (...);` — 11 UUIDs completos del audit (CASCADE elimina grupos y árboles de esas plantaciones)
9. `DO $$ ... END $$;` — verificaciones: 3 plantaciones, 21 parcelas, 225 grupos, N árboles (N = re-confirmado por audit), 0 sub_ids nulos, 0 grupos sin parcela_id
10. `COMMIT;`

**CRÍTICO — Pitfall 7:** Si el CHECK de estado se agrega en 012 sin 'sincronizada', el UPDATE del paso 2 viola el constraint y toda la transacción hace ROLLBACK. Por eso el CHECK se modifica aquí en 013 DESPUÉS del UPDATE.

---

### `supabase/migrations/data/015_consolidation_mapping.md` (doc/config)

**Analog:** El skeleton ya existe en `supabase/migrations/data/015_consolidation_mapping.md`

El archivo tiene estructura completa con placeholders `<uuid>`, `<N>`, `<YYYY-MM-DD>`. La tarea es **rellenar** el skeleton, no crearlo de nuevo. Ver el archivo en estado actual (líneas 1-101).

**Proceso:**
1. Ejecutar `scripts/audit-v1.1-consolidation.sql` en producción (Supabase SQL editor)
2. Pegar resultados en las tablas del mapping (secciones §1-§5 del audit corresponden a las secciones del documento)
3. Completar el sign-off checklist (líneas 93-98)
4. Aprobar antes de escribir 013

---

## Shared Patterns

### RLS con plantation_users JOIN
**Source:** `supabase/migrations/010_trees_update_policy.sql` (líneas 7-25) y `supabase/migrations/011_trees_insert_policy_members.sql` (líneas 8-18)
**Aplicar a:** Policies INSERT y UPDATE de la nueva tabla `parcelas` en `012_parcelas_and_rename.sql`

```sql
-- Patrón INSERT (copiar de 011, adaptar para parcelas):
WITH CHECK (
  EXISTS (
    SELECT 1 FROM plantation_users pu
    WHERE pu.plantation_id = plantation_id   -- columna local en parcelas
    AND pu.user_id = auth.uid()
  )
);

-- Patrón UPDATE (copiar de 010, adaptar para parcelas):
USING (
  EXISTS (
    SELECT 1 FROM plantation_users pu
    WHERE pu.plantation_id = plantation_id
    AND pu.user_id = auth.uid()
  )
)
WITH CHECK ( ... mismo ... );
```

### CHECK constraint server-side
**Source:** `supabase/migrations/001_initial_schema.sql` (línea 63)
**Aplicar a:** `parcelas.descripcion` en `012_parcelas_and_rename.sql`

```sql
CONSTRAINT parcelas_descripcion_length CHECK (char_length(descripcion) <= 10000)
```

### Separador de statements Drizzle (`--> statement-breakpoint`)
**Source:** `mobile/drizzle/0000_peaceful_winter_soldier.sql` (entre cada statement)
**Aplicar a:** `mobile/drizzle/0011_groups_parcelas_migration.sql` — entre cada CREATE, INSERT, DROP, ALTER

### Transacción atómica en Postgres
**Source:** Toda migration que modifica data (`BEGIN;` ... `COMMIT;`)
**Aplicar a:** `012_parcelas_and_rename.sql` y `013_data_consolidation.sql`
Las DDL en Postgres son transaccionales — un error hace ROLLBACK completo.

### `pending_sync` como integer booleano en SQLite
**Source:** `mobile/src/database/schema.ts` (línea 34)
```typescript
pendingSync: integer('pending_sync', { mode: 'boolean' }).notNull().default(false),
```
**Aplicar a:** Tabla `parcelas` en schema.ts

### `pending_sync` como boolean en Supabase
**Source:** `supabase/migrations/001_initial_schema.sql` (tablas con pending_sync)
```sql
pending_sync boolean NOT NULL DEFAULT false,
```
**Aplicar a:** Tabla `parcelas` en `012_parcelas_and_rename.sql`

---

## No Analog Found

No hay archivos sin analog. Todos los patrones tienen referencia directa en el codebase.

---

## Pitfalls críticos detectados en los analogs

Estos no son patrones a copiar sino errores a EVITAR, detectados por inspección directa:

1. **`migrations.js` sin m0011** → splash hang. Ver `mobile/drizzle/migrations.js` líneas 1-31 — el bundle DEBE tener la nueva entrada.

2. **Policies 010 y 011 con `subgroups`/`subgroup_id` hardcodeados** → se rompen post-rename. `mobile/supabase/migrations/010_trees_update_policy.sql` línea 12: `WHERE sg.id = trees.subgroup_id` — debe quedar `trees.group_id` en la nueva policy.

3. **RPC `sync_subgroup` con `FROM subgroups` y `INSERT INTO subgroups`** → `relation "subgroups" does not exist` post-rename. Ver `supabase/migrations/009_sync_subgroup_update_trees.sql` líneas 19, 29 — el body debe actualizarse en 012.

4. **CHECK de estado actualizado en 012 antes del UPDATE `sincronizada→finalizada`** → violation of check constraint. El CHECK que elimina 'sincronizada' debe ir en 013, DESPUÉS del UPDATE.

5. **`parcela_id` NOT NULL en SQLite** → INSERT SELECT FROM subgroups falla. Debe ser NULLABLE.

---

## Metadata

**Scope de búsqueda de analogs:**
- `mobile/drizzle/` — todas las migrations existentes (0000..0010)
- `mobile/src/database/schema.ts`
- `mobile/src/utils/idGenerator.ts`
- `mobile/tests/utils/idGenerator.test.ts`
- `supabase/migrations/001_initial_schema.sql` — schema base y RLS
- `supabase/migrations/006_add_cascade_deletes.sql` — patrón DROP+ADD constraint
- `supabase/migrations/009_sync_subgroup_update_trees.sql` — RPC y EXCEPTION pattern
- `supabase/migrations/010_trees_update_policy.sql` — RLS UPDATE policy
- `supabase/migrations/011_trees_insert_policy_members.sql` — RLS INSERT policy
- `supabase/migrations/data/015_consolidation_mapping.md` — skeleton existente
- `scripts/audit-v1.1-consolidation.sql` — query de auditoría existente
- `scripts/supabase-backup.sh` — script de backup existente

**Archivos escaneados:** 13
**Fecha de extracción:** 2026-05-05
