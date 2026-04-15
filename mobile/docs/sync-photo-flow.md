# Flujo de Sincronización, Fotos y Resolución N/N

## Arquitectura General

```
Dispositivo A                      Supabase                     Dispositivo B
     |                                |                               |
     |-- 1. pull (subgroups, trees) --|                               |
     |-- 2. upload fotos a Storage -->|                               |
     |-- 3. push (RPC con foto_url) ->|                               |
     |                                |                               |
     |                                |<- 4. pull (trees con foto_url) |
     |                                |<- 5. download fotos de Storage |
     |                                |                               |
     |                                |    6. resolver N/N             |
     |                                |<- 7. push (RPC con species_id) |
```

### Principio fundamental

**Las fotos se suben a Storage ANTES del RPC.** El payload del RPC siempre contiene
la ruta de Storage (`plantations/{id}/trees/{id}.jpg`) o `null`, nunca `file://`.
Esto garantiza que el servidor siempre tiene una referencia válida en un solo paso atómico.

### Conceptos clave

- **Storage bucket**: `tree-photos`
- **Ruta en Storage**: `plantations/{plantation_id}/trees/{tree_id}.jpg`
- **foto_url local**: `file://...` (ruta en el dispositivo, varía entre dispositivos)
- **foto_url servidor**: `plantations/{plantation_id}/trees/{tree_id}.jpg` (ruta relativa en Storage)
- **fotoSynced**: flag booleano en la tabla local `trees`. `true` = la foto local está sincronizada con Storage

---

## Ciclo de vida de un árbol con foto

### 1. Creación del árbol

**Archivo:** `TreeRepository.ts` → `insertTree()`

| Campo | Árbol normal | Árbol N/N |
|-------|-------------|-----------|
| `especieId` | UUID de la especie | `null` |
| `especieCodigo` | Código de especie | `'NN'` |
| `fotoUrl` | `null` (sin foto al crear) | `file://...` (foto obligatoria) |
| `fotoSynced` | `false` (default) | `false` (default) |

Después de crear: `markSubGroupPendingSync(subgrupoId)` → `pendingSync = true`.

**Archivo:** `useNNFlow.ts` → `registerNN()`
- Abre la cámara → `pickPhoto()` → `file://...`
- Llama `insertTree({ especieId: null, especieCodigo: 'NN', fotoUrl: photoUri })`

### 2. Adjuntar/cambiar foto

**Archivo:** `TreeRepository.ts` → `updateTreePhoto(treeId, fotoUrl)`

- Setea `fotoUrl` y **siempre resetea `fotoSynced = false`** (Pitfall 6: fuerza re-upload)
- Llama `markSubGroupPendingSync(subgrupoId)`

### 3. Finalización del subgrupo

**Archivo:** `SubGroupRepository.ts` → `finalizeSubGroup(subgrupoId)`

- Setea `estado = 'finalizada'`
- Llama `markSubGroupPendingSync(subgrupoId)` → `pendingSync = true`
- **Permite N/N sin resolver** — la finalización no bloquea por N/N. El gate de finalización de la *plantación* (no del subgrupo) es el que bloquea.

---

## Upload Flow (Dispositivo → Servidor)

### Paso 1: Pull

**Archivo:** `SyncService.ts` → `pullFromServer(plantacionId)`

Descarga datos del servidor y upsert en local. Para cada árbol:

```ts
// Detecta si el servidor tiene una foto válida (no file://)
const hasFotoOnServer = !!t.foto_url && !t.foto_url.startsWith('file://');

// Preserva foto local si existe
fotoUrl: sql`CASE WHEN ${trees.fotoUrl} LIKE 'file://%' THEN ${trees.fotoUrl} ELSE excluded.foto_url END`

// fotoSynced: true si el servidor tiene storage path, sino preserva el valor local
fotoSynced: hasFotoOnServer ? sql`1` : sql`${trees.fotoSynced}`
```

Para subgrupos:
```ts
// Preserva pendingSync local (no pisar cambios pendientes)
pendingSync: sql`CASE WHEN ${subgroups.pendingSync} = 1 THEN 1 ELSE 0 END`
```

### Paso 2: Upload de subgrupos

**Archivo:** `SyncService.ts` → `uploadSubGroup(sg, sgTrees)`

El flujo dentro de uploadSubGroup:

