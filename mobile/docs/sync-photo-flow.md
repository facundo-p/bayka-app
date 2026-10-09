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
- **Ruta en Storage**: `plantations/{plantation_id}/parcelas/{parcela_id}/trees/{tree_id}-{version}.jpg`, con la versión sacada del nombre del archivo local (#795). Cada foto nueva tiene su path, así que una subida que pierde contra otra no pisa el archivo ganador. Las fotos viejas pueden tener la ruta sin versión o sin parcela
- **fotoBase / latitudeBase / longitudeBase / gpsCapturedAtBase**: lo último que el teléfono sabe que tiene el server. Viajan como base y el server decide con ellas (ver [Conflictos de sincronización](#conflictos-de-sincronización-795))
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

- Setea `fotoUrl` y **siempre resetea `fotoSynced = false`** (fuerza re-upload)
- Llama `markGroupPendingSync(grupoId)`
- Poner una foto no descarta la quitada pendiente del mismo árbol: la descarta su subida (`confirmarFotoSubida`), si la fila sigue con esa foto (#816)
- Cerrada la transacción, borra el archivo local de la foto anterior (best-effort, solo dentro de `photos/`), salvo que el path no haya cambiado. Borrar un árbol o un grupo también borra sus archivos (#490)

### 2b. Quitar la foto (#498, #816)

El botón Quitar llama `quitarFotoDelArbol(treeId, confirmado)`, que decide según
la fila, no según lo que muestra la pantalla:

- **Sin subir** (`fotoSinSubir`: local y `fotoSynced = false`): deshace el cambio
  local sin preguntar y sin anotar nada para el server. El árbol vuelve a lo que
  tenía en la última sincronización: `fotoBase` como foto remota sin bajar
  (`fotoSynced = true`, se baja a demanda), o sin foto. Borra el archivo local.
  Si había una quitada pendiente (se quitó la del server y después se sacó la que
  se borra), queda sin foto y la quitada sigue pendiente. La escritura va en una
  transacción con guard sobre la fila leída: si la sync la subió en el medio, no
  la deshace y se decide de nuevo.
- **Ya subida:** la UI pide confirmar ("Quitar la foto del árbol. Se quita para
  todos los que vean este árbol.") y llama con `confirmado`, que pasa a
  `quitarFotoParaTodos`. Sin `confirmado` no se quita: devuelve
  `requiereConfirmacion` y la UI pregunta. Cubre la foto que la pantalla mostraba
  sin subir y la sync subió antes del toque.
- **El grupo queda pendiente** después de deshacer, aunque ya no tenga nada que
  subir: `pendingSync` no distingue qué cambió (lo mismo que en #808). El push
  siguiente lo baja sin cambiar nada en el server.

`quitarFotoParaTodos` (`updateTreePhoto(treeId, '')`) deja `fotoUrl = null` y, en
la misma transacción, anota en `borrados_pendientes` una fila `tipo = 'foto'` con
el id del árbol. "Conservar la mía" de un conflicto de foto quitada también va por
acá.

Sin ese registro la foto volvía: `sync_subgroup` hace
`foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url)` (un null nunca borra) y
el pull, que corre antes del push, adoptaba el path del server y la volvía a bajar.

| Paso | Qué hace con la foto quitada |
|------|------------------------------|
| Pull (`pullTrees`) | Baja la fila del árbol con `foto_url = null`: no restaura ni re-descarga |
| Push (`pushBorrados`) | Llama `quitar_fotos_arboles(ids, bases)` (044, 076), que pone `trees.foto_url = NULL`. `bases` lleva el `fotoBase` de cada árbol: si el server ya tiene otra foto, no la quita (#810) |
| Confirmación | Limpia el registro, salvo los ids `rechazados` (plantación no escribible), que quedan pendientes. Las quitadas dejan `fotoBase = null`: el server ya no tiene foto. Los `conservados` se asientan como conflicto (ver abajo) |

- **La foto cambió en el server (#810):** `quitar_fotos_arboles` la conserva y la
  devuelve en `conservados.arboles`, con la forma de `sync_subgroup`.
  `asentarFotosQuitadas` (`asentarGrupo.ts`) adopta la del server y guarda un
  conflicto de foto con lo que tiene la fila: `mio = null` ("Sin foto (la
  quitaste)"), o la nueva sin subir si se sacó otra después de quitarla (#816).
  Va en la misma transacción que limpia el registro. "Conservar la mía" la vuelve a quitar, con
  la del server como base; "descartar" se queda con la del server. Un árbol sin
  `fotoBase` (una foto bajada antes de que existieran las bases) viaja sin base y
  el server la quita como antes, igual que con el APK de prod.
- **La base no se pierde si la quitada tarda:** el pull baja la fila sin foto pero
  conserva el `fotoBase` local, y si el push del grupo trae la foto nueva antes que
  la quitada, `asentarGrupo` también la asienta como conflicto. Sin esto, el push
  siguiente quitaría la foto nueva con ella como base.
- **Quitar → sacar otra → borrarla (#816):** la quitada se conserva mientras la
  nueva no sube, así que borrar la nueva deja el árbol sin foto y el pedido de
  quitar llega al server. En la sync, la quitada va primero (`pushBorrados`) y el
  push del grupo sube la nueva sobre la base ya sin foto. `confirmarFotoSubida`
  descarta la quitada solo si la fila sigue con la foto subida, y en la misma
  transacción que mueve la base.
- **Foto borrada mientras subía:** si al confirmar la subida la fila ya no tiene
  esa foto ni otra sin subir, `confirmarFotoSubida` anota la quitada con la subida
  como base: el server no se queda con la que se borró. Si hay otra sin subir, esa
  la reemplaza al subirse.
- **Límites conocidos:**
  - Un `fotoBase` null no distingue "no vio foto" de "la bajó antes de las
    bases", así que viaja sin base. Pasa solo con una foto ya subida y bajada
    antes de 0034 en un grupo que el pull todavía no refrescó: el primer pull
    después de actualizar completa la base de los grupos sin cambios pendientes.
    No hay backfill: el path del server no se puede derivar con certeza del
    teléfono.
  - Un grupo pendiente no recibe el pull, así que su `fotoBase` puede ser vieja si
    otro cambió la foto en el server. Deshacer una foto sin subir vuelve a esa
    foto vieja; el push del grupo la corrige: el server devuelve la suya en
    `conservados` y el teléfono la adopta sin conflicto.

- **Id compartido con el borrado del árbol:** `borrados_pendientes.id` es la
  clave. Si después se borra el árbol, el registro pasa a `tipo = 'arbol'`: borrar
  la fila ya se lleva la foto.
- **Árbol que nunca llegó al server:** el RPC no encuentra la fila, no la rechaza
  y el registro se limpia.
- **Objeto de Storage:** el móvil no lo borra (la policy de DELETE de
  `tree-photos` exige admin). `quitar_fotos_arboles` lo anota en `fotos_quitadas`
  y lo borra el cron, igual que las fotos reemplazadas o perdedoras de un conflicto
  que anota `sync_subgroup`. Lo que nadie anota (una subida que el server rechazó)
  lo borra el cron a los 30 días si ningún árbol lo usa (#806).
- **Otros devices:** conservan su copia local (`file://`), porque el pull preserva
  siempre la foto local.

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

Después, `hooks/useSync.ts` corre siempre `uploadPendingPhotos`, y `downloadPhotosForPlantation` solo con "Descargar fotos de otros celulares" prendido (#565).

### Paso 0: plantaciones creadas o editadas offline, sus especies y técnicos

**Archivo:** `services/sync/preSteps.ts` → `runGlobalPreSteps()`, antes del pull de cualquier plantación.

- `uploadOfflinePlantations` inserta las creadas offline (`pendingSync = true`) con todos sus datos y deja lo subido como snapshot `*Server`. Si ya existe (un intento anterior insertó y fallaron las especies), sube por `editar_plantacion` lo editado desde ese intento, con el snapshot como base; si el server la rechaza por finalizada o archivada, queda pendiente con ese motivo.
- `uploadPendingEdits` sube las editadas offline (`pendingEdit = true`) por la RPC `editar_plantacion` (#634): solo los campos que difieren de la base (lugar, periodo, descripción, fecha de inicio, objetivo, GPS, foto en todos los botones y visibilidad), cada uno con su base. Sin diferencias no hay llamada. La edición online (`updatePlantation`) usa la misma RPC con lo que el usuario tocó en el formulario y, como base, los valores con que se abrió.
- La base (`baseDeEdicion`, solo local) es lo que el server tenía al entrar en edición offline. El server aplica un campo si todavía tiene ese valor; si no, lo devuelve como conflicto con su valor, quién y cuándo (columna `plantations.ultima_edicion`). El conflicto queda en `conflictosDeEdicion`: el campo muestra el valor de la web, el resto sube igual, el resumen del sync avisa con "Resolver", la tarjeta muestra "Cambios por resolver" y la pantalla `ResolverCambiosScreen` deja elegir por campo. Elegir el propio lo re-encola como edición offline con la web como base; elegir el de la web lo descarta.
- Los campos y sus columnas viven en `utils/camposDePlantacion.ts`. Cada uno tiene un snapshot `*Server` con el último valor conocido del server: el pull lo refresca siempre. El valor vivo lo pisa sin cambios pendientes; con cambios pendientes, solo en los campos que el usuario no tocó (vivo igual al snapshot anterior), y a esos también les mueve la base. Descartar la edición vuelve al snapshot.
- Las especies de la alta suben como altas por `aplicar_cambios_especies` (#635): si un intento anterior ya la subió y la web le sumó especies, no se pisan. Las bajas hechas mientras la plantación estaba sin subir se anotan y viajan en la misma llamada: si ese intento anterior ya había subido la especie, se quita.
- `uploadPendingSpeciesChanges` (`services/sync/cambiosDeEspecies.ts`) sube las altas y bajas de especies anotadas en `cambios_especies_pendientes` de las plantaciones ya subidas, por `aplicar_cambios_especies`. Lo aceptado deja de estar pendiente; una baja rechazada por árboles re-habilita la especie en SQLite y el resumen la lista en "Especies que no se quitaron". Si la plantación no admite el cambio (finalizada, archivada, sin permiso), queda pendiente. Guardar la configuración online sube en el momento por la misma función (`EspeciesDePlantacionService`); si ahí la plantación no lo admite, se deshace solo ese guardado y lo pendiente de antes sigue pendiente. El pull de `plantation_species` no borra un alta pendiente ni devuelve una baja pendiente.
- `uploadPendingTechnicianAssignments` (`services/sync/tecnicosDePlantacion.ts`) sube, después de las especies, los técnicos asignados en el teléfono (`altas_de_tecnicos_pendientes`) de las plantaciones ya subidas, por `aplicar_cambios_tecnicos` (#636). Lo aceptado deja de estar pendiente; un técnico dado de baja, un usuario que no es técnico o uno de otra organización se quita de `plantation_users` y el resumen lo lista en "Técnicos que no se asignaron". Si la plantación no admite el cambio (archivada, sin permiso), queda pendiente. Después se refresca el caché `tecnicos_de_organizacion` (`catalogoDeTecnicos.ts`, solo admin). Guardar con señal sube en el momento (`TecnicosDePlantacionService`), esperando la respuesta como mucho `ESPERA_DE_SUBIDA_MS`; después sigue en segundo plano, y una respuesta tardía solo confirma lo aceptado: lo rechazado queda pendiente para que el próximo sync lo descarte y lo liste. El pull de `plantation_users` no borra un alta pendiente.
- Después de subir una alta, o una edición que cambió lugar o periodo, se consulta si el server tiene otra con el mismo lugar y periodo (`ilike`, como la web). Si la hay, el resultado lleva `duplicada: true` y el resumen del sync la lista en "Mismo lugar y periodo". No frena nada. El alta online (`PlantationCreationService.tryPushNow`, con señal) hace el mismo chequeo en el momento: si hay coincidencia, avisa apenas se crea, con el mismo texto, sin esperar a un sync (#655).

### Paso 1: Pull

**Archivo:** `services/sync/pullService.ts` → `pullFromServer(plantacionId)`

Antes de bajar nada, el pull consulta `estado_remoto_plantaciones` (#478). Si la
plantación está **eliminada** en el servidor o el usuario está **sin acceso**, el pull
devuelve ese estado sin tocar la copia local, y la corrida saltea el push de grupos,
parcelas y borrados **y la subida y bajada de fotos** de esa plantación: las fotos
locales sin subir quedan en el dispositivo y no se pueden sincronizar. Una eliminada
queda marcada localmente (`plantations.eliminada_en_servidor_en`) y en solo lectura;
la marca se limpia si el servidor vuelve a responder `ok`/`archivada`. Con un server
sin el RPC se cae al chequeo de membresía en `plantation_users`; ante un error de red
se asume acceso.

Descarga datos del servidor y hace upsert en local. Para cada árbol (`upsertTreesFromServerTx`):

- **Foto**: la copia local (`file://`) se conserva si está pendiente de subir, o si el server sigue teniendo la misma foto que la base (sin base, mientras tenga alguna). Si el server la quitó o la reemplazó, la fila toma el path del server. `fotoBase` pasa a ser lo del server.
- **GPS**: el punto local se conserva solo si existe y difiere de la base; si no, se toma el del server. Las bases pasan a ser lo del server.
- **Grupo**: `base_del_servidor` guarda nombre, código, tipo y estado del server.

**Foto quitada o reemplazada desde otro dispositivo (#517, #795):** el pull limpia
la referencia y, cerrados los lotes, borra el archivo local que quedó sin fila
(`fotosLocalesObsoletas`, calculado sobre la misma lectura de árboles locales del
chequeo de conflictos, #449). Una foto con `fotoSynced = false` es la copia que
el server todavía no tiene: no se toca.

Los grupos con `pendingSync = true` no se escriben: gana el cambio local, que el push sube después.

### Paso 2: Borrados, fotos quitadas y parcelas

**Archivo:** `services/sync/pushService.ts`

- `pushBorrados(plantacionId)` manda los borrados anotados por el RPC `sincronizar_borrados` (#467) y las fotos quitadas por `quitar_fotos_arboles` (#498). Cada RPC recibe solo sus tipos.
- `uploadSyncableParcelas(plantacionId)` hace upsert de las parcelas con `pendingSync = true`. Para un técnico el upsert es `ignoreDuplicates` (solo altas, #640). El push confirmado y el pull de una parcela que el server ya tiene limpian `alta_pendiente_de`, la marca local con la que el técnico edita y borra su alta sin subir (#654). Un grupo cuya parcela no subió se reporta como `PARCELA_PENDING`.

### Paso 3: Upload de grupos

**Archivo:** `services/sync/pushService.ts` → `uploadSyncableGroups` → `uploadGroup(sg, sgTrees)`

1. **Para cada árbol con foto cambiada acá (`fotoSinSubir`: local y sin subir):**
   - Sube la foto a Storage en su path versionado (`pathDeFotoEnStorage`)
   - Si éxito: guarda el path en un mapa. `fotoSynced` todavía no se marca (ver punto 4)
   - Si falla: log del error. El árbol irá con `foto_url: null` en el RPC. La foto queda local (`fotoSynced = false`) para retry en la próxima sync.

2. **Construye el payload del RPC:** `foto_url` = el path recién subido, el path remoto que ya tenía, o `null`. Cada árbol lleva sus bases (`species_base_id`, `gps_base`, `foto_base`, de `basesDelArbol`) y el grupo su `base` si el teléfono la conoce.

3. **Llama al RPC `sync_subgroup`** (ver [RPC: sync_subgroup](#rpc-sync_subgroup)). Quitar una foto no va por acá, sino por `quitar_fotos_arboles` (paso 2).

4. **Clasifica la respuesta** con `classifyRpcResult(sg, data, error)`:
   - Éxito: `asentarGrupo` (`services/sync/asentarGrupo.ts`), en una transacción, confirma las bases de lo que viajó, marca `fotoSynced = true` en las fotos subidas y adopta lo que el server devolvió en `conservados`, guardando el valor propio como conflicto (ver [Conflictos de sincronización](#conflictos-de-sincronización-795)). Sin conflictos sin decidir, `markGroupSynced` → `pendingSync = false`. No toca `estado` (#60).
   - Rechazo: el grupo sigue con `pendingSync = true` y el código va al resultado del sync. Las fotos quedan con `fotoSynced = false`: el reintento las resube al mismo path (upsert) y las vuelve a mandar en `foto_url` (#489).

### Paso 4: Retry de fotos pendientes

**Archivo:** `services/sync/photoService.ts` → `uploadPendingPhotos(plantacionId)`

Corre **después** del sync de grupos. Busca árboles con foto local (`file://`) y `fotoSynced = false`: las que fallaron en el paso 3.1.
Para cada una: sube a Storage en su path versionado → `UPDATE trees SET foto_url` en el servidor, solo si sigue teniendo la base (`foto_url = fotoBase`, o null sin base) → `confirmarFotoSubida` marca `fotoSynced` y mueve la base. Si el UPDATE no toca ninguna fila (otro cambió la foto), el grupo vuelve a pendiente y el próximo push la decide por `sync_subgroup`, con conflicto.

### Paso 5: Download de fotos (bidireccional)

**Archivo:** `services/sync/photoService.ts` → `downloadPhotosForPlantation(plantacionId)`

Solo corre con la preferencia "Descargar fotos de otros celulares" prendida (ver [Descarga de fotos y espacio](#descarga-de-fotos-y-espacio-565)).

Busca árboles locales con `fotoUrl` que NO empiece con `file://` (rutas de Storage
descargadas del servidor pero sin archivo local). Para cada uno:
1. Crea signed URL desde Storage (3600s de validez)
2. Descarga a `{Paths.document}/photos/photo_{tree_id}.jpg`
3. Actualiza local: `fotoUrl = file://...`, `fotoSynced = true`, solo si la fila sigue apuntando a ese path (una foto reemplazada o quitada mientras bajaba no se pisa)

---

## Rechazo por plantación finalizada o archivada

Una plantación **finalizada** (#469) solo la escribe un superadmin. Una **archivada** (#477) no la escribe nadie. El server decide con `motivo_no_escribible(id)` (migración 038): devuelve `PLANTACION_ARCHIVADA`, `PLANTACION_FINALIZADA` o `null`, y si aplican las dos gana archivada. Las policies de escritura usan `plantacion_escribible(id)`, que es `motivo_no_escribible(id) IS NULL`.

Lo que el device cargó antes de enterarse **no se pierde**: queda local, pendiente, y se sube cuando la plantación se reabre o desarchiva.

| Paso | Qué devuelve el server | Qué hace la app |
|------|------------------------|-----------------|
| `sync_subgroup` | `{ success: false, error: 'PLANTACION_ARCHIVADA' }` o `'PLANTACION_FINALIZADA'` | `classifyRpcResult` conserva el código y el grupo sigue pendiente. `getErrorMessage` (`services/sync/types.ts`) le dice al usuario que pida desarchivar o reabrir. |
| `sincronizar_borrados` | `rechazados: uuid[]` y `rechazos: [{ id, error }]` | `pushBorrados` limpia solo lo aceptado; los rechazados siguen anotados. `motivosDeRechazo` loguea los motivos. |
| Upsert de parcelas | Error de RLS (`42501`) | `classifyParcelaRpcResult` lo clasifica como `PERMISSION`, no como plantación bloqueada (#511). |
| `UPDATE trees SET foto_url` (paso 4) | 0 filas y sin error: la policy UPDATE no deja ver la fila, o la foto del server ya no es la base | El grupo vuelve a pendiente y el próximo push lo resuelve por `sync_subgroup` (#795). |

Storage no mira el estado de la plantación (#512): las fotos suben aunque después el RPC rechace el grupo. `fotoSynced` recién se marca cuando el RPC acepta (#489).

Un server sin la 038 no manda `rechazos`: `motivosDeRechazo` asume finalizada, el único motivo posible antes de #477.

### Pendientes varados (#638)

Lo que no puede subir hasta que algo cambie en el server se avisa en la tarjeta de la plantación: "N cambios no se pudieron subir", el motivo y un botón **Descartar**.

- **Clasificación única**: `motivoVarado(codigo)` (`services/sync/pendientesVarados.ts`) traduce cada rechazo a `finalizada`, `archivada` o `sin-permiso` (`PERMISSION`, `NOT_AUTHORIZED` de los RPC, `SIN_PERMISO_CREAR`); el resto (red, timeout, conflictos) es transitorio y se reintenta. `SIN_PERMISO_CREAR` es el 42501 o `NOT_AUTHORIZED` de un alta offline. `eliminada` sale de `eliminada_en_servidor_en`.
- **Registro por corrida**: alta, edición, especies, técnicos, pull, parcelas, grupos y borrados anotan sus rechazos y lo aceptado. Al terminar (`conRegistroDeVarados` en los orquestadores y en `pullFromServer`; tareas solapadas comparten el registro y se aplica cuando termina la última), un rechazo permanente guarda el motivo en `plantations.motivo_varado`; sin rechazos, una subida aceptada lo limpia, y un pull con acceso lo alinea al estado que trajo (cerrada → su motivo, abierta → sin motivo). Un técnico aceptado no limpia: el server los asigna también en una finalizada. Solo se limpia un motivo que no depende del estado (sin permiso) si la corrida reintentó todo lo pendiente de esa plantación (la sync global, o la sync de esa plantación); un pull suelto solo limpia finalizada o archivada. Al cerrar sin corte una sync (global, o de una plantación para esa) se limpian los motivos que ya no tienen nada pendiente. El pull marca `alta_en_servidor` en un alta sin terminar que el server ya tiene. Fuera de un registro no se anota nada: el push inmediato de un alta no sabe si la sesión era válida (además corre `ensureServerSession` antes).
- **Aviso**: cuenta lo que de verdad no sube. Las fotos de un grupo pendiente van con el grupo; en una finalizada no cuentan los técnicos ni las fotos de grupos subidos, que el server acepta.
- **Descartar** (`PendientesVaradosRepository.descartarPendientes`): confirma con el detalle por tipo. Un alta que nunca terminó de subir o una eliminada en el servidor se van del dispositivo (`deletePlantationLocally`), con la misma doble confirmación que "Eliminar del dispositivo"; si el insert del alta había subido (marca local `alta_en_servidor`, también en la rama del 23505), la confirmación dice que en el servidor quedó creada. Si no, en una transacción: la edición vuelve al snapshot, las colas de especies y técnicos se deshacen, se borran los grupos pendientes con sus árboles, las parcelas pendientes sin grupos, los borrados anotados y las fotos sin subir. Un grupo ya subido que volvió a pendiente también se quita y vuelve con el pull (sin membresía, recién al recuperarla); los grupos sin cambios se quedan. Una parcela pendiente con grupos subidos deja de estar pendiente y el pull la pisa. En una finalizada se conservan técnicos y fotos. Nada se descarta solo: si la plantación se reabre o desarchiva, lo pendiente sube en la próxima sync.

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

## Resolución de N/N y cambio de especie

### Flujo local

**Archivo:** `TreeRepository.ts` → `cambiarEspecie(treeId, especieId)`

Lo usan la resolución de N/N (`useNNResolution.ts`) y «Cambiar especie» del detalle del árbol (#679).

1. Busca el código de la especie seleccionada
2. Regenera el `subId` con el nuevo código de especie
3. `UPDATE trees SET especieId, subId` — **NO toca fotoUrl, fotoSynced ni especieBaseId**
4. `markGroupPendingSync(grupoId)` → `pendingSync = true`

### Re-sync después de resolución

Cuando el usuario sincroniza después de resolver N/N:

1. **Pull:** descarga estado actual del servidor; no toca los árboles del grupo pendiente
2. **Push:** `getSyncableGroups` devuelve el grupo (`pendingSync = true`)
   - `uploadGroup` envía `species_id` = especie resuelta y `species_base_id` = `especieBaseId`
   - `foto_url` = storage path (ya existente) o null
   - RPC actualiza `species_id` y `sub_id` en el servidor, salvo que ya tenga una especie distinta de la base
   - `COALESCE(EXCLUDED.foto_url, trees.foto_url)` preserva foto existente
3. **asentarGrupo:** si el server conservó su especie, el árbol la adopta (especie, base y SubID con los códigos locales) y la propia queda como conflicto. En el resto, `especieBaseId` = la especie que viajó. Un error en este paso deja el grupo pendiente, sin reportarlo como error de red
4. **markGroupSynced:** `pendingSync = false`, salvo que queden conflictos sin decidir

### Resolución cross-device

**Escenario:** User A crea N/N en device A. User B descarga y resuelve en device B.

1. Device B descarga plantación → árbol tiene `especieId = null`, foto descargada
2. User B resuelve N/N → `cambiarEspecie` cambia `especieId`, marca `pendingSync = true`
3. User B sincroniza:
   - `getSyncableGroups` devuelve el grupo (no filtra por userId ni estado)
   - RPC actualiza `species_id` y `sub_id` en el servidor si User B es miembro y la plantación es escribible

### Conflictos de resolución

**Escenario:** User A resuelve como Especie X, User B resuelve como Especie Y. Gana el server (#679, #795).

1. User A sincroniza → servidor tiene `species_id = X`
2. User B sincroniza: el push manda Y con su base (N/N), el server conserva X y lo devuelve en `conservados`
3. El árbol de B pasa a X, Y queda como conflicto y el resumen de la sync avisa cuántos datos esperan que B elija

Un árbol que B no cambió (especie = base) también vuelve en `conservados` y adopta X, sin conflicto: si el grupo llega pendiente a cada sync, el pull nunca se lo baja.

---

## Conflictos de sincronización (#795)

Dos personas editan el mismo grupo o árbol sin sincronizar entre medio. Cubre la
especie, el GPS (latitud, longitud, precisión y momento de captura, como una
unidad), la foto y los datos del grupo (nombre, código, tipo y estado).

- **Bases:** el push manda, por campo, lo último que el teléfono vio en el server.
  El server aplica el valor si todavía tiene esa base; si no, conserva el suyo y
  lo devuelve en `conservados: { grupo: {campo: valor}, arboles: [{id, species_id?, foto_url?, gps?}] }`.
  Sin base (APK vieja) pisa como antes.
- **Gana el server:** `asentarGrupo` adopta el valor del server y guarda el propio
  en `conflictos_de_sync` (`ConflictosDeSyncRepository`), uno por entidad y campo.
  Una foto perdedora queda como archivo local del conflicto.
- **El resto sube igual:** los demás campos y árboles del grupo se aplican. El
  grupo queda `pendingSync = true` mientras haya conflictos sin decidir; el push
  siguiente manda los valores del server con base = server, sin efecto.
- **Resolver** (`services/ConflictosDeSyncService.ts`): `conservarLaMia` reaplica
  el valor propio con la edición normal (la base queda en el valor del server, así
  que el próximo push lo pisa) y quita el conflicto. `descartarConflicto` lo quita
  y borra su foto. Un árbol o grupo que ya no existe, o una especie N/N o borrada,
  no se puede reaplicar.
- Borrar un árbol, un grupo o la plantación, o descartar pendientes varados, se
  lleva sus conflictos y sus archivos.
- **Pantalla** (#804): la misma `ResolverCambiosScreen` de #634 suma una sección
  por grupo y por árbol, con lo del teléfono contra lo del servidor y la opción
  propia marcada. "Guardar elección" aplica `conservarLaMia` o `descartarConflicto`
  a cada uno (`ConflictosParaResolverService`). Si lo propio no se puede conservar
  (plantación no editable, sin permiso, árbol o grupo borrado, especie que ya no
  está, punto incompleto, nombre o código de grupo repetido),
  `motivoParaNoConservar` lo dice antes y la opción queda deshabilitada;
  `conservarLaMia` aplica los mismos rechazos (un test de integración los compara
  caso por caso).
- Cada elección lleva el `detectadoEn` que vio el usuario. Si un pull reemplazó el
  conflicto mientras elegía, no se aplica: la tarjeta vuelve con "Cambió de nuevo"
  y la elección arranca otra vez. Un conflicto que ya no está cuenta como resuelto.
- Las fotos del servidor se bajan solas al mostrarse, de a `FOTOS_EN_PARALELO`.
- **Avisos:** el resumen de la sync suma los conflictos sin resolver de las
  plantaciones sincronizadas al aviso de "Cambios por resolver", la tarjeta de la
  plantación muestra la marca y la pantalla del grupo avisa arriba y marca cada
  árbol afectado.
- Descartar el último conflicto deja el grupo pendiente hasta el próximo push, que
  no cambia nada y lo marca sincronizado. Marcarlo antes no es seguro: un grupo
  pendiente puede tener otros cambios sin subir y la marca no los distingue.

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
| `startBidirectionalSync` | Sync individual (desde hook con plantacionId fijo) | syncPlantation → uploadPendingPhotos → downloadPhotos (si `descargarFotos`) |
| `startPlantationSync` | Sync de una plantación (desde gear icon) | Igual que bidirectional pero con plantacionId explícito |
| `startGlobalSync` | Sync global (botón de sync general) | syncAllPlantations (pull+push+fotos por plantación) |

### SyncConfirmModal

Muestra el checkbox "Descargar fotos de otros celulares" (`descargarFotos`), que es la misma preferencia de Ajustes. Las fotos sacadas en este celular se suben siempre; desmarcarlo solo saltea la bajada.

### Descarga de fotos y espacio (#565)

- **Preferencia** (`services/settings/descargaDeFotosStore.ts`), prendida por defecto. Hereda el valor del viejo "Incluir fotos" (`sync_include_photos`): quien lo tenía apagado queda sin descarga.
- **Liberar espacio** (Ajustes, `services/LiberarEspacioService.ts`): borra del celular las fotos descargadas (`fotoSynced = true`, `file://`) cuyo path confirma el server, y deja cada fila apuntando a Storage. Nunca toca fotos sin subir ni escribe en el server o en `borrados_pendientes`. Sin conexión no borra nada. Con la descarga prendida, la próxima sync las vuelve a bajar.
- **Foto sin descargar** (`components/FotoRemota.tsx`): un árbol con `fotoUrl` de Storage muestra un aviso con "Descargar" en el detalle del árbol, el visor y la resolución de N/N, y una nube en la fila. Baja esa sola foto con `descargarFotoRemota`.

### SyncProgressModal

Muestra resultados separados:
- `uploadFailed`: fotos que no pudieron subirse a Storage
- `downloadFailed`: fotos que no pudieron descargarse de Storage
- Antes estaban combinados en un solo `failed`, mostrando "no pudieron subirse" para fallas de descarga
- En la sync global, lista por nombre las plantaciones salteadas por estar eliminadas en el servidor o sin acceso (`omitidas`)

---

## RPC: sync_subgroup

**Archivos:** `supabase/migrations/064_partir_sync_subgroup.sql` (los pasos), `065_cambiar_especie_arbol.sql` (los pasos de la especie), `066_sync_subgroup_no_escribe_ajeno.sql` (redefine el rechazo, el grupo y los árboles), `072_grupo_ajeno_solo_admin.sql` (el rechazo de un grupo ajeno) y `075_conflictos_de_sincronizacion.sql` (la orquestadora y las bases de grupo, foto y GPS)

`sync_subgroup` es una orquestadora: cada paso es una función propia, que solo
ella (y service_role) ejecuta. Un cambio en un paso redefine solo esa función.

```sql
-- sync_subgroup_conservar_grupo
-- 0. Con `base` en el grupo: fila FOR UPDATE; cada campo (nombre, codigo, tipo,
--    estado) que en el server difiere de la base sigue con el del server
-- sync_subgroup_rechazo            (1-3, el primero que aplique; no escribe nada)
-- 1. Sin fila en plantation_users para auth.uid()     → PERMISSION
-- 2. motivo_no_escribible(plantation_id) no null      → PLANTACION_ARCHIVADA | PLANTACION_FINALIZADA
-- 3. El grupo ya existe en otra plantación o parcela,
--    o la parcela es de otra plantación               → REFERENCIA_AJENA
--    Grupo ajeno y quien sube no es admin             → PERMISSION
--    Otro grupo con el mismo código en la parcela     → DUPLICATE_CODE
--    Otro grupo con el mismo nombre en la parcela     → DUPLICATE_NAME
-- sync_subgroup_upsert_grupo
-- 4. INSERT groups ON CONFLICT (id) DO UPDATE SET estado, codigo, nombre, tipo
--    solo si plantación y parcela coinciden; si no, excepción (UNKNOWN)
-- sync_subgroup_codigo_parcela
-- 5. Código vigente de la parcela, con la fila FOR SHARE
-- sync_subgroup_conservar_especies
-- 6. Árboles FOR UPDATE; donde el server tiene una especie distinta de
--    species_base_id, el payload sigue con la del server
-- sync_subgroup_conservar_fotos_y_gps
-- 7. Donde foto_url difiere de foto_base, o el punto (lat, lon, captura) de
--    gps_base, el payload sigue con el del server
-- sync_subgroup_anotar_fotos_descartadas
-- 8. La foto subida que no entró y la que quedó reemplazada van a fotos_quitadas
-- sync_subgroup_upsert_arboles
-- 9. Un árbol de otro grupo (por su group_id o el que ya tiene) → excepción (UNKNOWN)
--    INSERT trees ON CONFLICT (id) DO UPDATE, solo sobre árboles del grupo:
--    species_id, sub_id                                   -- resolución N/N
--    sub_id que empieza con parcela_codigo + codigo       -- pasa a parcela y grupo vigentes
--    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url) -- no borra foto existente
--    plantacion_id, global_id y GPS también con COALESCE
-- sync_subgroup_habilitar_especies
-- 10. Re-habilita en plantation_species la especie de los árboles que suben
-- sync_subgroup_conservadas / sync_subgroup_conservados
-- 11. Lo que quedó distinto de lo que mandó el móvil
-- Cualquier excepción                                  → UNKNOWN, sin nada escrito
```

Los locks se toman en ese orden: grupo → parcela → árboles →
`plantation_species`. Otra escritura que tome más de uno tiene que seguirlo.

Un campo sin su base (`base`, `species_base_id`, `foto_base`, `gps_base`) se pisa
como antes de 065 y 075: así sigue funcionando un APK que no las manda.

Respuesta: `{ success: true, conservadas, conservados }` o `{ success: false, error }`.
`conservadas` (`[{ id, species_id }]`) queda para el APK anterior a 075.
`conservados` es `{ grupo: { campo: valor }, arboles: [{ id, species_id?, foto_url?, gps? }] }`:
lo que el server conservó y difiere de lo que mandó el móvil, aunque el móvil no lo
haya cambiado (una copia vieja). `gps` trae `latitude`, `longitude`, `gps_accuracy` y `gps_captured_at`.

La foto se sube a un path por subida (`trees/<id>-<versión>.jpg`): `foto_url` es
la base, y una subida nunca pisa el archivo que el server conserva.

### SECURITY DEFINER

El RPC corre como `postgres`, sin RLS: por eso valida membresía y estado de la plantación antes de escribir, y que el grupo, su parcela y cada árbol sean de esa plantación y ese grupo (#732). Un cliente legítimo nunca dispara `REFERENCIA_AJENA` ni la excepción de los árboles: un árbol no cambia de grupo ni un grupo de plantación o parcela. Por eso la app no tiene un código propio para eso y lo trata como `UNKNOWN`.

### Policies relevantes (escrituras directas, fuera del RPC)

Exigen membresía (`is_plantation_member`) y `plantacion_escribible` (037). El UPDATE
de parcelas —que incluye el tombstone— además exige `is_admin()` (056, #640):

| Policy | Tabla | Operación |
|--------|-------|-----------|
| "Plantation members can insert trees" | trees | INSERT |
| "Plantation members can update trees" | trees | UPDATE |
| "Plantation members can insert parcelas" | parcelas | INSERT |
| "Admins can update parcelas" | parcelas | UPDATE |

---

## Columnas de la tabla trees (relevantes a fotos y N/N)

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| `especie_id` | text | sí | UUID de especie. `null` = N/N sin resolver |
| `foto_url` | text | sí | Ruta de Storage o `file://` local. `null` = sin foto |
| `foto_synced` | integer | no | `0` = foto local pendiente de upload. `1` = foto en Storage |
| `especie_base_id` | text | sí | Especie del servidor la última vez que se vio el árbol; el push la manda como base (#679) |

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
