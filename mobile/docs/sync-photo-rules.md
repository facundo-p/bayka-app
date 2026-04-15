# Reglas de Sincronización de Fotos

Documento pensado para que cualquier persona pueda entender cómo funciona el sistema de fotos y sincronización, qué está permitido, qué está prohibido, y qué pasa en cada situación posible.

---

## Conceptos básicos

### Dónde viven las fotos

Las fotos existen en **tres lugares** posibles:

1. **El dispositivo** — archivo local, ruta tipo `file:///data/.../photo_123.jpg`
2. **Supabase Storage** — archivo en la nube, ruta tipo `plantations/{id}/trees/{id}.jpg`
3. **Base de datos del servidor** — campo `foto_url` en la tabla `trees`, apunta al Storage

Para que una foto esté correctamente sincronizada, debe estar en los tres lugares:
- El archivo en Storage (la foto real)
- La referencia en la DB del servidor (`foto_url` = ruta de Storage)
- Una copia local en el dispositivo (para mostrar offline)

### Qué es fotoSynced

Es un flag booleano **local** (solo existe en el SQLite del dispositivo):
- `false` = "tengo una foto local que todavía no subí a Storage"
- `true` = "la foto local ya está en Storage, no hace falta re-subirla"

---

## Las 10 reglas

### Regla 1: Las fotos se suben a Storage ANTES del RPC

**Prohibido:** enviar el RPC primero y subir la foto después.

**Correcto:** para cada árbol con foto local, subirla a Storage primero. Después enviar el RPC con la ruta de Storage en el campo `foto_url`.

**Por qué:** si se envía el RPC primero con `foto_url=null` y después falla el update, el servidor queda con una referencia perdida para siempre.

### Regla 2: Nunca enviar `file://` al servidor

**Prohibido:** que el campo `foto_url` en la tabla `trees` del servidor contenga una ruta `file:///...`.

**Correcto:** el servidor solo puede tener:
- Una ruta de Storage (`plantations/{id}/trees/{id}.jpg`)
- `null` (sin foto, o foto que falló al subir)

**Por qué:** las rutas `file://` son locales de un dispositivo específico. Otro dispositivo no puede usarlas.

### Regla 3: Cualquier cambio en la foto resetea fotoSynced

Cuando se adjunta, reemplaza o elimina una foto de un árbol, `fotoSynced` vuelve a `false`.

**Por qué:** si cambiaste la foto, la versión anterior en Storage ya no es válida. La nueva foto necesita subirse.

### Regla 4: El pull preserva fotos locales

Cuando se descargan datos del servidor, si el dispositivo ya tiene una foto local (`file://...`), no se sobreescribe con la ruta de Storage del servidor.

**Por qué:** el dispositivo ya tiene el archivo. No tiene sentido reemplazar una referencia funcional con una que necesitaría re-descargarse.

### Regla 5: El pull preserva pendingSync

Cuando se descargan datos del servidor, si un subgrupo tiene `pendingSync=true` local (cambios pendientes), ese flag no se borra.

**Por qué:** si el usuario hizo cambios locales (ej: resolvió un N/N), esos cambios necesitan sincronizarse. El pull no debe borrar esa intención.

### Regla 6: Cualquier miembro de la plantación puede sincronizar cualquier subgrupo

No se filtra por quién creó el subgrupo ni por el estado del subgrupo. Si tiene `pendingSync=true`, se sincroniza.

**Por qué:** un técnico puede resolver N/N en árboles creados por otro técnico. Necesita poder sincronizar esos cambios.

### Regla 7: La resolución de N/N no toca la foto

Cuando se resuelve un N/N (se le asigna una especie), solo se cambian `especieId` y `subId`. La foto no se modifica.

**Por qué:** la foto del N/N es evidencia visual del árbol. No cambia porque se le asigne una especie.

### Regla 8: COALESCE en el RPC protege fotos existentes

El RPC usa `COALESCE(EXCLUDED.foto_url, trees.foto_url)` para el campo `foto_url` en ON CONFLICT. Esto significa: "usa el valor nuevo si no es null, sino mantené el existente".

**Por qué:** cuando se re-sincroniza un subgrupo (ej: después de resolver N/N), el payload puede traer `foto_url=null` para árboles cuya foto ya está en el servidor. El COALESCE evita borrar la referencia existente.

### Regla 9: Upload y download de fotos son idempotentes

- `uploadPhotoToStorage` usa `upsert: true` — si la foto ya existe en Storage, la sobreescribe sin error.
- `downloadPhotosForPlantation` solo descarga fotos con ruta de Storage (no `file://`) — si ya las descargó, no las encuentra de nuevo.

### Regla 10: Los errores de foto no bloquean la sincronización

Si una foto falla al subir o descargar:
- Se registra en los contadores (`uploadFailed` / `downloadFailed`)
- Se muestra al usuario en el modal de resultados
- La sincronización de datos (subgrupos, árboles, especies) continúa normalmente
- La foto queda pendiente (`fotoSynced=false`) para retry en la próxima sync

---

## Casos borde

### Caso 1: Sync sin fotos (checkbox desmarcado)

