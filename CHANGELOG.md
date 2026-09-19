# Changelog

Registro técnico de cada release a producción, basado en
[Keep a Changelog](https://keepachangelog.com/es-AR/1.1.0/). La versión para
usuarios y clientes es [NOVEDADES.md](NOVEDADES.md).

Los headers de las entradas son anclas de `.github/workflows/release-tags.yml`,
que extrae de acá las notas de cada GitHub Release: no cambiar su formato. El
contrato completo (entrada de release, sección pendiente de staging y su
conversión) está en `.claude/skills/deploy/SKILL.md` ("Contrato de formato").

## 2026-09-19 · web 1.3.0 · mobile 1.2.0

### Web 1.3.0

#### Agregado
- Archivar y desarchivar plantaciones: filtro Archivadas, acciones en «⋯ Más acciones» con `ArchivadoModal`, badge y aviso en el detalle, Editar/Generar IDs/Configuración deshabilitados; búsqueda global, sugerencias y Temporada activa excluyen archivadas (#492)
- Eliminar plantaciones: acción en «⋯ Más acciones», `EliminarPlantacionModal` con cuatro variantes según el preview (sin datos, solo superadmin, archivar primero, confirmar nombre), aviso de fotos pendientes y "Reintentar limpieza de fotos" para superadmin; `services/edgeFunction` compartido con `adminUsersService` (#525, #542)
- Eliminar usuarios (superadmin): acción en el menú ⋯ y en el panel, `EliminarUsuarioModal` con preview, filtro Eliminados, badge Eliminado y panel de solo lectura para eliminados; `ConfirmarModal` suma `aviso` y `deshabilitada` (#503)
- `ErrorBoundary` en el `<Outlet />` del layout, en las tabs del detalle de plantación y en cada panel del dashboard, con `ErrorConReintento` como fallback (#562)
- Rediseño de teléfono (≤600 px): la navegación se fija al pie (`BarraLateral` extraída de `AppLayout`, token `--alto-nav-inferior`), el disparador de ⌘K queda como lupa, el alta de los listados queda en el "+" junto al título, y los filtros de las cuatro barras entran en un `Modal posicion="hoja"` con focus trap, contador de activos, "Ver N …" y "Limpiar" (`contarFiltrosActivos` compartido por `useFiltrosListado` y `filtrosUrl`) (#574, #575, #576, #579)

#### Cambiado
- La identidad del `UserMenu` es el botón de cerrar sesión y abre `ConfirmarModal` "¿Cerrar sesión?"; se retira el `BotonIcono` de `LogOut`; a ≤600 px nombre, rol y "Novedades ·" se ocultan solo a la vista con `soloLectoresEnMovil` (#572)
- `ConfirmarModal`, `useConfirmacion`, `ErrorEnvio` y `AccionesModal` pasan de `screens/usuarios` a `components`/`hooks`; componente `Aviso` nuevo (#492)
- `entradasVisibles` quita los pasos de todos los ítems fuera del entorno de pruebas; `/deploy` conserva los pasos tal cual al convertir la sección pendiente y `NOVEDADES.md` recupera los de 1.2.0 (#581, #583)

#### Corregido
- Las búsquedas de Plantaciones, Especies, Usuarios y las listas de ⌘K ignoran tildes con `coincideBusqueda` (#560)
- `clasificarError`/`mensajeDeError` distinguen red, permiso y rechazo del server en los formularios; los repositorios relanzan con `errorDeSupabase` conservando `code` (#561)
- `CardTabla` pinta un degradado en el borde con contenido fuera de vista (`useIndicioDesborde`) y el subtítulo de `CabeceraConfig` envuelve a ≤600 px en vez de truncarse (#563)
- `borrarPlantacionHuerfana` borra de verdad vía `eliminar_plantacion`; antes era un no-op sin policy DELETE (#525)
- Mensaje propio cuando `generate_tree_ids` rechaza una plantación archivada (#507)

### Mobile 1.2.0 (versionCode 3)

#### Agregado
- Plantación archivada: columna local `archivada_en` (drizzle 0022), `esArchivada`, banner "Plantación archivada", edición bloqueada, catálogo sin archivadas y `SYNC_ERROR.PLANTACION_ARCHIVADA` con mensaje propio (#492)
- Plantación eliminada en el servidor: `accesoRemoto` consulta `estado_remoto_plantaciones`, `PULL_ESTADO.eliminada`, columna local `eliminada_en_servidor_en` (drizzle 0023), badge y banner, la sync individual y la global informan eliminadas y sin acceso (`PlantacionesOmitidasAviso`); `useEliminarDelDispositivo` cuenta grupos, parcelas, fotos y borrados y funciona fuera del catálogo (#525, #539, #529)

#### Corregido
- Finalizar plantación exige cero fotos, parcelas y borrados pendientes; el bottom sheet detalla qué falta (#540)
- Guardar especies y asignar técnicos usan los RPC atómicos de la 049, con fallback al chequeo previo de escribible y mensaje por motivo (eliminada, archivada, finalizada); los técnicos inactivos conservan su asignación (#549, #541)
- Las fotos de un grupo se marcan sincronizadas recién cuando el servidor confirma el grupo; un update sin filas afectadas cuenta como fallo; una excepción al subir una foto no corta la tanda (#493, #485, #505)
- Quitar la foto de un árbol sincronizado se propaga al servidor (`quitar_fotos_arboles`) y el pull limpia la foto local cuando otro dispositivo la quitó (#524, #564)
- Eliminar una plantación del dispositivo, borrar árboles o grupos y reemplazar o quitar una foto borran los archivos locales; `borrarFotosLocales` solo toca archivos sueltos de la carpeta de fotos (#488, #501, #528)
- Un rechazo al subir una parcela se informa como `PLANTACION_FINALIZADA`/`PLANTACION_ARCHIVADA` según el estado local en vez de `PERMISSION`, y la violación de FK (23503) como `REFERENCIA_INEXISTENTE` con mensaje propio (#530, #487)
- Nuevo grupo se bloquea con aviso si la plantación está finalizada, archivada o eliminada (`usePlantacionEditable`) (#504)
- Tildes, ñ y signos de apertura en los textos visibles, y `SyncProgressModal` partido en componentes con plurales correctos (#552, #536)

#### Cambiado
- Predicados `esActiva`/`esFinalizada` y constantes de estado en filtros, `StatusChip` y repositorio; se eliminan `PlantationConfigCard`, `createPlantation` online y `handleDeletePlantation`, sin usos (#500, #526, #557, #531)

### Otros
- Migración 038 `plantacion_archivada`: `archivada_en`/`archivada_por`, `motivo_no_escribible()` como fuente única de `plantacion_escribible()`, RPCs `archivar_plantacion`/`desarchivar_plantacion`, `sincronizar_borrados` con `rechazos` (#492)
- Migración 039 `eliminar_plantacion`: tabla `plantaciones_eliminadas`, RPCs `eliminar_plantacion`, `previsualizar_eliminacion_plantacion` y `estado_remoto_plantaciones`; edge function `admin-plantaciones` (`eliminar` con borrado de fotos en tandas, `limpiarFotos`) (#525, #542)
- Migración 040 `profiles_eliminado`: `eliminado_en` protegido por `protect_profile_fields`; `admin-users` suma `previsualizarEliminacion` y `eliminar` (real sin datos, lógico con datos) y rechaza acciones sobre eliminados (#503, #514)
- Migraciones 041 y 046: borrar fotos en Storage exige membresía; subir o reemplazar exige plantación escribible (#486, #538)
- Migración 042: `generate_tree_ids` exige admin activo de la organización, rechaza archivadas y bloquea la fila con `FOR SHARE` (#507)
- Migraciones 043 y 045: `is_admin()`, `is_plantation_member()` e `is_superadmin()` exigen perfil activo; las policies de admin pasan a los helpers y `sync_subgroup` rechaza con `PERMISSION` a un miembro inactivo (#509, #533)
- Migración 044: RPC `quitar_fotos_arboles`, con rechazo si la plantación no es escribible (#524)
- Migraciones 047 y 048: `plantation_users` exige `plantacion_admite_asignaciones`; las escrituras de admin en `plantations`, `plantation_species`, `plantation_users` y `profiles` exigen la organización del que escribe (#541, #547)
- Migración 049: RPCs `reemplazar_especies_plantacion` y `reemplazar_tecnicos_plantacion`, borrado e inserción en una transacción (#549)
- `/novedades` lee la marca solo dentro de la sección pendiente; `/deploy` exige drift check contra prod antes de aplicar migraciones (#553, #554)
- `npm run lint` de web incluye `prettier --check`; `admin-users` formateado con la misma config; `web/.env.example`, README y `.nvmrc` = 22 (#551, #514, #555)
- Docs: `SPECS.md` §4.17 con la generación de IDs server-side; README de functions con `WEB_URL` por entorno y checklist de cutover; `visibilidad-plantaciones.md` al RLS vigente; docs de sync con el rechazo por finalizada/archivada; `docs/responsive-web.md` con los patrones de teléfono y la vista `modal-filtros` en la auditoría (#535, #556, #558, #515, #577)

## 2026-09-16 · web 1.2.0 · mobile 1.1.0

### Web 1.2.0

#### Agregado
- Pantalla `/novedades` con `NOVEDADES.md` horneado, versión + dot de no visto en el sidebar y acción en ⌘K (#335)
- Filtro del dashboard por parcela, con todas las parcelas en la tira (#332)
- Sección "En pruebas" en `/novedades`, solo en entorno de pruebas, y skill `/novedades` (#376, #415)
- Teclas Inicio/Fin en ⌘K y en el selector de técnico (#402)
- Toggle "Foto en todos los botones" en Configuración → "Comportamiento en la app", sobre un hook genérico de toggles de plantación que también usa la visibilidad (#440)

#### Cambiado
- Rediseño del detalle de plantación: cabecera única, menú Exportar, % por especie, riel de parcelas y Configuración reorganizada (#344, #358, #363, #365, #371, #420, #435)
- Detalle de árbol en panel lateral en lugar de modal (#350, #420)
- Especies y Usuarios con panel lateral; filtro de uso y orden, búsqueda y columna Alta (#348, #363, #408, #420, #424, #432)
- Listado de Plantaciones con toolbar compacta, búsqueda y filtro de temporada; se quita el filtro por fecha de creación (#352, #363, #424)
- Árboles: Grupo y Foto como filtros; se quitan los chips de alcance y el recuento de la toolbar (#356, #425)
- Selector de técnico con email y buscador, sin "Rol en plantación" (#374, #402)
- Capa responsive ≤900/≤600 px: topbar compacta, acciones del detalle en menú «⋯», columnas `fueraEnMovil`, `--page-pad-x` fluido y modales a ancho completo (#361, #363, #365, #367)
- El rol admin se muestra como "Administrador" en Usuarios, selectores de rol y Configuración; ⌘K muestra la etiqueta del rol en vez del valor crudo (#432)

#### Corregido
- Plantaciones vacías al loguear: `CommandMenuProvider` pasa a `AppLayout` y deja de cachear `[]` como anon (#341)
- La cache de queries se descarta al cambiar de usuario o cerrar sesión (#342)
- "Asignar técnico" ya no ofrece admins ni permite asignar un técnico como Admin (#374)
- `admin-users` mapea el rate limit de Auth a 429 accionable al crear y reenviar invitaciones (#330)
- GPS: la frecuencia exacta se persiste al blur/Enter (#311)
- El logo del sidebar ya no se estira (#329)
- CSV/Excel omiten el nombre de parcelas eliminadas (#311)
- ⌘K: las acciones se encuentran sin tildes (#402)
- ⌘K sin texto: un solo encabezado (Recientes o Sugerencias), spinner mientras carga y aviso neutro si no hay nada (#423)
- Recuentos en singular con una unidad y con separador de miles (`SUSTANTIVO`, `pluralizar`/`concordar`) (#424, #435)
- Invalidaciones faltantes: editar una especie refresca catálogo, dashboard, mapa y Árboles; asignar un técnico, Usuarios; editar, dar de alta o desactivar a una persona, los perfiles (#408)
- Un perfil sin nombre se muestra con su id corto en el sidebar, Árboles y ⌘K (#432)
- Árboles: `?parcela=` de otra plantación o `?gps=`/`?foto=` desconocidos en la URL ya no dejan un filtro fantasma (#425)

### Mobile 1.1.0 (versionCode 2)

#### Agregado
- Revocación de acceso: el pull chequea la membresía antes del replace, devuelve "sin acceso", conserva los datos locales y saltea el push (#318, #334)
- Con "Foto en todos los botones" activo, cada especie pide foto antes de registrar con la misma política que N/N; la obligatoriedad para identificados es `PHOTO_CAPTURE_REQUIRED_DEFAULT` con contrato en `contracts/photo-defaults.json` (#440)
- Aviso de OTA descargado con botón "Reiniciar" que decide el usuario, bloqueado mientras corre una sincronización o una descarga; la detección usa `useSyncExternalStore` sobre `addUpdatesStateChangeListener`, porque `useUpdates` perdía el update que terminaba entre el render y la suscripción (#454, #461)
- Tira deslizable con todos los árboles del grupo y árbol seleccionado: el tacho y la captura de GPS actúan sobre el chip elegido, con auto-scroll al final al registrar (#462)
- Velocidad de transferencia en el progreso de fotos ("12 de 40 fotos · ~180 KB/s"), promediada al completar cada foto con los bytes que ya se materializaban (#466)
- Timeouts en el cliente inyectados una vez en `createClient` —30s por request, 120s por transferencia— y watchdog que a los 45s sin señal de avance ofrece "Cancelar sincronizacion"; se cronometra el estancamiento, no la duración, y nunca cancela solo (#465)

#### Cambiado
- Alta de plantación local-first en una transacción, con push inmediato best-effort; se retiran el rollback remoto y la migración 031 (#313, #320)
- Ajustes y Perfil con `CustomHeader` y safe-area (#337)
- La barra de registro unifica sus dos filas: "Precisión actual" con el semáforo fijo a la izquierda y el botón Capturar/Recapturar con la precisión del árbol a la derecha; se retiran `LastThreeTrees` y `LastTreeGpsRow` (#462)
- El sync informa la fase del pull con contador y barra, las fotos del push y del sync global emiten progreso, y `pushing` arranca con su primer progreso en vez de taparle el cartel al pull (#456)
- Pull en lotes de 500 con upsert multi-fila, conflicto de especie resuelto con una lectura en memoria, índices de sync (migración 0020) y fotos con pool de 3 (#463)
- El inset de la status bar lo aplica una sola franja según `ocupanteDelInsetSuperior` (entorno → aviso → header), en lugar del ternario contra `ES_ENTORNO_DE_PRUEBAS` dentro de `CustomHeader` (#454)
- Una plantación finalizada es inmutable desde la app: se ocultan editar la plantación y los borrados de grupo y parcela, `getGroupGating` y `getTreeEditGating` miran el estado de la plantación, y el push rechazado avisa que lo cargado sigue en el dispositivo (#471)

#### Corregido
- El KML omite el nombre de parcelas eliminadas (#331)
- Una foto cuya descarga se interrumpió ya no falla para siempre: `downloadFileAsync` con `{ idempotent: true }` (#455)
- Las transacciones eran un no-op (`db.transaction` de expo-sqlite es síncrona): `enTransaccion`/`enTransaccionPorLotes` sobre `withTransactionAsync`, serializadas por cola, con `.transaction()` prohibido por eslint en `src/` (#457)
- Una plantación nueva cuya descarga falla se revierte, en vez de quedar en el listado vacía y marcada como descargada (#457)
- El contador de grupos llega a "N de N" al terminar el push (#456)
- Los borrados de árboles y grupos se propagan al server por el RPC `sincronizar_borrados`, con cola local `borrados_pendientes`: antes el pull los resucitaba y dejaba dos árboles con el mismo SubID (#468)

### Otros
- Migración 030: hardening, índices y NOT NULL; suite pgTAP y re-baseline 001–029 (#313)
- Migración 032: reglas de negocio en SQL, contratos compartidos `contracts/*.json`, "Generar IDs" vía RPC (#316)
- Migraciones 033 y 034: SELECT y storage por membresía y organización; admin y superadmin leen las plantaciones de su organización, lo que permite el alta con RETURNING (#318, #383)
- Migración 035 `plantations.photo_capture_all_trees` (solo web, el pull siempre toma el valor del server) con test pgTAP, y migración local 0019 (#440)
- Migración 036 `sincronizar_borrados` con test pgTAP, y migración local 0021 `borrados_pendientes` (#468)
- Migración 037: `puede_editar_finalizada` y `plantacion_escribible`, las policies de escritura reescritas sobre esos helpers, y `sync_subgroup` con error propio `PLANTACION_FINALIZADA` (#471)
- Franja "Entorno de pruebas" con versión y commit en la web de pruebas y Bayka TEST, con el commit calculado en un script compartido por web y mobile; en prod no se genera (#290, #322, #346, #399)
- El build web falla si la URL y la anon key de Supabase no son coherentes (#270)
- Modo demo `npm run dev:demo` sin backend: el cliente falso resuelve embebidos, filtros, `.or()` y `limit`/`range`, con árboles de muestra en todas las plantaciones y conteos por parcela (#354, #399, #406, #418)
- Auditoría de código: comentarios concisos, estilos a `.styles.ts`, deduplicación y tests (#311, #327)
- `NOVEDADES.md` público y `/deploy` que genera los dos changelogs (#280)
- CR de optimización: claves de query y rutas centralizadas, tokens y CSS compartido, listados, detalle, ⌘K y Usuarios en funciones de ≤20 líneas, y tests frágiles corregidos (#396, #398, #417, #420, #422, #424, #425, #427, #432, #433, #436, #437)
- Auditoría responsive `npm run audit:responsive` en módulos, con el detalle de lo que empeora, la métrica de texto que se sale de su caja y `/novedades` con los pasos desplegados (#407, #415, #419)
- CI: ESLint de mobile, lint de los scripts de la raíz y de la auditoría, y `prettier --check` en web (#404, #411, #414, #419, #436, #437)
- Los APK locales graban el canal de EAS Update (`test` / `production`) en `updates.requestHeaders`, y `build-apk.sh` corta si falta `EAS_PROJECT_ID` (#441)
- README con la sección "APK Android": variantes prod y test, requisitos, build local y publicación de OTA (#443)
- `app.config.js` corta con error si la variante TEST no encuentra `mobile/.env.staging`, en vez de salir apuntando a Supabase de producción en silencio (#445)
- `eas.json`: el profile `production` apunta al Supabase de producción actual, y `development` y `preview` pasan a staging (#473)
- Spike de pull incremental con watermark en `docs/decisiones/pull-incremental.md`: no hacen falta tombstones porque nadie borra `trees` ni `groups` en el server; el bloqueo real es otro (#464)

## 2026-09-01 · web 1.1.0

### Web 1.1.0

#### Agregado
- Ojito para ver la contraseña en login y formularios de password (#266)

#### Corregido
- `_redirects` para SPA fallback en Cloudflare Pages

### Otros
- Variante TEST de la app mobile: build local por variante, ícono con "TEST" e
  instalable junto a la de producción, apuntando a staging (#253)
- Keep-alive periódico de la API de Supabase (staging y prod) para evitar la
  pausa por inactividad del free tier (#284)
- Sistema de releases: versionado por app, CHANGELOG, skill `/deploy` y workflow de tags (#273)
- Flujo de branches staging→main, saneamiento de artefactos y trazabilidad en el board

## 2026-08-20 · web 1.0.0 · mobile 1.0.0

Baseline del sistema de versionado (#273): ambas apps arrancan en 1.0.0 sobre
el estado de producción vigente.

### Web 1.0.0

- Versión inicial versionada: gestión web (Vite + React) en Cloudflare Pages.

### Mobile 1.0.0 (versionCode 1)

- Versión inicial versionada: app Android (Expo), distribución por APK local.
