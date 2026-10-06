# Changelog

Registro técnico de cada release a producción, basado en
[Keep a Changelog](https://keepachangelog.com/es-AR/1.1.0/). La versión para
usuarios y clientes es [NOVEDADES.md](NOVEDADES.md).

Los headers de las entradas son anclas de `.github/workflows/release-tags.yml`,
que extrae de acá las notas de cada GitHub Release: no cambiar su formato. El
contrato completo (entrada de release, sección pendiente de staging y su
conversión) está en `.claude/skills/deploy/SKILL.md` ("Contrato de formato").

## Sin publicar
<!-- sincronizado-hasta: 72ae4ca #776 -->

### Web

#### Agregado
- Código de plantación: campo "Código *" en `PlantacionFormModal` (mayúsculas sin espacios al tipear, `maxLength` 8, formato de `contracts/codigo-plantacion.json`, deshabilitado fuera de activa con `codigoEsEditable`), `CodigoPlantacionDuplicadoError` desde 23505 al crear y `CODIGO_DUPLICADO` al editar, columna Código en el listado y el código en la línea de metadatos del detalle (#699, #764)
- ID Árbol (`<SubID>-<código>`, `idDeArbol`): reemplaza la columna SubID de Datos → Árboles y titula `ArbolDetallePanel`; la búsqueda de árboles de ⌘K y de Datos acepta el ID completo (`separarIdArbol` + `resolverBusquedaArbol`, códigos cacheados 5 min y reiniciados al cambiar de usuario o guardar una plantación; Datos pasa a `plantations!inner(codigo)`) (#699, #717)
- Cambiar la especie de un árbol desde su panel en Datos: «Cambiar» en `BloqueEspecie` con `SelectConDetalle`, por la RPC `cambiar_especie_arbol` con la especie base; ante `CONFLICTO_EDICION` el panel muestra la especie vigente del server. Lo ofrece `puedeCambiarEspecie`: admin con la plantación activa, superadmin también en finalizada, nadie en archivada (#731)
- Tipo y subtipo de especie: tipo fijo «Flora» y subtipo Árbol/Arbusto obligatorio (`SegmentedControl`) en `EspeciePanel`, columna Subtipo (oculta con el panel abierto) y filtro «Subtipo» en el listado; contrato `contracts/tipos-especie.json` espejado en `shared/tiposEspecie.ts` (#775)
- Especies científicas: pestañas Comunes/Científicas (`/especies/cientificas`), listado con los nombres comunes que agrupa cada una, filtro Todas/Con especies/Sin especies y atenuadas las que no agrupan; `EspecieCientificaPanel` crea, renombra y elimina (deshabilitado mientras agrupe especies); ⌘K las busca (#776)
- Edición de la plantación por campo con conflictos: el formulario, la config GPS y los toggles de visibilidad y foto van por la RPC `editar_plantacion` con solo lo que cambió y la base con que se abrieron; ante un conflicto el campo toma el valor del server como base nueva y el resto se guarda (`repositories/edicionDePlantacion.ts`, `ConflictoDeEdicionError`) (#648)
- Botón «Descargar» bajo la foto en `ArbolDetallePanel`: URL firmada con `download` (`obtenerUrlDescargaFoto`, `descargarDesdeUrl`) y nombre `foto-<lugar>-<periodo>-<subId>.jpg` (`nombreArchivoFoto`); el demo firma una foto de muestra (#726)

#### Cambiado
- Excel y CSV suman `ID Árbol` como primera columna (`contracts/export-columns.json`); el KML nombra cada placemark con el ID Árbol y describe SubID y especie, en vez de nombre y código de la especie (#703, #721)
- El nombre científico de una especie se elige de la lista de científicas (`SelectorEspecieCientifica`, con «Sin especie científica») en vez de escribirse como texto libre (#776)
- Especies de la plantación por altas y bajas: el toggle y "marcar/desmarcar todas" van por `aplicar_cambios_especies` en vez de `reemplazar_especies_plantacion` y no pisan los cambios de un teléfono en otras especies; especies y checklist se ordenan por nombre (`lib/ordenEspecies.ts`, sin `ordenVisual`), el pie dice "En la app se ordenan por nombre" y el error muestra el motivo del server (`ESPECIE_CON_ARBOLES`, finalizada, archivada…) (#650, #642)
- Dashboard y explorador cuentan en el server (`dashboard_arboles`, `arboles_por_grupo`) en vez de bajar todos los árboles; `leerPaginado` pide la primera página sola y el resto de a 4 en paralelo; Leaflet pasa a un chunk lazy que no baja sin puntos (bundle 881,8 → 726,6 KB); `useAuth` ignora `INITIAL_SESSION` y pide el perfil una vez (#761)

#### Corregido
- Elegir una parcela o un grupo en ⌘K abre su sección con `?q=<código>`; Parcelas y Grupos suman buscador por código o nombre (`filtrarPorCodigoNombre`, sin tildes ni mayúsculas) y `SeccionTablaDatos` recibe `filtros` para el contador y "Limpiar"; la búsqueda ya no viaja al cambiar de sección (`filtrosAlCambiarDeSeccion`) (#688)
- Los grupos en ⌘K muestran «<lugar> · Parcela <código>» (`metaGrupo`): los de plantaciones distintas ya no se ven idénticos (#722)
- «Editar» de una plantación finalizada queda deshabilitado para el admin, con «Solo el superadmin edita una plantación finalizada»: antes se ofrecía y el guardado no se aplicaba; `puedeEditarPlantacion` entra al contrato `permisos-edicion.json` (#742)
- Vaciar descripción, fecha de inicio u objetivo en el formulario de la plantación manda `null`; antes el campo vacío se omitía del UPDATE y quedaba el valor anterior (#648)
- Las lecturas de `leerPaginado` ordenan por una clave única: sin ORDER BY, el OFFSET podía repetir o saltear filas entre páginas; la exportación desempata `global_id` por `id` (#758)

### Mobile

#### Agregado
- Formulario de plantación completo y offline (`PlantationFormModal` sobre `EntityFormModal`): fecha de inicio, objetivo, descripción, foto en todos y visible para técnicos, además de lugar, periodo y GPS; drizzle 0024 suma esas columnas y sus snapshots `*_server`, `utils/camposDePlantacion.ts` centraliza campo, columna y snapshot para pull, descarga y push, foto y visibilidad dejan de ser "server gana" (`webManagedFlags`) y la acción del sheet pasa a "Editar plantación"; la fecha de inicio usa `CampoFecha` sobre `DateTimePickerAndroid` (`@react-native-community/datetimepicker`, módulo nativo: no sale por OTA) con conversión local en `fechaDeCalendario` (#645, #677)
- Aviso de plantación duplicada por lugar + periodo (`trim` + sin mayúsculas, como el `ilike` de la web): bajo los campos contra las del dispositivo (`AvisoPlantacionDuplicada`), en el resumen del sync para altas y ediciones subidas (`duplicadasEnServidor.ts`, grupo "Mismo lugar y periodo") y en un diálogo al crear con señal (`tryPushNow` devuelve `duplicada`) (#645, #656)
- Código de plantación: campo en `PlantationFormModal` con el formato compartido, aviso si otra plantación local lo usa y deshabilitado ("Llega del servidor…") en filas sincronizadas sin código; chequeo contra el servidor en el alta online (`codigoEnUsoEnServidor`); motivos de varado `codigo-repetido` (23505 sobre `(organizacion_id, codigo)` o `CODIGO_DUPLICADO`) y `sin-codigo`; SQLite 0030 con `codigo` y `codigo_server` (#703, #764)
- ID Árbol en el detalle del árbol, y confirmación con la cantidad de árboles antes de cambiar el código de una parcela o un grupo que los tiene (`useAvisoCambioDeIds`, sobre `useConfirm.show` con `onDismiss`) (#703, #660)
- Edición de la plantación por campo con conflictos: la edición online y el push de ediciones offline van por `editar_plantacion` con lo tocado y su base (drizzle 0025: `base_de_edicion`, `editada_localmente_en`, `conflictos_de_edicion`); un conflicto deja el valor de la web, avisa en el resumen con "Resolver", marca la tarjeta con "Cambios por resolver" y abre `ResolverCambiosScreen`, donde elegir el valor propio lo re-encola con la web como base (#648)
- Reabrir una plantación finalizada desde el sheet del admin (superadmin, solo con conexión): `useReaperturaPlantacion` + `utils/reaperturaPlantacion.ts` llaman al RPC `reabrir_plantacion` con los textos de la web y reflejan `estado = activa` en SQLite con `reflejarEstadoLocal`, compartido con `finalizePlantation` (#644)
- Aviso de pendientes varados en la tarjeta (`PendientesVaradosAviso`, todos los roles): `services/sync/pendientesVarados.ts` clasifica los rechazos permanentes en finalizada, archivada o sin permiso (eliminada sale de `eliminada_en_servidor_en`), drizzle 0028 suma `motivo_varado` y `alta_en_servidor`, y "Descartar" (`PendientesVaradosRepository.descartarPendientes`) deshace o borra lo pendiente tras una confirmación que lista qué se pierde; error de sync nuevo `SIN_PERMISO_CREAR` (#653)
- Cambiar la especie de un árbol ya cargado desde su detalle (`SeccionEspecie` + `SelectorDeEspecie`), para quien cargó el grupo; en uno finalizado, «Reabrir y cambiar». `trees.especie_base_id` (drizzle 0031) viaja como `species_base_id`; los árboles de `conservadas` adoptan la especie del server y el modal de sync avisa cuántos de los cambiados en el celular quedaron con ella; el pull adopta especie y base en grupos sin cambios locales (#731)
- Botón de cámara en la barra de la botonera para el árbol seleccionado (`useFotoDelSeleccionado`): sin foto abre la cámara, con foto pasa por el aviso de reemplazo con «Ver actual»; fija el árbol al tocar y se deshabilita sin árboles (#773)
- Guardar y Compartir en el `PhotoViewer` (`PhotoViewerAcciones`, `useAccionesDeFoto`, `FotoExportService`): álbum «Bayka» vía `expo-media-library` —módulo nativo, requiere APK nuevo— y `Sharing.shareAsync`, con nombre `foto-<lugar>-<periodo>-<subId>.jpg`; una foto solo en la nube se baja antes; el detalle y N/N pasan `treeId` al visor (#726)
- «Liberar espacio» en Ajustes → Fotos (`LiberarEspacioService`, `useLiberarEspacio`): borra del celular solo fotos con `fotoSynced` que el server confirma tener (lee `trees.foto_url`), sin escribir en el server ni en `borrados_pendientes`; sin conexión no borra nada (#700)
- Peso de las fotos en el catálogo: tercer dato en `CatalogPlantationCard` y total en «Incluir fotos · X MB» (`pesoDeFotosDelCatalogo`), desde `photo_count`/`photo_bytes` de `catalogo_conteos`; sin dato o sin fotos no muestra nada (#765)
- «Tamaño de la botonera» en Opciones (`TamanoBotoneraSection`, `StepperNumerico`, `SegmentedControl` extraído de `TipoSegmentedControl`): orden código/nombre y letra de 9 a 24 por usuario (`estilo_botonera_<userId>` en SecureStore), con vista previa y Restablecer; vale en la botonera y en N/N (#770)
- Orden asc/desc del listado de árboles de un grupo: `OrdenArbolesToggle` («1→N»/«N→1») en `TreeListModal` y `ReadOnlyTreeView`, con preferencia global persistida (`useOrdenArboles`); solo invierte una copia para la vista, `TreeStrip` y las posiciones no cambian (#725)

#### Cambiado
- CSV y Excel suman `ID Árbol` como primera columna; el KML nombra cada placemark con el ID Árbol y suma el SubID a la descripción (`getKmlExportRows` trae `plantations.codigo`) (#703, #721)
- Especies de la plantación configurables offline por altas y bajas: drizzle 0026 `cambios_especies_pendientes`, pre-step `uploadPendingSpeciesChanges` antes del pull y `aplicar_cambios_especies` también para las especies de un alta offline; una baja rechazada por árboles re-habilita la especie y se avisa ("Especies que no se quitaron"); los cambios pendientes bloquean finalizar y cuentan en "Eliminar del dispositivo"; orden por nombre con `porNombre` (las que el orden personal no conoce van al final); se van `saveSpeciesConfig`, `saveSpeciesConfigLocally` y `conservarEspeciesRecuperadas` (#650)
- Asignar técnicos offline: caché `tecnicos_de_organizacion` y cola `altas_de_tecnicos_pendientes` (drizzle 0027), pre-step `uploadPendingTechnicianAssignments` por `aplicar_cambios_tecnicos`; un técnico rechazado se quita del teléfono y se avisa ("Técnicos que no se asignaron"); quitar sigue pidiendo conexión; se va `assignTechnicians` y `utils/altasYBajas.ts` junta lo común con especies (#651)
- Editar y borrar parcelas queda para admin y superadmin, salvo el alta propia sin subir del técnico: drizzle 0029 `parcelas.alta_pendiente_de`, predicado `puedeEditarParcela` en el repositorio y en el long-press (`usePuedeEditarParcela`), `readCachedUserId()`; el técnico borra su alta sin tombstone y con confirmación; su push de parcelas va con `ignoreDuplicates` y, si el server ignora una edición, la marca subida para que el pull traiga la del server (#643, #657)
- Sale la marca de conflicto de especie por árbol que escribía el pull y nada resolvía: `conflict_especie_id/nombre` dejan `schema.ts` y quedan en la tabla hasta #741; un fallo local después de que el server aceptó el grupo lo deja pendiente en vez de reportarse como error de red (#731)
- La foto arranca en la cámara in-app: se van el menú «Agregar foto», `usePhotoPicker` y `usePhotoCapture`; `PhotoCropProvider.pickPhoto(options)` con etapas `camera → gallery → crop`, botón «Galería», «Elegir de la galería» sin permiso y «Sin foto» si la foto es opcional; el back de Android cancela; se borra `launchCameraRaw` (#772, #660)
- Confirmación antes de quitar la foto, en el visor y en el detalle (`confirmarQuitarFoto`), y antes de reemplazarla (`confirmarReemplazarFoto` con «Ver actual» en el detalle, `confirmarReemplazoEnVisor` en el visor), con texto según `fotoSynced` (#723, #729, #771)
- «Incluir fotos» pasa a «Descargar fotos de otros celulares» (`descargaDeFotosStore`, adopta `sync_include_photos` una vez): la sync de plantación y la global suben siempre las fotos propias y la preferencia solo decide la descarga; está en Ajustes → Fotos y en el modal de sync; `FotoRemota` con «Descargar» para fotos solo en la nube en el detalle, el visor y N/N, y nube en `TreeRowItem` (#700)
- `formatearPeso` usa coma decimal, también en la velocidad de transferencia de la sync («~2,5 MB/s») (#765)
- El catálogo de plantaciones cuenta grupos y árboles con el RPC `catalogo_conteos` en vez de bajar `groups` y `trees` (#758)
- "Editar grupo" pasa a `EditarGrupoModal` sobre `EntityFormModal` (full-screen, footer fijo sobre el teclado) en vez del bottom-sheet armado a mano en `PlantationDetailScreen`; el aviso de cambio de IDs queda anidado vía `extraContent` y se borra `GrupoForm` (#716)
- El pull del catálogo de especies guarda `tipo` y `subtipo` (drizzle 0032, DEFAULT `flora`/`arbol`); el seed no los escribe para no pisar lo que bajó del server. Sin UI (#775)
- Criterio único de conexión en `services/conexion.ts` (`hayConexion`, `sinRed`, `constaSinConexion`): con red pero internet sin confirmar, el login prueba primero la credencial local y después online, y el arranque restaura del cache sin tocar la red; la primera conexión confirmada revalida la sesión una sola vez (rol, purga de cuenta desactivada) con una época de sesión a nivel módulo que no revive un logout; `SIGNED_OUT` solo se acepta con conexión confirmada y el auto-refresh se para sin internet; especies, perfil, edición y alta de plantación y reapertura pasan a `hayConexion()` (#670)
- `runtimeVersion` con `policy: 'fingerprint'` y `fingerprint.config.js` (fuera `extra` y los scripts): un OTA con un módulo nativo nuevo ya no llega a un APK que no lo tiene; los APK instalados no reciben OTAs nuevos hasta instalar uno compilado con fingerprint (#698)

#### Corregido
- El pull de `plantation_species` quita las especies que ya no están en el server (respeta los cambios pendientes y las altas sin subir), y una plantación offline cuya subida de especies falla queda pendiente con el error en vez de marcarse sincronizada sin especies (#642)
- La configuración de especies ya no deja destildar una especie con árboles en el teléfono; antes solo mostraba el candado (#650)
- El catálogo recarga al enfocar (`useFocusEffect` en `useCatalog`: en silencio si ya hay lista, nunca durante una descarga, descartando respuestas viejas) y suma pull-to-refresh; sin conexión conserva la lista con aviso en vez de la pantalla de error, poda la selección que ya no está en el catálogo y con la sesión vencida muestra `CATALOGO_SIN_SESION` (#718)
- `PhotoViewer` ubica la ✕ y la barra de acciones con `useSafeAreaInsets` en vez de `top: 50` y padding fijos (#719)
- El visor de la carga de árboles no ofrece Reemplazar ni Eliminar foto sin permiso de edición: `TreePhotoViewer` con el mismo `getTreeEditGating` que el detalle (#769)
- Los errores de foto y GPS del detalle del árbol salen en el `ConfirmModal` del propio `TreeDetailModal` (sink de error a `addPhotoToTree`/`removePhoto`, catch de `onCaptureGps`) y no en el de la pantalla, que quedaba tapado (#743)
- Login offline en un celular compartido: la credencial offline guarda el `userId` y `handleOfflineSignIn` escribe `USER_ID_KEY`/`ROLE_KEY` de quien entra; si no es el dueño de los tokens cacheados abre una sesión solo local (`SESION_SOLO_LOCAL`) y borra los tokens y el `sb-*` ajenos. `ensureServerSession` rechaza una sesión del SDK de otra cuenta, todo pull y el catálogo pasan por el guard, y finalizar, reabrir y quitar técnicos usan `exigirSesionDelServidor`; `EMAIL_KEY` se cachea con la sesión y no con el rol; una credencial sin `userId` pide un login online (#662, #669)
- Perfil cacheado por cuenta (`user_profile_cache.<userId>` en `PerfilCacheadoService`) con migración perezosa de la ranura única, que offline mostraba el perfil del último login online; la purga de una cuenta desactivada borra su perfil (#695)
- `ensureServerSession` relanza un `AuthRetryableFetchError` de `refreshSession` como falla de red en vez de `SessionExpiredError`: con señal floja el sync ya no pide iniciar sesión (#669)
- Login online sin rol: sin fila en `profiles` devuelve `no_profile` y descarta la sesión en vez de quedar en spinner; si el perfil no responde, usa el rol de la credencial offline de esa misma cuenta; se va el `?? ROL.tecnico` que cacheaba la credencial como técnico (#674)
- Login online que responde después del timeout: `completarLoginTardio` lo persiste como uno a tiempo (credencial, `lastOnlineLogin`, auto-refresh); `SIGNED_IN` solo se adopta de un login vigente del mismo email y `conciliarSdk` restaura o borra el storage del SDK si quedó otra cuenta, así una respuesta tardía no cambia de cuenta ni revive una sesión cerrada (#675)

### Otros
- Migración 055 `especie_con_arboles_no_se_quita`: trigger que impide quitar de `plantation_species` una especie con árboles; `reemplazar_especies_plantacion` quita solo las ausentes, hace upsert del resto y devuelve `ESPECIE_CON_ARBOLES` (#642)
- Migración 056 `parcelas_editar_solo_admin`: la policy UPDATE de `parcelas` pasa a "Admins can update parcelas" (`is_admin()` + membresía + `plantacion_escribible`) y cubre también el tombstone (#643)
- Migración 057 `editar_plantacion_por_campo`: RPC `editar_plantacion(p_id, p_cambios, p_base)` con conflictos por campo, gates de 049 y `DATOS_INVALIDOS`; `plantations.ultima_edicion` (quién y cuándo, por campo) la llena un trigger; `REVOKE UPDATE` + `GRANT UPDATE` de los campos editables y `estado`, que un trigger solo deja pasar de `activa` a `finalizada` (#648)
- Migración 058 `cambios_de_especies`: RPC `aplicar_cambios_especies(p_plantacion, p_altas, p_bajas)`, idempotente y con rechazo por especie; `orden_visual` alfabético (`es-x-icu`) vía `ordenar_especies_plantacion`; `sync_subgroup` re-habilita la especie de los árboles que llegan (#650)
- Migración 059 `cambios_de_tecnicos`: RPC `aplicar_cambios_tecnicos`, espejo de la de especies, con `TECNICO_INACTIVO` y `USUARIO_DE_OTRA_ORGANIZACION` por técnico (#651)
- Migración 060 `organizacion_solo_por_alta`: `handle_new_user` crea el profile `tecnico` y sin organización; `admin-users` asigna rol y organización del superadmin en un solo UPDATE en toda alta, borra al invitado si la asignación falla y responde 403 `sinOrganizacion` a un superadmin sin organización (#697)
- Migración 061 `fotos_quitadas`: `quitar_fotos_arboles` registra cada foto quitada y la acción `limpiarFotosQuitadas` de `admin-plantaciones` (solo service role) borra esos archivos de `tree-photos` desde el workflow diario `supabase-limpiar-fotos.yml`; si el path vuelve a tener foto se cierra como `reasignada` sin borrar (#693)
- Migración 062 `codigo_de_plantacion`: `plantations.codigo` NOT NULL con CHECK de formato y UNIQUE `(organizacion_id, codigo)`; backfill SS26-1/SS26-2 para San Sebastián por lugar + período y `P<n>` para el resto, abortando si algo de San Sebastián no calza; trigger `proteger_codigo_de_plantacion` (solo cambia con la plantación activa) y `editar_plantacion` lo edita con `CODIGO_DUPLICADO`; pgTAP 40 y 41. La web y la APK anteriores no mandan `codigo`: su alta de plantación falla con 23502 (#691)
- Migración 063 `cerrar_update_directo_plantaciones`: `authenticated` pierde el UPDATE directo de los campos editables de `plantations`, que se editan solo por `editar_plantacion`; queda `estado` para finalizar (#728)
- Migración 064 `partir_sync_subgroup`: `sync_subgroup` queda como orquestadora DEFINER de cinco partes INVOKER que solo ejecuta service_role, sin cambio de comportamiento; pgTAP 44 fija ramas que no tenían test (#737)
- Migración 065 `cambiar_especie_arbol`: RPC con el gate de `editar_plantacion` y la base contra `CONFLICTO_EDICION`; `sync_subgroup` suma `sync_subgroup_conservar_especies` y `sync_subgroup_conservadas`, que devuelve `conservadas`. Va junto con la 066; pgTAP 43 (#731)
- Migración 066 `sync_subgroup_no_escribe_ajeno`: `sync_subgroup` ya no pisa árboles, grupos ni parcelas de otra plantación o de otro grupo pasando ids ajenos en el payload; responde `REFERENCIA_AJENA` (la app la trata como `UNKNOWN`) o deshace todo (#738)
- Migración 067 `select_trees_groups_una_vez_por_query`: las policies SELECT de `groups` y `trees` evalúan `mis_plantaciones()` una vez por query, índices `trees(created_at desc)` y `trees(species_id)`, y RPC `catalogo_conteos`; en staging `stats_plantaciones()` baja de 393 a 28 ms. Llega a prod antes del APK; pgTAP 49 (#758)
- Migración 068 `dashboard_y_explorador_cuentan_en_el_server`: RPCs `dashboard_arboles(uuid)` y `arboles_por_grupo(uuid)`, SQL STABLE SECURITY INVOKER que devuelven jsonb. Llega a prod antes de la web; pgTAP 50 (#761)
- Migración 069 `catalogo_conteos_peso_fotos`: `catalogo_conteos(uuid[])` suma `fotos` y `bytes_fotos` desde `storage.objects.metadata->>'size'`, sigue SECURITY INVOKER y no cambia las columnas que leen los APKs en uso; pgTAP 51 (#765)
- Migración 070 `species_tipo_subtipo`: `species.tipo`/`subtipo` NOT NULL con DEFAULT `flora`/`arbol` y CHECK del par; pgTAP 52 recorre el contrato (#775)
- Migración 071 `especies_cientificas`: tabla con nombre normalizado y único sin distinguir mayúsculas, RLS como `species`, `species.especie_cientifica_id` con FK `ON DELETE RESTRICT`, `nombre_cientifico` mantenido por triggers, y `vincular_nombres_cientificos()` convierte los nombres cargados; pgTAP 53 (#776)
- `shared/` con funciones puras que importan web y mobile; arranca con `codigoPlantacion.ts`, que reemplaza las copias de cada app; Metro (`watchFolders`), jest (`modulePaths`), vite, tsconfig, el lint web y `web-ci.yml` la incluyen, y `/deploy` cuenta un commit en `shared/` para las dos apps (#764)
- Contratos `contracts/permisos-edicion.json` y `contracts/sub-id.json`, recorridos por pgTAP 47/48, web y mobile; `db-tests` y `web-ci` corren también con cambios en `contracts/**` (#739)
- Las migraciones se aplican solo con `supabase db push` y quedan registradas en `supabase_migrations.schema_migrations`; ya no se archivan, y el skill `/migrar` arma el comando de push desde `origin/staging` u `origin/main` con su dry-run (#760, #767)
- Preferencias locales sobre `crearPreferencia<T>`/`usePreferencia<T>` (GPS, descarga de fotos, orden de árboles, botonera): la hidratación ya no pisa un valor elegido mientras lee y una falla de SecureStore deja el default; se borra `useSyncSetting` (#700, #770)
- Tipos de error de login como `AUTH_ERROR` as const, con predicados `esErrorDeConectividad`/`esErrorDeCuentaDesactivada` (#676)
- Re-descargar una plantación ya local no pisa su `pendingSync` (rama latente: la UI no ofrece re-descargarla) (#661)
- Se borra código muerto de mobile: `refreshing`/`handleRefresh` y el aviso de frescura de `usePlantaciones` (`checkFreshness`, que consultaba Supabase en cada foco de la lista sin que nadie lo mostrara), y el camino de conflicto de especie de `NNResolutionScreen`/`useNNResolution`, inalcanzable porque la pantalla solo lista árboles sin especie (#718, #727, #736)
- `docs/SPECS.md`: código de plantación, ID de Árbol y columnas del export (#703); decisión documentada: todo usuario de la organización ve el directorio completo (#686); checklist de configuración manual de Supabase y allowlist de Auth al día con los dos proyectos (#687, #709)
- Tests: pgTAP 33 a 37 e integración contra SQLite real (`plantation-campos-sync`, `especies-offline`, `tecnicos-offline`, `pendientes-varados`); fixtures `tests.crear_plantacion` para pgTAP y fábricas tipadas en `web/src/test/fabricas.ts` (#642, #643, #645, #648, #650, #651, #653, #714, #715)
- Mantenimiento de tests y lint: se van las 4 suites apagadas que quedaban en mobile (`group-lifecycle` y `sync-pipeline` rehechas contra código real, sin ningún `skip`), eslint de las dos apps llega a 0 warnings con tope `--max-warnings 0` en CI y los títulos de test pierden claves internas de planificación (#663, #664, #666)
- Skills: `/codebase-stats`, radiografía de la codebase con historial (suma `@vitest/coverage-istanbul` a web); `/push-update-apk` compara los nativos contra el APK del canal, incluidos los plugins efectivos de `app.config.js`; `/matriz-issues` suma bandeja de decisiones, relaciones y antigüedad (#641, #694, #710, #696, #709)

## 2026-09-24 · web 1.4.0 · mobile 1.3.0

### Web 1.4.0

#### Agregado
- Reabrir una plantación finalizada: acción "Reabrir plantación" en «⋯ Más acciones» del detalle, módulo puro `reapertura.ts` (`puedeReabrir`/`esReabrible`/`CONFIRMACION_REAPERTURA`) y `ReaperturaModal` sobre `ConfirmarModal`; se ofrece solo a superadmin activo, con la plantación finalizada y sin archivar (#594)

#### Corregido
- La acción masiva de especies manda la lista final a `reemplazar_especies_plantacion` (DELETE + INSERT en una transacción) en vez de insert y delete sueltos; se va `ordenInicial`, que numeraba las altas distinto del optimista, y `moverEspecie`, sin callers (#589)

### Mobile 1.3.0 (versionCode 4)

#### Cambiado
- La base local activa `PRAGMA foreign_keys` después de las migraciones (`useBaseLocal`): antes limpia los huérfanos de `foreign_key_check`, recrea como `recuperada:<id>` las especies que faltan y no siembra `plantation_species` de la demo si la demo no está; `reconcileSpeciesCodigoCollision` libera el código, inserta y recién después re-apunta referencias, en una transacción válida con FKs activas (#621, #620)

#### Corregido
- `useAssignTechnicians` toma la organización de `useProfileData` (cacheada en SecureStore) en vez de consultar Supabase: sin conexión la pantalla muestra el aviso de red en lugar de quedarse en "Cargando técnicos…"; el cruce catálogo + asignados pasa a `getTechniciansWithAssignment` con el comparador puro `porAsignadoYNombre` (#593)
- `seedSpeciesIfNeeded` ya no borra especies referenciadas por `trees`, `plantation_species` o `user_species_order`, y el pull baja por id las especies faltantes (`asegurarEspecies`) antes de escribir árboles (#618)
- Cambiar el código de una parcela o de un grupo recalcula los SubID de sus árboles en la misma transacción, y el pull adopta los cambios de otros dispositivos (`planDeRenombres`/`adoptarRenombres`, en dos pasadas contra los índices únicos); `updateGroup` y `updateParcela` rechazan una plantación no editable, y `isNameUniqueConstraintError` detecta por fin el nombre duplicado (#625, #628)

### Otros
- Migración 050 `perfil_inactivo_sin_organizacion`: `current_organizacion_id()` devuelve NULL con el perfil inactivo y `Users can update own profile` pasa a `TO authenticated` con `USING`/`WITH CHECK` exigiendo `activo`; `Users can read own profile` se deja intacta a propósito (#587)
- Migración 051 `gates_con_helpers`: `generate_tree_ids` usa `puede_archivar_plantacion()`, `protect_profile_fields` usa `is_superadmin()` y se elimina la policy `Plantation members can delete parcelas`, sin consumidores (#597)
- Migración 052 `reabrir_plantacion`: RPC con gate de superadmin activo, validación del estado previo, scope de organización y `FOR UPDATE`; rechaza archivadas con `PLANTACION_ARCHIVADA` (#594)
- Ensayo de restore scripteado y verificado sobre un backup real de producción: `scripts/restore-backup.sh` más `docs/backup-restore.md`, que documenta qué no viaja en el dump —archivos de Storage y `supabase_migrations`— y cómo comparar un dump contra baseline + migraciones sin conectarse a prod (#596, #605)
- El caso L de la auditoría responsive avisa cuando no hay pasos donde inyectar (#586)
- Mantenimiento de tests y lint: se van las suites apagadas del pull y entra la que faltaba, el guard de safe-area nombra quién aplica el inset, el idioma de Jest deja de disparar warnings y `Array<T>` pasa a `T[]`; los tests de integración corren con FKs activas y limpian con `vaciarTablas` (#592, #590, #600, #602, #619, #624)
- Migración 053 `subid_sigue_al_codigo_de_parcela`: trigger que reescribe el prefijo de los `sub_id` al cambiar el código de una parcela (#625)
- Migración 054 `sync_subgroup_codigo_y_prefijo`: `sync_subgroup` pisa `codigo`, `nombre` y `tipo`, devuelve `DUPLICATE_NAME` y normaliza el prefijo de parcela con el `parcela_codigo` que manda el móvil (#628)
- Retención escalonada de los backups de la base (7 diarios, 4 semanales, 12 mensuales); el script falla si no rota (#613)
- Checklist de configuración manual de Supabase por entorno (#611)
- Skill `/issue`, convención de redacción de Issues y dashboard `/matriz-issues` (#610)

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