El usuario puede sincronizar datos sin incluir fotos. En ese caso:
- Los subgrupos y árboles se sincronizan normalmente
- Pero `uploadSubGroup` sube las fotos a Storage **de todas formas** (las fotos se suben dentro de uploadSubGroup, antes del RPC)
- Lo que NO corre es `uploadPendingPhotos` (retry) ni `downloadPhotosForPlantation`

**Consecuencia:** las fotos de los árboles sincronizados sí llegan a Storage y al servidor. Las fotos de árboles cuyo upload falló no se reintentan. Y las fotos de otros dispositivos no se descargan.

### Caso 2: Foto que falla al subir a Storage

Si `uploadPhotoToStorage` falla para un árbol:
- El árbol se envía al RPC con `foto_url: null`
- La foto queda local con `fotoSynced=false`
- En la próxima sync, `uploadPendingPhotos` la encuentra y reintenta
- Si el retry funciona, `supabase.from('trees').update({foto_url})` actualiza el servidor
- El COALESCE en el RPC no se necesita aquí (el update es directo, no via RPC)

### Caso 3: Dos dispositivos crean árboles en el mismo subgrupo

- Device A crea árbol 1 con foto, Device B crea árbol 2 con foto
- Cada uno sincroniza: ambos árboles llegan al servidor con sus fotos
- El RPC usa ON CONFLICT DO UPDATE solo para árboles existentes
- Árboles nuevos se insertan sin conflicto

### Caso 4: Dos dispositivos resuelven el mismo N/N diferente

- Device A resuelve como Especie X, sincroniza → servidor tiene X
- Device B resuelve como Especie Y, sincroniza → pull detecta conflicto (local Y ≠ server X)
- Device B muestra banner "Conflicto detectado":
  - "Aceptar servidor": cambia a X
  - "Mantener local": mantiene Y (sobreescribe servidor en la próxima sync)

### Caso 5: Dispositivo B descarga plantación pero falla la descarga de algunas fotos

- Los árboles quedan con `fotoUrl` = ruta de Storage (no `file://`)
- `fotoSynced = true` (porque el servidor tiene la foto)
- En la próxima sync, `downloadPhotosForPlantation` los encuentra de nuevo y reintenta
- Si sigue fallando, el modal muestra "X fotos no pudieron descargarse"

### Caso 6: Plantación creada offline (sin connexión)

- La plantación se crea localmente con `pendingSync=true`
- Al sincronizar: `uploadOfflinePlantations()` la sube al servidor primero
- Después `syncPlantation` hace el flujo normal de pull→push

### Caso 7: Reactivar un subgrupo sincronizado

- El subgrupo tiene `estado='sincronizada'`, `pendingSync=false`
- `reactivateSubGroup` lo cambia a `estado='activa'`, `pendingSync=true`
- El usuario puede agregar más árboles
- Al finalizar y sincronizar de nuevo, el RPC hace ON CONFLICT DO NOTHING para el subgrupo (ya existe) y ON CONFLICT DO UPDATE para los árboles

### Caso 8: Árbol N/N sin foto (si fuera posible)

Actualmente el flujo de `registerNN` en `useNNFlow` **requiere tomar una foto** antes de crear el árbol. Si `pickPhoto()` retorna null (el usuario cancela la cámara), el árbol no se crea.

Si por algún error un árbol N/N se crea sin foto:
- `fotoUrl = null`, `fotoSynced = false`
- Se sincroniza normalmente con `foto_url: null` en el RPC
- No hay foto que subir ni descargar

### Caso 9: Instalar una versión nueva sobre una existente

Las migraciones de Drizzle pueden fallar silenciosamente en Expo. Por eso existen "safety nets" en `client.ts` que crean las columnas manualmente si no existen. Estos safety nets son idempotentes (si la columna ya existe, el ALTER TABLE falla silenciosamente y se ignora).

### Caso 10: App sin conexión durante la sincronización

- `supabase.auth.getSession()` falla → sync no arranca
- Si falla a mitad de camino: cada subgrupo se sincroniza individualmente. Los que ya se sincronizaron quedan marcados (`pendingSync=false`). Los que fallaron quedan pendientes para la próxima sync.

---

## Resumen visual

```
CREAR ÁRBOL                    SINCRONIZAR                        OTRO DISPOSITIVO
─────────────                  ─────────────                      ─────────────────
                                                                  
 Tomar foto                     1. Pull del servidor               1. Descargar plantación
     ↓                          2. Para cada subgrupo:             2. Pull: árboles con
 file:///foto.jpg                  a. Subir fotos a Storage           foto_url = storage path
 fotoSynced = false                b. RPC con storage path         3. Descargar fotos
     ↓                             c. Marcar sincronizado             de Storage
 Finalizar subgrupo             3. Retry fotos pendientes          4. fotoUrl = file:///...
 pendingSync = true             4. Descargar fotos nuevas             fotoSynced = true
                                                                  
                                                                   Resolver N/N:
                                                                   - Cambiar especieId
                                                                   - No tocar foto
                                                                   - pendingSync = true
                                                                   - Sincronizar de nuevo
```
