# Flujo de Sincronizacion de Fotos

## Arquitectura General

La sincronizacion sigue un flujo **pull -> push -> upload fotos -> download fotos**:

```
Dispositivo A                    Supabase                    Dispositivo B
     |                              |                              |
     |--- pull (subgroups, trees) --|                              |
     |--- push (sync_subgroup RPC) >|                              |
     |--- upload foto a Storage --->|                              |
     |--- update foto_url en DB --->|                              |
     |                              |                              |
     |                              |<-- pull (trees con foto_url) |
     |                              |<-- download foto de Storage  |
     |                              |                              |
```

- **Storage bucket**: `tree-photos`
- **Ruta en Storage**: `plantations/{plantation_id}/trees/{tree_id}.jpg`
- **foto_url local**: `file://...` (ruta en el dispositivo)
- **foto_url servidor**: `plantations/{plantation_id}/trees/{tree_id}.jpg` (ruta relativa en Storage)

---

## Upload Flow (Dispositivo A -> Storage -> Server DB)

Archivos: `SyncService.ts` (`uploadPendingPhotos`), `TreeRepository.ts` (`getTreesWithPendingPhotos`, `markPhotoSynced`)

### Pasos

1. **syncPlantation**: ejecuta pull y luego push de subgrupos via RPC `sync_subgroup`.
2. **uploadPendingPhotos(plantacionId)**:
   - Llama a `getTreesWithPendingPhotos` que busca arboles con:
     - `fotoSynced = false`
     - `fotoUrl` que empiece con `file://`
     - Subgrupo con `pendingSync = false` (ya sincronizado al servidor)
   - Por cada arbol pendiente:
     1. Lee el archivo local y lo sube a Storage en `plantations/{plantation_id}/trees/{tree_id}.jpg`
     2. Actualiza `foto_url` en la tabla `trees` del servidor con la ruta de Storage
     3. Llama a `markPhotoSynced(treeId)` que pone `fotoSynced = true` en local

### Precondicion

El subgrupo debe tener `pendingSync = false`. Esto garantiza que el arbol ya existe en el servidor antes de intentar actualizar su `foto_url`.

---

## Download Flow (Server -> Dispositivo B)

Archivos: `SyncService.ts` (`pullFromServer`, `downloadPhotosForPlantation`)

### Pasos

1. **pullFromServer**: baja arboles del servidor. Si el arbol tiene `foto_url` con ruta de Storage (no `file://`), lo inserta/actualiza en local.
2. **downloadPhotosForPlantation(plantacionId)**:
   - Busca arboles locales con `fotoUrl` que NO empiece con `file://` (rutas de Storage pendientes de descarga).
   - Por cada uno:
     1. Crea una signed URL via `supabase.storage.createSignedUrl` (3600s de validez)
     2. Descarga el archivo a `{documentDirectory}/photos/photo_{tree_id}.jpg`
     3. Actualiza local: `fotoUrl = file://...` + `fotoSynced = true`

---

## Invariantes Criticas

### hasFotoOnServer (en pullFromServer)

```ts
const hasFotoOnServer = !!t.foto_url && !t.foto_url.startsWith('file://');
```

Debe excluir URIs `file://` porque estas son rutas locales del dispositivo que subio la foto, no rutas validas de Storage.

### Pull preserva fotoUrl local (CASE WHEN)

```sql
CASE WHEN trees.foto_url LIKE 'file://%' THEN trees.foto_url ELSE excluded.foto_url END
```

Si el dispositivo ya tiene la foto descargada localmente, no se sobreescribe con la ruta de Storage del servidor.

### Pull preserva pendingSync local (CASE WHEN)

```sql
CASE WHEN subgroups.pending_sync = 1 THEN 1 ELSE 0 END
```

Si un subgrupo tiene cambios locales pendientes, el pull no debe limpiar ese flag.

### markSubGroupSynced pone estado='sincronizada'

Despues de un sync exitoso, el estado local cambia de `finalizada` a `sincronizada` inmediatamente, sin esperar al proximo pull.

### getTreesWithPendingPhotos NO filtra por pendingSync

Las fotos se suben independientemente del estado de sync del subgrupo. Si el subgrupo falló el RPC pero la foto existe localmente, debe poder subirse. La query solo requiere `fotoSynced = false` y `fotoUrl` con `file://`.

### getSyncableSubGroups: solo pendingSync=true

No filtra por `estado` ni por `userId`:
- Subgrupos `sincronizada` con cambios pendientes (ej: resolución N/N) también deben sincronizarse
- Cualquier miembro de la plantación puede sincronizar cambios, no solo el creador del subgrupo

### uploadSubGroup nunca envía file:// al servidor

```ts
foto_url: (t.fotoUrl && !t.fotoUrl.startsWith('file://')) ? t.fotoUrl : null
```

Las rutas locales nunca llegan al servidor. `uploadPendingPhotos` se encarga de subir la foto a Storage y actualizar `foto_url` con la ruta de Storage.

### RLS: plantation members can update trees

La policy UPDATE en `trees` usa un join con `plantation_users` para verificar que el usuario pertenece a la plantación. Esto permite:
- Actualizar `foto_url` después de subir a Storage (propio o ajeno)
- Sincronizar resolución de N/N en árboles creados por otro usuario

---

## Bugs Encontrados y Corregidos (Phase 14 UAT)

