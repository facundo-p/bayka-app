# Flujo de Sincronización, Fotos y Resolución N/N

## Arquitectura General

```
Dispositivo A                      Supabase                     Dispositivo B
     |                                |                               |
     |-- 1. pull (groups, trees) -----|                               |
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
la ruta de Storage o `null`, nunca `file://`.
Esto garantiza que el servidor siempre tiene una referencia válida en un solo paso atómico.

### Conceptos clave

- **Storage bucket**: `tree-photos`
- **Ruta en Storage**: `plantations/{plantation_id}/parcelas/{parcela_id}/trees/{tree_id}.jpg` (las fotos viejas pueden tener la ruta sin parcela)
- **foto_url local**: `file://...` (ruta en el dispositivo, varía entre dispositivos)
- **foto_url servidor**: la ruta relativa en Storage
- **fotoSynced**: flag booleano en la tabla local `trees`. `true` = la foto local está sincronizada con Storage

---

## Ciclo de vida de un árbol con foto

### 1. Creación del árbol

**Archivo:** `TreeRepository.ts` → `insertTree()`

| Campo | Árbol normal | Árbol N/N |
|-------|-------------|-----------|
| `especieId` | UUID de la especie | `null` |
| `especieCodigo` | Código de especie | `'NN'` |
| `fotoUrl` | `null`, o `file://...` si la plantación tiene "foto en todos los botones" (#439) | `file://...` (foto obligatoria) |
| `fotoSynced` | `false` (default) | `false` (default) |

Después de crear: `markGroupPendingSync(grupoId)` → `pendingSync = true`.

**Archivo:** `useTreeRegistration.ts` → `registerNN()` / `registerTree()` (camino único)
- Resuelve la política de foto (`services/photo/photoCaptureRules.ts`): N/N siempre pide y exige foto; especie solo si la plantación activó `photoCaptureAllTrees`
- Abre la cámara → `pickPhoto()` → `file://...`
- Llama `insertTreeWithGps({ especieId, especieCodigo, fotoUrl })` (N/N: `especieId: null`, `especieCodigo: 'NN'`)

### 2. Adjuntar/cambiar foto

**Archivo:** `TreeRepository.ts` → `updateTreePhoto(treeId, fotoUrl)`

- Setea `fotoUrl` y **siempre resetea `fotoSynced = false`** (Pitfall 6: fuerza re-upload)
- Llama `markGroupPendingSync(grupoId)`

### 3. Finalización del grupo

**Archivo:** `GroupRepository.ts` → `finalizeGroup(grupoId)`

- Setea `estado = 'finalizada'`
- Llama `markGroupPendingSync(grupoId)` → `pendingSync = true`
- **Permite N/N sin resolver** — la finalización no bloquea por N/N. El gate de finalización de la *plantación* (no del grupo) es el que bloquea.

La app no deja crear, editar ni borrar grupos y árboles de una plantación finalizada o archivada (`utils/permisosDeEdicion.ts`). Lo que quedó cargado y sin subir antes de que pasara lo rechaza el server: ver [Rechazo por plantación finalizada o archivada](#rechazo-por-plantación-finalizada-o-archivada).

---

## Upload Flow (Dispositivo → Servidor)

**Orquestación:** `services/sync/orchestrators.ts` → `syncPlantation(plantacionId)`

```
pullFromServer → pushBorrados → uploadSyncableParcelas → uploadSyncableGroups
```

Después, `hooks/useSync.ts` corre `uploadPendingPhotos` y `downloadPhotosForPlantation` si quedó marcado "Incluir fotos".

### Paso 1: Pull

**Archivo:** `services/sync/pullService.ts` → `pullFromServer(plantacionId)`

Descarga datos del servidor y hace upsert en local. Para cada árbol (`upsertTreesFromServerTx`):

```ts
// Preserva foto local si existe
fotoUrl: sql`CASE WHEN ${sqlIsLocalUri(trees.fotoUrl)} THEN ${trees.fotoUrl} ELSE excluded.foto_url END`

// fotoSynced: true si el servidor tiene storage path, sino preserva el valor local
fotoSynced: sql`CASE WHEN excluded.foto_synced = 1 THEN 1 ELSE ${trees.fotoSynced} END`
```

Los grupos con `pendingSync = true` no se escriben: gana el cambio local, que el push sube después.

### Paso 2: Borrados y parcelas

**Archivo:** `services/sync/pushService.ts`

- `pushBorrados(plantacionId)` manda los borrados anotados por el RPC `sincronizar_borrados` (#467).
- `uploadSyncableParcelas(plantacionId)` hace upsert de las parcelas con `pendingSync = true`. Un grupo cuya parcela no subió se reporta como `PARCELA_PENDING`.

### Paso 3: Upload de grupos

**Archivo:** `services/sync/pushService.ts` → `uploadSyncableGroups` → `uploadGroup(sg, sgTrees)`

1. **Para cada árbol con foto local (`file://`) y `fotoSynced = false`:**
   - Sube la foto a Storage: `uploadPhotoToStorage(fotoUrl, storagePath)`
   - Si éxito: guarda `storagePath` en un mapa y marca `fotoSynced = true` localmente
   - Si falla: log del error. El árbol irá con `foto_url: null` en el RPC. La foto queda local (`fotoSynced = false`) para retry en la próxima sync.

2. **Construye el payload del RPC:**
   ```ts
   foto_url: photoMap.get(t.id) ?? (isRemoteUri(t.fotoUrl) ? t.fotoUrl : null)
   // Subida recién → storage path; ya tenía storage path → lo envía; file:// o null → null
   ```

3. **Llama al RPC `sync_subgroup`** (ver [RPC: sync_subgroup](#rpc-sync_subgroup)).

4. **Clasifica la respuesta** con `classifyRpcResult(sg, data, error)`:
   - Éxito: `markGroupSynced(sg.id)` → `pendingSync = false`. No toca `estado` (#60).
   - Rechazo: el grupo sigue con `pendingSync = true` y el código va al resultado del sync.

### Paso 4: Retry de fotos pendientes

**Archivo:** `services/sync/photoService.ts` → `uploadPendingPhotos(plantacionId)`

Corre **después** del sync de grupos. Busca árboles con foto local (`file://`) y `fotoSynced = false`: las que fallaron en el paso 3.1.
Para cada una: sube a Storage → `UPDATE trees SET foto_url` en el servidor → marca `fotoSynced` local.

### Paso 5: Download de fotos (bidireccional)

**Archivo:** `services/sync/photoService.ts` → `downloadPhotosForPlantation(plantacionId)`

Busca árboles locales con `fotoUrl` que NO empiece con `file://` (rutas de Storage
descargadas del servidor pero sin archivo local). Para cada uno:
1. Crea signed URL desde Storage (3600s de validez)
2. Descarga a `{Paths.document}/photos/photo_{tree_id}.jpg`
3. Actualiza local: `fotoUrl = file://...`, `fotoSynced = true`

---

## Rechazo por plantación finalizada o archivada

Una plantación **finalizada** (#469) solo la escribe un superadmin. Una **archivada** (#477) no la escribe nadie. El server decide con `motivo_no_escribible(id)` (migración 038): devuelve `PLANTACION_ARCHIVADA`, `PLANTACION_FINALIZADA` o `null`, y si aplican las dos gana archivada. Las policies de escritura usan `plantacion_escribible(id)`, que es `motivo_no_escribible(id) IS NULL`.

Lo que el device cargó antes de enterarse **no se pierde**: queda local, pendiente, y se sube cuando la plantación se reabre o desarchiva.

| Paso | Qué devuelve el server | Qué hace la app |
|------|------------------------|-----------------|
| `sync_subgroup` | `{ success: false, error: 'PLANTACION_ARCHIVADA' }` o `'PLANTACION_FINALIZADA'` | `classifyRpcResult` conserva el código y el grupo sigue pendiente. `getErrorMessage` (`services/sync/types.ts`) le dice al usuario que pida desarchivar o reabrir. |
| `sincronizar_borrados` | `rechazados: uuid[]` y `rechazos: [{ id, error }]` | `pushBorrados` limpia solo lo aceptado; los rechazados siguen anotados. `motivosDeRechazo` loguea los motivos. |
| Upsert de parcelas | Error de RLS (`42501`) | `classifyParcelaRpcResult` lo clasifica como `PERMISSION`, no como plantación bloqueada (#511). |
| `UPDATE trees SET foto_url` (paso 4) | 0 filas y sin error: la policy UPDATE no deja ver la fila | Se marca `fotoSynced` igual (#482). |

Storage no mira el estado de la plantación (#512): las fotos suben aunque después el RPC rechace el grupo, y `uploadGroup` ya las marcó `fotoSynced = true` (#489).

Un server sin la 038 no manda `rechazos`: `motivosDeRechazo` asume finalizada, el único motivo posible antes de #477.

---

## Download Flow (Servidor → Dispositivo B)

**Archivo:** `services/sync/downloadService.ts` → `downloadPlantation(serverPlantation)`

1. Upsert plantación localmente
2. `pullFromServer(plantationId)` — descarga subgrupos, árboles, usuarios, especies
3. `downloadPhotosForPlantation(plantationId)` — descarga fotos de Storage, solo con `includePhotos`

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
4. `markGroupPendingSync(grupoId)` → `pendingSync = true`

**Archivo:** `useNNResolution.ts` → `handleGuardar()`

Para cada árbol seleccionado, llama `resolveNNTree()`. Después ejecuta callback.

### Re-sync después de resolución

Cuando el usuario sincroniza después de resolver N/N:

1. **Pull:** descarga estado actual del servidor
   - Si el servidor tiene otra especie (conflicto): almacena en `conflictEspecieId`
2. **Push:** `getSyncableGroups` devuelve el grupo (`pendingSync = true`)
   - `uploadGroup` envía `species_id` = especie resuelta
   - `foto_url` = storage path (ya existente) o null
   - RPC actualiza `species_id` y `sub_id` en el servidor
   - `COALESCE(EXCLUDED.foto_url, trees.foto_url)` preserva foto existente
3. **markGroupSynced:** `pendingSync = false`

### Resolución cross-device

**Escenario:** User A crea N/N en device A. User B descarga y resuelve en device B.

1. Device B descarga plantación → árbol tiene `especieId = null`, foto descargada
2. User B resuelve N/N → `resolveNNTree` cambia `especieId`, marca `pendingSync = true`
3. User B sincroniza:
   - `getSyncableGroups` devuelve el grupo (no filtra por userId ni estado)
   - RPC actualiza `species_id` y `sub_id` en el servidor si User B es miembro y la plantación es escribible

### Conflictos de resolución

**Escenario:** User A resuelve como Especie X, User B resuelve como Especie Y.

1. User A sincroniza → servidor tiene `species_id = X`
2. User B sincroniza → pull detecta conflicto (local Y ≠ server X)
   - Almacena `conflictEspecieId = X`, `conflictEspecieNombre = 'Nombre de X'`
3. NNResolutionScreen muestra banner de conflicto:
   - **Aceptar servidor:** `acceptServerResolution()` → resuelve como X
   - **Mantener local:** `keepLocalResolution()` → limpia markers, mantiene Y

---

## getSyncableGroups

**Archivo:** `GroupRepository.ts`

```ts
// Todos los grupos con pendingSync=true, sin filtro por estado ni por usuario:
// cualquier miembro de la plantación puede subir cambios pendientes.
const conditions = [
  eq(groups.plantacionId, plantacionId),
  eq(groups.pendingSync, true),
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

**Archivo:** `supabase/migrations/038_plantacion_archivada.sql` (última redefinición)

```sql
-- 1. Sin fila en plantation_users para auth.uid()     → PERMISSION
-- 2. motivo_no_escribible(plantation_id) no null      → PLANTACION_ARCHIVADA | PLANTACION_FINALIZADA
-- 3. Otro grupo con el mismo código en la parcela     → DUPLICATE_CODE
-- 4. INSERT groups ON CONFLICT (id) DO UPDATE SET estado
-- 5. INSERT trees ON CONFLICT (id) DO UPDATE:
--    species_id, sub_id                                   -- resolución N/N
--    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url) -- no borra foto existente
--    plantacion_id, global_id y GPS también con COALESCE
-- Cualquier excepción                                  → UNKNOWN
```

Respuesta: `{ success: true }` o `{ success: false, error }`.

### SECURITY DEFINER

El RPC corre como `postgres`, sin RLS: por eso valida membresía y estado de la plantación antes de escribir.

### Policies relevantes (escrituras directas, fuera del RPC)

Exigen membresía (`is_plantation_member`) y `plantacion_escribible` (037):

| Policy | Tabla | Operación |
|--------|-------|-----------|
| "Plantation members can insert trees" | trees | INSERT |
| "Plantation members can update trees" | trees | UPDATE |
| "Plantation members can insert parcelas" | parcelas | INSERT |
| "Plantation members can update parcelas" | parcelas | UPDATE |

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

## Migraciones de esquema

Drizzle es la única fuente de cambios de esquema (#312): el journal es monótono
(`when` de cada entry es siempre mayor al de la anterior) y todo device operativo
está en idx >= 0015. No hay parches ad-hoc de columnas fuera de una migración
versionada; ver `tests/database/noAdHocSchemaPatches.test.ts` y
`tests/database/journalMonotonic.test.ts`.

---

## Bugs encontrados y corregidos (Fase 14 UAT)

### Bug 1: Migración 0010 no se había aplicado en un device existente
- **Síntoma**: crash al insertar árbol después de actualizar la app
- **Causa raíz**: columnas de conflicto no existían en DB existente
- **Fix**: journal de Drizzle monótono (#312) — ver "Migraciones de esquema" arriba

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
- **Fix**: `markSubGroupSynced` setea `estado: 'sincronizada'` (revertido en #60: `markGroupSynced` solo limpia `pendingSync`)

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