1. **Para cada árbol con foto local (`file://`):**
   - Sube la foto a Storage: `uploadPhotoToStorage(fotoUrl, storagePath)`
   - Si éxito: guarda `storagePath` en un mapa y marca `fotoSynced = true` localmente
   - Si falla: log del error. El árbol irá con `foto_url: null` en el RPC. La foto queda local (`fotoSynced = false`) para retry en la próxima sync.

2. **Construye el payload del RPC:**
   ```ts
   foto_url: photoMap.get(t.id)           // Subido recién → storage path
     ?? (t.fotoUrl && !t.fotoUrl.startsWith('file://') ? t.fotoUrl : null)
     // Ya tenía storage path → lo envía
     // Es file:// o null → envía null
   ```

3. **Llama al RPC `sync_subgroup`:**
   - INSERT subgroup con `estado = 'sincronizada'`
   - INSERT trees con `ON CONFLICT DO UPDATE SET species_id, sub_id, foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url)`
   - El COALESCE garantiza que un re-sync no borra un `foto_url` existente si el nuevo es null

4. **Si éxito:** `markSubGroupSynced(sg.id)` → `pendingSync = false`, `estado = 'sincronizada'`

### Paso 3: Retry de fotos pendientes

**Archivo:** `SyncService.ts` → `uploadPendingPhotos(plantacionId)`

Corre **después** de todos los subgrupos. Busca árboles con:
- `fotoUrl IS NOT NULL`
- `fotoSynced = false`
- `fotoUrl` que empiece con `file://`

Esto captura fotos que fallaron en el paso 2.1 (upload dentro de uploadSubGroup).
Para cada una: sube a Storage → actualiza servidor → marca fotoSynced local.

### Paso 4: Download de fotos (bidireccional)

**Archivo:** `SyncService.ts` → `downloadPhotosForPlantation(plantacionId)`

Busca árboles locales con `fotoUrl` que NO empiece con `file://` (rutas de Storage
descargadas del servidor pero sin archivo local). Para cada uno:
1. Crea signed URL desde Storage (3600s de validez)
2. Descarga a `{Paths.document}/photos/photo_{tree_id}.jpg`
3. Actualiza local: `fotoUrl = file://...`, `fotoSynced = true`

---

## Download Flow (Servidor → Dispositivo B)

**Archivo:** `SyncService.ts` → `downloadPlantation(serverPlantation)`

1. Upsert plantación localmente
2. `pullFromServer(plantationId)` — descarga subgrupos, árboles, usuarios, especies
3. `downloadPhotosForPlantation(plantationId)` — descarga fotos de Storage

**Estado local después de download:**

| Campo | Valor | Motivo |
|-------|-------|--------|
| `fotoUrl` | `file://...` (local) | Descargado de Storage a disco |
| `fotoSynced` | `true` | La foto ya está en Storage |
| `especieId` | `null` (si es N/N) | Pendiente de resolver |
| `subgroup.pendingSync` | `false` | Sin cambios locales |

---

## Resolución de N/N

### Flujo local

**Archivo:** `TreeRepository.ts` → `resolveNNTree(treeId, especieId, subgrupoCodigo)`

1. Busca el código de la especie seleccionada
2. Regenera el `subId` con el nuevo código de especie
3. `UPDATE trees SET especieId, subId` — **NO toca fotoUrl ni fotoSynced**
4. `markSubGroupPendingSync(subgrupoId)` → `pendingSync = true`

**Archivo:** `useNNResolution.ts` → `handleGuardar()`

Para cada árbol seleccionado, llama `resolveNNTree()`. Después ejecuta callback.

### Re-sync después de resolución

Cuando el usuario sincroniza después de resolver N/N:

1. **Pull:** descarga estado actual del servidor
   - Si el servidor tiene otra especie (conflicto): almacena en `conflictEspecieId`
2. **Push:** `getSyncableSubGroups` devuelve el subgrupo (`pendingSync = true`)
   - `uploadSubGroup` envía `species_id` = especie resuelta
   - `foto_url` = storage path (ya existente) o null
   - RPC actualiza `species_id` y `sub_id` en el servidor
   - `COALESCE(EXCLUDED.foto_url, trees.foto_url)` preserva foto existente
3. **markSubGroupSynced:** `pendingSync = false`, `estado = 'sincronizada'`

### Resolución cross-device

**Escenario:** User A crea N/N en device A. User B descarga y resuelve en device B.