### Bug 1: Safety net de migracion 0010 ausente

- **Sintoma**: crash al insertar arbol despues de actualizar la app
- **Causa raiz**: las columnas `conflict_especie_id` y `conflict_especie_nombre` no se creaban si la migracion 0010 fallaba
- **Fix**: se agregaron `ALTER TABLE ADD COLUMN` en `client.ts` como safety net (igual que las migraciones 0008 y 0009)

### Bug 2: Pull borrado de pendingSync

- **Sintoma**: subgrupos finalizados con N/N nunca se sincronizan; el punto naranja persiste
- **Causa raiz**: el `onConflictDoUpdate` en el pull de subgrupos seteaba `pendingSync = false` incondicionalmente, borrando el flag de subgrupos con cambios locales pendientes
- **Fix**: se uso `CASE WHEN` para preservar el flag local:
  ```ts
  pendingSync: sql`CASE WHEN ${subgroups.pendingSync} = 1 THEN 1 ELSE 0 END`
  ```

### Bug 3: hasFotoOnServer trataba file:// como valido

- **Sintoma**: las fotos nunca se subian a Storage; `fotoSynced` se ponia en `true` incorrectamente
- **Causa raiz**: la condicion `!!t.foto_url` es `true` para URIs `file://`, que son rutas locales del dispositivo original y no existen en Storage
- **Fix**: se agrego validacion explicita:
  ```ts
  const hasFotoOnServer = !!t.foto_url && !t.foto_url.startsWith('file://');
  ```

### Bug 4: markSubGroupSynced no seteaba estado

- **Sintoma**: las migraciones one-time no podian distinguir subgrupos sincronizados de no sincronizados
- **Causa raiz**: despues de un sync exitoso, el estado local quedaba en `finalizada` en vez de cambiar a `sincronizada`
- **Fix**: `markSubGroupSynced` ahora setea `estado: 'sincronizada'` ademas de `pendingSync: false`

### Bug 5: Migracion one-time re-marcaba subgrupos ya sincronizados

- **Sintoma**: punto naranja en plantaciones que ya estaban sincronizadas
- **Causa raiz**: las migraciones v1-v3 en `client.ts` intentaban adivinar que subgrupos necesitaban sync, pero re-marcaban los que ya estaban sincronizados
- **Fix**: v4 limpia TODOS los `pendingSync` y confia en el flujo natural:
  ```ts
  // v4: Clear ALL pendingSync flags. Period.
  sqlite.execSync("UPDATE subgroups SET pending_sync = 0;");
  sqlite.execSync('PRAGMA user_version = 4;');
  ```

### Bug 6: uploadSubGroup enviaba file:// paths al servidor

- **Sintoma**: `foto_url` en la tabla `trees` del servidor contiene rutas locales `file:///data/...` en vez de rutas de Storage
- **Causa raiz**: `uploadSubGroup` enviaba `t.fotoUrl` directo al RPC, que contiene la URI local del dispositivo
- **Fix**: enviar `null` en `foto_url` cuando es una ruta local. `uploadPendingPhotos` se encarga de subir la foto y actualizar la DB del servidor con la ruta de Storage

### Bug 7: RLS bloqueaba UPDATE de foto_url silenciosamente

- **Sintoma**: `uploadPendingPhotos` sube la foto a Storage exitosamente pero `foto_url` en la DB del servidor nunca se actualiza
- **Causa raiz**: no existia policy UPDATE en la tabla `trees`. El `supabase.from('trees').update()` era bloqueado silenciosamente por RLS
- **Fix**: migracion 010 agrega policy `"Plantation members can update trees"` que verifica pertenencia a la plantacion via `plantation_users`

### Bug 8: getSyncableSubGroups filtraba por estado y userId

- **Sintoma**: despues de resolver un N/N en un dispositivo B (descargado de otro usuario), la sincronizacion no se concreta y queda "pendiente"
- **Causa raiz**: `getSyncableSubGroups` requeria `estado='finalizada'` (excluia subgrupos ya sincronizados con cambios pendientes) y `usuarioCreador = userId` (excluia subgrupos de otros usuarios)
- **Fix**: solo filtrar por `pendingSync=true`. Cualquier subgrupo con cambios pendientes debe poder sincronizarse por cualquier miembro de la plantacion

---

## Recuperacion de Datos

### Script: `scripts/fix-foto-urls.mjs`

Script one-time para corregir arboles en el servidor que quedaron con `file://` en `foto_url` (consecuencia del Bug 3).

**Que hace:**

1. Busca todos los arboles en Supabase con `foto_url LIKE 'file://%'`
2. Para cada arbol, construye la ruta esperada en Storage: `plantations/{plantation_id}/trees/{tree_id}.jpg`
3. Verifica si el archivo existe en Storage (via signed URL)
4. Si existe: actualiza `foto_url` con la ruta de Storage
5. Si no existe: lo reporta como `MISSING` (la foto nunca se subio)

**Uso:**

```bash
# Ver que se corregiria sin modificar nada
SUPABASE_SERVICE_KEY=sk-... node scripts/fix-foto-urls.mjs --dry-run

# Ejecutar las correcciones
SUPABASE_SERVICE_KEY=sk-... node scripts/fix-foto-urls.mjs
```

Requiere la `service_role` key de Supabase (no la anon key).