1. Device B descarga plantación → árbol tiene `especieId = null`, foto descargada
2. User B resuelve N/N → `resolveNNTree` cambia `especieId`, marca `pendingSync = true`
3. User B sincroniza:
   - `getSyncableSubGroups` devuelve el subgrupo (no filtra por userId ni estado)
   - RPC actualiza `species_id` y `sub_id` en el servidor
   - RLS policy `"Plantation members can update trees"` permite el update (verifica membership via `plantation_users`)

### Conflictos de resolución

**Escenario:** User A resuelve como Especie X, User B resuelve como Especie Y.

1. User A sincroniza → servidor tiene `species_id = X`
2. User B sincroniza → pull detecta conflicto (local Y ≠ server X)
   - Almacena `conflictEspecieId = X`, `conflictEspecieNombre = 'Nombre de X'`
3. NNResolutionScreen muestra banner de conflicto:
   - **Aceptar servidor:** `acceptServerResolution()` → resuelve como X
   - **Mantener local:** `keepLocalResolution()` → limpia markers, mantiene Y

---

## getSyncableSubGroups

**Archivo:** `SubGroupRepository.ts`

```ts
// Retorna TODOS los subgrupos con pendingSync=true
// Sin filtro por estado: sincronizada con cambios pendientes también debe sincronizarse
// Sin filtro por userId: cualquier miembro de la plantación puede sincronizar
const conditions = [
  eq(subgroups.plantacionId, plantacionId),
  eq(subgroups.pendingSync, true),
];
```

---

## Orquestación desde la UI

### useSync.ts

| Función | Cuándo se usa | Flujo |
|---------|--------------|-------|
| `startBidirectionalSync` | Sync individual (desde hook con plantacionId fijo) | syncPlantation → uploadPendingPhotos → downloadPhotos |
| `startPlantationSync` | Sync de una plantación (desde gear icon) | Igual que bidirectional pero con plantacionId explícito |
| `startGlobalSync` | Sync global (botón de sync general) | syncAllPlantations (pull+push+fotos por plantación) |

### SyncConfirmModal

Muestra checkbox "Incluir fotos" (`incluirFotos`). Si está desmarcado:
- Solo sincroniza datos de subgrupos (sin upload/download de fotos)
- **Precaución:** si un árbol N/N se creó con foto, la foto NO se sube a Storage si el usuario desmarca esta opción. La foto queda pendiente (`fotoSynced = false`) para la próxima sync con fotos.

### SyncProgressModal

Muestra resultados separados:
- `uploadFailed`: fotos que no pudieron subirse a Storage
- `downloadFailed`: fotos que no pudieron descargarse de Storage
- Antes estaban combinados en un solo `failed`, mostrando "no pudieron subirse" para fallas de descarga

---

## RPC: sync_subgroup

**Archivo:** `supabase/migrations/009_sync_subgroup_update_trees.sql`

```sql
-- 1. Verifica DUPLICATE_CODE (otro subgrupo con mismo código en la plantación)
-- 2. INSERT subgroups ON CONFLICT DO NOTHING (estado = 'sincronizada')
-- 3. INSERT trees ON CONFLICT DO UPDATE:
--    species_id = EXCLUDED.species_id     -- actualiza especie (resolución N/N)
--    sub_id = EXCLUDED.sub_id             -- actualiza subId (regenerado)
--    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url)  -- no borra foto existente
```

### SECURITY INVOKER

El RPC usa `SECURITY INVOKER` — las policies RLS se aplican con el usuario autenticado.

### Policies relevantes

| Policy | Tabla | Operación | Condición |
|--------|-------|-----------|-----------|
| "Users can insert own trees" | trees | INSERT | `auth.uid() = usuario_registro` |
| "Plantation members can update trees" | trees | UPDATE | Membership via `plantation_users` join |
| "Authenticated users can read trees" | trees | SELECT | `authenticated` |

---

## Columnas de la tabla trees (relevantes a fotos y N/N)

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `especie_id` | text | sí | UUID de especie. `null` = N/N sin resolver |
| `foto_url` | text | sí | Ruta de Storage o `file://` local. `null` = sin foto |
| `foto_synced` | integer | no | `0` = foto local pendiente de upload. `1` = foto en Storage |
| `conflict_especie_id` | text | sí | Especie del servidor cuando hay conflicto de resolución |
| `conflict_especie_nombre` | text | sí | Nombre de la especie en conflicto (para mostrar en UI) |

---

## Safety nets en client.ts

Migraciones idempotentes que corren al abrir la app, por si las migraciones de Drizzle fallaron:

```ts
// Migración 0008: foto_synced
ALTER TABLE trees ADD COLUMN foto_synced integer NOT NULL DEFAULT 0;

// Migración 0009: pending_sync
ALTER TABLE subgroups ADD COLUMN pending_sync integer NOT NULL DEFAULT 0;
// + marca subgrupos finalizados como pendientes (solo si la columna se acaba de crear)

// Migración 0010: conflict columns
ALTER TABLE trees ADD COLUMN conflict_especie_id text;
ALTER TABLE trees ADD COLUMN conflict_especie_nombre text;

// PRAGMA user_version = 4: limpia todos los pendingSync (one-time fix)
```

---

## Bugs encontrados y corregidos (Fase 14 UAT)

### Bug 1: Safety net de migración 0010 ausente
- **Síntoma**: crash al insertar árbol después de actualizar la app
- **Causa raíz**: columnas de conflicto no existían en DB existente
- **Fix**: safety net en `client.ts`

### Bug 2: Pull borraba pendingSync
- **Síntoma**: subgrupos con N/N nunca se sincronizan
- **Causa raíz**: `onConflictDoUpdate` seteaba `pendingSync = false` incondicionalmente
- **Fix**: `CASE WHEN` preserva el flag local

### Bug 3: hasFotoOnServer trataba file:// como válido
- **Síntoma**: fotoSynced se ponía en true sin que la foto esté en Storage
- **Causa raíz**: `!!t.foto_url` es true para `file://`
- **Fix**: `!t.foto_url.startsWith('file://')`

### Bug 4: markSubGroupSynced no seteaba estado
- **Síntoma**: migraciones no distinguían subgrupos sincronizados
- **Causa raíz**: estado local quedaba en 'finalizada' después de sync
- **Fix**: `markSubGroupSynced` setea `estado: 'sincronizada'`

### Bug 5: Migración one-time re-marcaba subgrupos ya sincronizados
- **Síntoma**: orange dot persistente en plantaciones sincronizadas
- **Causa raíz**: v1-v3 intentaban adivinar qué marcar
- **Fix**: v4 limpia todo y confía en el flujo natural

### Bug 6: uploadSubGroup enviaba file:// al servidor
- **Síntoma**: foto_url en servidor contenía rutas locales
- **Causa raíz**: `uploadSubGroup` enviaba `t.fotoUrl` directo al RPC
- **Fix inicial**: enviar null (separar upload de fotos del RPC)
- **Fix definitivo**: subir foto a Storage ANTES del RPC, enviar storage path en el payload

### Bug 7: RLS bloqueaba UPDATE de foto_url
- **Síntoma**: uploadPendingPhotos subía a Storage pero no actualizaba servidor
- **Causa raíz**: no existía policy UPDATE en tabla trees
- **Fix**: migración 010 con policy basada en `plantation_users`

### Bug 8: getSyncableSubGroups filtraba por estado y userId
- **Síntoma**: resolución de N/N en device B no se sincronizaba
- **Causa raíz**: requería `estado='finalizada'` y `usuarioCreador = userId`
- **Fix**: solo filtrar por `pendingSync = true`

### Bug 9: foto_url=null en servidor después de sync (causa raíz de bugs 6+7)
- **Síntoma**: N/N subido sin foto_url en el servidor, foto en Storage pero referencia perdida
- **Causa raíz**: el diseño separaba upload de foto (paso 1) del RPC (paso 2) del update de foto_url (paso 3). Si el paso 3 fallaba (RLS), el servidor quedaba con null.
- **Fix definitivo**: subir foto a Storage dentro de `uploadSubGroup`, antes del RPC. El RPC recibe el storage path directamente. Un solo paso atómico.

---

## Recuperación de datos

### Script: `scripts/fix-foto-urls.mjs`

Corrige árboles cuyo `foto_url` tiene `file://` o `null` en el servidor pero tienen foto en Storage.

```bash
SUPABASE_SERVICE_KEY=... node scripts/fix-foto-urls.mjs --dry-run  # ver sin modificar
SUPABASE_SERVICE_KEY=... node scripts/fix-foto-urls.mjs             # ejecutar
```
