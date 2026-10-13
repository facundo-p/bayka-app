# Changelog

Registro técnico de cada release a producción, basado en
[Keep a Changelog](https://keepachangelog.com/es-AR/1.1.0/). La versión para
usuarios y clientes es [NOVEDADES.md](NOVEDADES.md).

Los headers de las entradas son anclas de `.github/workflows/release-tags.yml`,
que extrae de acá las notas de cada GitHub Release: no cambiar su formato. El
contrato completo (entrada de release, sección pendiente de staging y su
conversión) está en `.claude/skills/deploy/SKILL.md` ("Contrato de formato").

## Sin publicar
<!-- sincronizado-hasta: 5bf05c1 #909 -->

### Web

#### Agregado
- Código de plantación: campo "Código *" en `PlantacionFormModal` (mayúsculas sin espacios al tipear, `maxLength` 8, formato de `contracts/codigo-plantacion.json`, deshabilitado fuera de activa con `codigoEsEditable`), `CodigoPlantacionDuplicadoError` desde 23505 al crear y `CODIGO_DUPLICADO` al editar, columna Código en el listado y el código en la línea de metadatos del detalle (#699, #764)
- ID Árbol (`<SubID>-<código>`, `idDeArbol`): reemplaza la columna SubID de Datos → Árboles y titula `ArbolDetallePanel`; la búsqueda de árboles de ⌘K y de Datos acepta el ID completo (`separarIdArbol` + `resolverBusquedaArbol`, códigos cacheados 5 min y reiniciados al cambiar de usuario o guardar una plantación; Datos pasa a `plantations!inner(codigo)`); el buscador de Árboles dice «Buscar SubID…» (densidad `minima` de `CampoBusqueda`) y su nombre accesible, «Buscar por SubID o ID Árbol» (#699, #717, #787)
- Cambiar la especie de un árbol desde su panel en Datos: «Cambiar» en `BloqueEspecie` con `SelectConDetalle`, por la RPC `cambiar_especie_arbol` con la especie base; ante `CONFLICTO_EDICION` el panel muestra la especie vigente del server. Lo ofrece `puedeCambiarEspecie`: admin con la plantación activa, superadmin también en finalizada, nadie en archivada (#731)
- Tipo y subtipo de especie: tipo fijo «Flora» y subtipo Árbol/Arbusto obligatorio (`SegmentedControl`) en `EspeciePanel`, columna Subtipo (oculta con el panel abierto) y filtro «Subtipo» en el listado; contrato `contracts/tipos-especie.json` espejado en `shared/tiposEspecie.ts` (#775, #791, #812)
- Especies científicas: pestañas Comunes/Científicas (`/especies/cientificas`), listado con los nombres comunes que agrupa cada una, filtro Todas/Con especies/Sin especies y atenuadas las que no agrupan; `EspecieCientificaPanel` crea, renombra y elimina (deshabilitado mientras agrupe especies); ⌘K las busca (#776)
- Edición de la plantación por campo con conflictos: el formulario, la config GPS y los toggles de visibilidad y foto van por la RPC `editar_plantacion` con solo lo que cambió y la base con que se abrieron; ante un conflicto el campo toma el valor del server como base nueva y el resto se guarda (`repositories/edicionDePlantacion.ts`, `ConflictoDeEdicionError`) (#648)
- Botón «Descargar foto» sobre la foto del detalle del árbol (`FotoYMapa`): URL firmada con `download` (`obtenerUrlDescargaFoto`, `descargarDesdeUrl`) y nombre `foto-<lugar>-<periodo>-<subId>.jpg` (`nombreArchivoFoto`); el demo firma una foto de muestra. «Descargar» también en la foto ampliada, y «Eliminar foto» en la miniatura y en la foto ampliada con confirmación (`EliminarFoto`, `useEliminarFoto`) por `quitar_fotos_arboles` con `p_bases`: si la foto cambió mientras tanto, no se borra y el panel muestra la nueva; `motivoParaNoEliminarFoto` la bloquea en archivada (#726, #843, #907)
- Ficha PDF de un árbol: «Descargar ficha PDF» al pie de `ArbolDetallePanel` (`BotonFichaPdf`, «Generando ficha…»), por `services/pdfFicha.ts` y `pdf/ficha/motorFicha` cargado con `import()`. Una hoja A4 por árbol (`DocumentoFicha`): foto y minimapa cuadrados de 300 pt a 252 ppp a la derecha (`rasterFicha.ts`, foto de 1050 px con calidad 0,8, minimapa dibujado al 1,5×), especie con científico y clasificación, ID Árbol (se achica para entrar en un renglón, `tamanoIdArbol`), registro y técnico junto a la foto, y parcela, grupo, posición y GPS junto al mapa; sin ID Global; «Sin foto», «Foto no disponible», «Sin punto GPS» y «Mapa no disponible» en recuadro punteado con ícono (`IconoFicha`); radio de los puntos según la separación entre vecinos (`radioSegunVecinos`). Archivo `ficha-<lugar>-<periodo>-<subid>.pdf` (#778, #835, #856, #868, #884)
- Reporte PDF de los árboles del filtro: «Reporte PDF» en la barra de Árboles (`BotonReportePdf`, solo ícono en teléfono) en lugar del modo selección de fichas y su botón «PDF» (#779, #787). `ReportePdfModal` cuenta el filtro (total y con foto) y elige «Con fotos» (tarjetas 2×3 por hoja, tope `TOPE_TARJETAS` 400) o «Sin fotos» (todo al listado), con «N hojas o más · ≈ X MB» (`estimarReporte` con `esPiso`, `pesoReporte`). Lee el filtro de a 1.000 (`listarArbolesDelFiltro` sobre `leerPaginado`), baja las fotos con barra y arma el PDF A4 horizontal en un Web Worker (`reporte.worker.ts`; `Escalon` evita el recorrido cuadrático de react-pdf; `src/pdf/` sin Fast Refresh en `pluginReact.ts`). Cancelar y Escape abortan en cualquier etapa, el clic afuera no cierra mientras genera (`Modal.cerrarAlClickearAfuera`) y las fotos fallidas se avisan al terminar. Nombres largos enteros, partidos por palabra con medición propia (`medirTexto`, `partirTexto`, `renglonador`, `CORTAR_TEXTO_LARGO = false`), hojas llenadas por alto acumulado (`altosReporte`). La tarjeta encabeza con la especie y el ID va chico debajo; el filtro se lee por código de grupo, grupo, posición e id, y las fotos bajan de a 10. Pie «Reporte de plantación · N árboles». Archivo `arboles-<lugar>-<periodo>[-<filtros>].pdf` (`nombreArchivoReporte`) (#870, #874, #881, #894, #901, #904)
- Informe PDF de la plantación: «Informe PDF» en Exportar abre `InformePdfModal` con Meta y avance, Porcentaje con GPS, Porcentaje con foto y Mapa de puntos GPS (`lib/opcionesInforme.ts`; se recuerdan en `localStorage` al generar, la meta queda bloqueada sin objetivo y el modal no se cierra mientras genera, `AccionesModal.cancelarDeshabilitado`). Siempre van «Árboles registrados» y la distribución por especie con N/N, de `calcularDashboard` de la plantación entera. Mapa «Puntos GPS» 16:9 al ancho del cuerpo (`CAJA_MAPA_INFORME`), solo con los puntos (radio mínimo 1,5 pt) y la nota «N de M árboles tienen coordenadas», al pie de la última hoja o en hoja propia según `planificarInforme`; la línea del título («Lugar · Período») y los nombres de especie salen enteros en renglones (`renglonesInforme`). `MEDIDA_HOJA` pasa al A4 de react-pdf (595,28 × 841,89 pt) (#780, #784, #837, #869, #890, #904, #906)
- Imagen satelital de Esri en el minimapa de la ficha y el mapa del informe: `lib/capaSatelite.ts` compartido con `MapaPuntosLeaflet`; zoom más alto que entre en 36 tiles (`TOPE_TILES`), un zoom menos donde el `tilemap` no tiene imagen (hasta tres), 6 descargas a la vez, espera de 8 s con cortacircuito de 60 s y caché de sesión de 1000 tiles; si algo falla, mapa liso. «*» bajo el mapa (`LlamadaSatelite`) y «* Imágenes © Esri, Maxar» como `notaAlPie` de `Hoja`, solo en las hojas con satélite (#781, #785)
- Filtro por especie en el dashboard y popup del árbol en el mapa: `useFiltrosDashboard` (`{ parcelaId, especieCodigo }`) reemplaza a `useFiltroParcela` y `calcularDashboard(fuente, filtros)` cruza parcela y especie («Por especie» se calcula solo con la parcela y la tira solo con la especie); las filas de `SpeciesDistribution` son `<button aria-pressed>`, el recuadro azul muestra un chip por filtro y «Ver todos» suelta los dos; un solo popup controlado (`PuntosConPopup`, `PopupArbol` + `fichaDePunto`) con ID Árbol, especie y parcela, y `CapaPuntos` con `memo` para no redibujar los puntos (#842)
- Filas de las tablas con teclado: las que tienen `onRowClick` llevan `tabIndex={0}` y abren con Enter o Espacio solo con el foco en la fila (`activaComoBoton`, `TECLA.espacio`), con anillo `:focus-visible` y `scroll-padding-top` (`--alto-encabezado-tabla`) para que el encabezado sticky no tape lo enfocado; al cerrar el detalle el foco vuelve a la fila (#866, #853)

#### Cambiado
- Excel y CSV: `ID Árbol` reemplaza a `ID Global` como primera columna (`contracts/export-columns.json`) y el `ID Parcial` se numera al exportar sobre la plantación entera con `numerarPorIdParcial` (`shared/idParcial.ts`); se van «Generar IDs» (`GenerarIdsModal`, `idsQueries`, `idsPendientes`) y las planillas quedan habilitadas en cualquier plantación; el KML nombra cada placemark con el ID Árbol y describe SubID y especie, en vez de nombre y código de la especie (#703, #721, #856)
- El nombre científico de una especie se elige de la lista de científicas (`SelectorEspecieCientifica`, con «Sin especie científica») en vez de escribirse como texto libre (#776)
- Especies de la plantación por altas y bajas: el toggle y "marcar/desmarcar todas" van por `aplicar_cambios_especies` en vez de `reemplazar_especies_plantacion` y no pisan los cambios de un teléfono en otras especies; especies y checklist se ordenan por nombre (`lib/ordenEspecies.ts`, sin `ordenVisual`), el pie dice "En la app se ordenan por nombre" y el error muestra el motivo del server (`ESPECIE_CON_ARBOLES`, finalizada, archivada…) (#650, #642)
- Dashboard y explorador cuentan en el server (`dashboard_arboles`, `arboles_por_grupo`) en vez de bajar todos los árboles; `leerPaginado` pide la primera página sola y el resto de a 4 en paralelo; Leaflet pasa a un chunk lazy que no baja sin puntos (bundle 881,8 → 726,6 KB); `useAuth` ignora `INITIAL_SESSION` y pide el perfil una vez (#761)
- Listado de plantaciones: columnas Puntos GPS y Fotos (fuera en teléfono) en vez de Usuarios y Visible, desde `stats_plantaciones`; filtros «Visible por» (técnicos activos con alguna asignación, de `usePerfiles`) y «Visibles» (Todas/Sí/No) con predicados puros en `plantaciones/filtros.ts` (#838)
- Recuadro azul del dashboard con «N puntos» y «N fotos» bajo «Con GPS» y «Con foto» (`pluralizar` + `SUSTANTIVO`), que siguen a los filtros; `PlantationMap` sin leyenda de especies ni chip de puntos (#841)
- Detalle del árbol rediseñado (`ArbolDetallePanel`, `FotoYMapa`, `BloqueEspecie`): cabecera con el ID Árbol y `BotonCopiar` (`useCopiar`); especie con chip de código y nombre científico, y N/N en ámbar con «Identificar» sobre el mismo `useCambioDeEspecie` (token `--color-warn-fg-legible`); Ubicación en un `<dl>` con parcela, grupo y posición; foto 1:1 con `cover` que se amplía en un `Modal ancho="amplio"`; «Foto sin subir» para `file://`/`content://` (`esFotoLocal`); GPS con 6 decimales (`DECIMALES_GPS`, compartido con la ficha PDF), «± N m», copiar coordenadas y «Google Maps ↗»; y «Registrado el … por …». La query de Datos suma `nombre_cientifico` y el nombre del grupo, y el Escape dentro de un `Modal` ya no cierra el panel de atrás (#843)
- Filtros de Plantaciones, Datos, Especies, Científicas y Usuarios en `PanelFiltros` detrás del botón «Filtros», con la cuenta de los puestos (popover anclado arriba de 600px, hoja en teléfono, sin «Aplicar»). El buscador y el orden quedan a la vista y fuera de la cuenta y de «Limpiar» (`CLAVE_A_LA_VISTA` en `lib/filtros.ts`); en Datos la búsqueda pasa a la prop `busqueda` de `BarraHerramientas`, Parcelas queda sin botón «Filtros» y la hoja de Árboles apila los filtros a lo ancho. `useDesplegableAnclado` + `flotanteAnclado.module.css` se comparten con `MenuDesplegable`, el reseteo de parcela pasa a `useSoltarParcelaFantasma` y se van los anchos fijos `--ancho-filtro-*` (#854, #813)
- Rótulos (`.overline`) y textos apagados con contraste AA: `--color-text-faint` y `--color-text-muted` pasan a ser alias de `--color-text-secondary`, el sublabel de `SegmentedControl` pierde la opacidad, tres hovers suben a `--color-text-primary` y `COLOR_PDF.tenue` sigue al token; test `contraste.test.ts` con la fórmula WCAG 2 (#851)

#### Corregido
- Elegir una parcela o un grupo en ⌘K abre su sección con `?q=<código>`; Parcelas y Grupos suman buscador por código o nombre (`filtrarPorCodigoNombre`, sin tildes ni mayúsculas) y `SeccionTablaDatos` recibe `filtros` para el contador y "Limpiar"; la búsqueda ya no viaja al cambiar de sección (`filtrosAlCambiarDeSeccion`) (#688)
- Los grupos en ⌘K muestran «<lugar> · Parcela <código>» (`metaGrupo`): los de plantaciones distintas ya no se ven idénticos (#722)
- «Editar» de una plantación finalizada queda deshabilitado para el admin, con «Solo el superadmin edita una plantación finalizada»: antes se ofrecía y el guardado no se aplicaba; `puedeEditarPlantacion` entra al contrato `permisos-edicion.json` (#742)
- Vaciar descripción, fecha de inicio u objetivo en el formulario de la plantación manda `null`; antes el campo vacío se omitía del UPDATE y quedaba el valor anterior (#648)
- Las lecturas de `leerPaginado` ordenan por una clave única: sin ORDER BY, el OFFSET podía repetir o saltear filas entre páginas; la exportación pagina por `id` y ordena después por ID Parcial (#758, #856)
- Colores de especie por lugar fijo en la plantación: dos especies ya no comparten color y habilitar o quitar una no cambia las demás. `plantation_species.lugar_color` → `PALETA_ESPECIES[lugar % 12]` (8 de los gráficos + 4 del informe), N/N en ámbar y un solo respaldo por hash (`colorEspeciePorCodigo`) si falla la lectura. Lo usan el dashboard, el mapa, Datos, el KML, la ficha y el informe PDF (`useColoresEspecie`, `coloresDePlantacion`, `leerColoresEspecie`; se borra `coloresInforme.ts`). `listarEspeciesDePlantacion` pide columnas explícitas con `lugar_color`, y el catálogo de Especies deja el punto de color: el panel usa el ícono de hoja (#839, #855, #865)
- A ≤900px el detalle de Árboles, Especies, Científicas y Usuarios se abre en una hoja (`PanelLateral` → `Modal posicion="hoja"` con `encabezadoPropio`, capa `--z-detalle`) en vez de quedar debajo de la tabla. Con la hoja abierta la tabla no oculta columnas, `useFocusTrap` cuenta links y `textarea`, y el pie dice «clic en una fila abre el detalle» (`lib/ayudaFila.ts`) (#853)
- Con un `Modal` o la paleta ⌘K abiertos el documento no scrollea: `useBloquearScroll` marca `<html data-scroll-bloqueado>` (contador para anidados, `overscroll-behavior: none`, `scrollbar-gutter: stable`) y restaura la posición si la URL no cambió. El Escape de la paleta ya no cierra también el detalle del costado: `cerrarSoloEstaCapa` (`lib/escape.ts`) lo comparten `Modal`, `DialogoPaleta`, `useDesplegable` y `usePopoverAnclado` (#867)
- En teléfono, la base de `.left` de la topbar pasa de 0 a 192px: entre 370 y 550px las tabs de la plantación bajan de renglón en vez de aplastar la miga (#852)
- El mapa del dashboard y el del detalle encuadran al zoom más cercano con imagen satelital (`AjustarVista` con `zoomConImagen`, tope 17 si el chequeo falla o tarda más de 3 s, y re-encuadre solo si cambian los bordes); el chequeo, la fuente de tiles y las direcciones XYZ pasan de `pdf/` a `lib/mapa/` (#840)
- `MenuDesplegable` devuelve el foco al disparador al elegir un ítem o cerrar con Escape, así un `Modal` abierto desde el menú lo devuelve ahí al cerrarse (#873)

### Mobile

#### Agregado
- Formulario de plantación completo y offline (`PlantationFormModal` sobre `EntityFormModal`): fecha de inicio, objetivo, descripción, foto en todos y visible para técnicos, además de lugar, periodo y GPS; drizzle 0024 suma esas columnas y sus snapshots `*_server`, `utils/camposDePlantacion.ts` centraliza campo, columna y snapshot para pull, descarga y push, foto y visibilidad dejan de ser "server gana" (`webManagedFlags`) y la acción del sheet pasa a "Editar plantación"; la fecha de inicio usa `CampoFecha` sobre `DateTimePickerAndroid` (`@react-native-community/datetimepicker`, módulo nativo: no sale por OTA) con conversión local en `fechaDeCalendario` (#645, #677)
- Aviso de plantación duplicada por lugar + periodo (`trim` + sin mayúsculas, como el `ilike` de la web): bajo los campos contra las del dispositivo (`AvisoPlantacionDuplicada`), en el resumen del sync para altas y ediciones subidas (`duplicadasEnServidor.ts`, grupo "Mismo lugar y periodo") y en un diálogo al crear con señal (`tryPushNow` devuelve `duplicada`) (#645, #656)
- Código de plantación: campo en `PlantationFormModal` con el formato compartido, aviso si otra plantación local lo usa y deshabilitado ("Llega del servidor…") en filas sincronizadas sin código; chequeo contra el servidor en el alta online (`codigoEnUsoEnServidor`); motivos de varado `codigo-repetido` (23505 sobre `(organizacion_id, codigo)` o `CODIGO_DUPLICADO`) y `sin-codigo`; SQLite 0030 con `codigo` y `codigo_server` (#703, #764)
- ID Árbol en el detalle del árbol, y confirmación con la cantidad de árboles antes de cambiar el código de una parcela o un grupo que los tiene (`useAvisoCambioDeIds`, sobre `useConfirm.show` con `onDismiss`) (#703, #660)
- Edición de la plantación por campo con conflictos: la edición online y el push de ediciones offline van por `editar_plantacion` con lo tocado y su base (drizzle 0025: `base_de_edicion`, `editada_localmente_en`, `conflictos_de_edicion`); un conflicto deja el valor de la web, avisa en el resumen con "Resolver", marca la tarjeta con "Cambios por resolver" y abre `ResolverCambiosScreen`, donde elegir el valor propio lo re-encola con la web como base (#648)
- Conflictos de sincronización en grupos y árboles: el push manda la base de cada dato (`species_base_id`, `gps_base`, `foto_base` y la `base` del grupo con nombre, código, tipo y estado; drizzle 0034 con `conflictos_de_sync`, `groups.base_del_servidor`, `trees.foto_base` y las bases del GPS) y la foto sube a un path por versión (`trees/<id>-<versión>.jpg`). `asentarGrupo` adopta lo que el server devuelve en `conservados`, guarda el valor propio en `conflictos_de_sync` y deja el grupo pendiente hasta decidir. `ResolverCambiosScreen` suma una sección por grupo y por árbol (`TarjetaDeConflicto`, `FotoDeConflicto` con descargas de a `FOTOS_EN_PARALELO`, distancia entre puntos con `shared/distancia.ts`), deshabilita lo propio con el motivo de `motivoParaNoConservar` y aplica `conservarLaMia` o `descartarConflicto`; la ruta llega al técnico. Avisan `CambiosPorResolverAviso` en el resumen (reemplaza el aviso de especies conservadas), la tarjeta en los dos roles y el grupo (`ConflictosDelGrupoAviso` y un ícono por árbol en `TreeRowItem`). Quitar una foto manda su base (`p_bases`) y, si el server tiene otra, queda como conflicto «Sin foto (la quitaste)» (`asentarFotosQuitadas`); borrar árbol, grupo o plantación, o descartar varados, se lleva sus conflictos (#807, #808, #815)
- Reabrir una plantación finalizada desde el sheet del admin (superadmin, solo con conexión): `useReaperturaPlantacion` + `utils/reaperturaPlantacion.ts` llaman al RPC `reabrir_plantacion` con los textos de la web y reflejan `estado = activa` en SQLite con `reflejarEstadoLocal`, compartido con `finalizePlantation` (#644)
- Aviso de pendientes varados en la tarjeta (`PendientesVaradosAviso`, todos los roles): `services/sync/pendientesVarados.ts` clasifica los rechazos permanentes en finalizada, archivada o sin permiso (eliminada sale de `eliminada_en_servidor_en`), drizzle 0028 suma `motivo_varado` y `alta_en_servidor`, y "Descartar" (`PendientesVaradosRepository.descartarPendientes`) deshace o borra lo pendiente tras una confirmación que lista qué se pierde; error de sync nuevo `SIN_PERMISO_CREAR`. En una finalizada las fotos sin subir también cuentan como varadas y «Descartar» las suelta (`conservaTecnicos` en vez de `conservaLoQueSube`) (#653, #797)
- Cambiar la especie de un árbol ya cargado desde su detalle (`SeccionEspecie` + `SelectorDeEspecie`), para quien cargó el grupo; en uno finalizado, «Reabrir y cambiar». `trees.especie_base_id` (drizzle 0031) viaja como `species_base_id`; si el server conserva otra especie, el árbol la adopta y la propia queda como conflicto de sincronización; el pull adopta especie y base en grupos sin cambios locales (#731, #807)
- Botón de cámara en la barra de la botonera para el árbol seleccionado (`useFotoDelSeleccionado`): sin foto abre la cámara, con foto pasa por el aviso de reemplazo con «Ver actual»; fija el árbol al tocar y se deshabilita sin árboles (#773)
- Guardar y Compartir en el `PhotoViewer` (`PhotoViewerAcciones`, `useAccionesDeFoto`, `FotoExportService`): álbum «Bayka» vía `expo-media-library` —módulo nativo, requiere APK nuevo— y `Sharing.shareAsync`, con nombre `foto-<lugar>-<periodo>-<subId>.jpg`; una foto solo en la nube se baja antes; el detalle y N/N pasan `treeId` al visor (#726)
- «Liberar espacio» en Ajustes → Fotos (`LiberarEspacioService`, `useLiberarEspacio`): borra del celular solo fotos con `fotoSynced` que el server confirma tener (lee `trees.foto_url`), sin escribir en el server ni en `borrados_pendientes`; sin conexión no borra nada (#700)
- Peso de las fotos en el catálogo: tercer dato en `CatalogPlantationCard` y total en «Incluir fotos · X MB» (`pesoDeFotosDelCatalogo`), desde `photo_count`/`photo_bytes` de `catalogo_conteos`; sin dato o sin fotos no muestra nada (#765)
- «Tamaño de la botonera» en Opciones (`TamanoBotoneraSection`, `StepperNumerico`, `SegmentedControl` extraído de `TipoSegmentedControl`): orden código/nombre y letra de 9 a 24 por usuario (`estilo_botonera_<userId>` en SecureStore), con vista previa y Restablecer; vale en la botonera y en N/N (#770)
- Orden asc/desc del listado de árboles de un grupo: `OrdenArbolesToggle` («1→N»/«N→1») en `TreeListModal` y `ReadOnlyTreeView`, con preferencia global persistida (`useOrdenArboles`); solo invierte una copia para la vista, `TreeStrip` y las posiciones no cambian (#725)

#### Cambiado
- CSV y Excel: `ID Árbol` reemplaza a `ID Global` como primera columna y el `ID Parcial` se numera al exportar con `numerarPorIdParcial` (`shared/idParcial.ts`), igual que la web; una finalizada ofrece siempre CSV, Excel y KML (se van `AVISO_IDS_DESDE_WEB`, `meta.idsGenerated` y su query); el KML nombra cada placemark con el ID Árbol y suma el SubID a la descripción (`getKmlExportRows` trae `plantations.codigo`). Drizzle 0035 dropea `trees.global_id` y `trees.plantacion_id`, y el pull ignora los que todavía mande el server (#703, #721, #856)
- Especies de la plantación configurables offline por altas y bajas: drizzle 0026 `cambios_especies_pendientes`, pre-step `uploadPendingSpeciesChanges` antes del pull y `aplicar_cambios_especies` también para las especies de un alta offline; una baja rechazada por árboles re-habilita la especie y se avisa ("Especies que no se quitaron"); los cambios pendientes bloquean finalizar y cuentan en "Eliminar del dispositivo"; orden por nombre con `porNombre` (las que el orden personal no conoce van al final); se van `saveSpeciesConfig`, `saveSpeciesConfigLocally` y `conservarEspeciesRecuperadas` (#650)
- Asignar técnicos offline: caché `tecnicos_de_organizacion` y cola `altas_de_tecnicos_pendientes` (drizzle 0027), pre-step `uploadPendingTechnicianAssignments` por `aplicar_cambios_tecnicos`; un técnico rechazado se quita del teléfono y se avisa ("Técnicos que no se asignaron"); quitar sigue pidiendo conexión; se va `assignTechnicians` y `utils/altasYBajas.ts` junta lo común con especies (#651)
- Editar y borrar parcelas queda para admin y superadmin, salvo el alta propia sin subir del técnico: drizzle 0029 `parcelas.alta_pendiente_de`, predicado `puedeEditarParcela` en el repositorio y en el long-press (`usePuedeEditarParcela`), `readCachedUserId()`; el técnico borra su alta sin tombstone y con confirmación; su push de parcelas va con `ignoreDuplicates` y, si el server ignora una edición, la marca subida para que el pull traiga la del server (#643, #657)
- Sale la marca de conflicto de especie por árbol que escribía el pull y nada resolvía: `conflict_especie_id/nombre` dejan `schema.ts` y drizzle 0033 las dropea; un fallo local después de que el server aceptó el grupo lo deja pendiente en vez de reportarse como error de red (#731, #792)
- La foto arranca en la cámara in-app: se van el menú «Agregar foto», `usePhotoPicker` y `usePhotoCapture`; `PhotoCropProvider.pickPhoto(options)` con etapas `camera → gallery → crop`, botón «Galería», «Elegir de la galería» sin permiso y «Sin foto» si la foto es opcional; el back de Android cancela; se borra `launchCameraRaw` (#772, #660)
- Confirmación antes de quitar una foto ya subida, en el visor y en el detalle (`confirmarQuitarFoto`: «Quitar la foto del árbol», se quita para todos), y antes de reemplazarla (`confirmarReemplazarFoto` con «Ver actual» en el detalle, `confirmarReemplazoEnVisor` en el visor), con texto según `fotoSynced`. Quitar una foto sin subir deshace el cambio local sin preguntar: `quitarFotoDelArbol` vuelve a `fotoBase` como remota, o a sin foto, en una transacción con guard sobre la fila y sin registrar borrado, y devuelve `requiereConfirmacion` si mientras tanto se subió; antes registraba la quitada y se llevaba la foto del server. Una foto nueva ya no descarta la quitada pendiente: la descarta `confirmarFotoSubida` al subirla (#723, #729, #771, #821)
- «Incluir fotos» pasa a «Descargar fotos de otros celulares» (`descargaDeFotosStore`, adopta `sync_include_photos` una vez): la sync de plantación y la global suben siempre las fotos propias y la preferencia solo decide la descarga; está en Ajustes → Fotos y en el modal de sync; `FotoRemota` con «Descargar» para fotos solo en la nube en el detalle, el visor y N/N, y nube en `TreeRowItem` (#700)
- `formatearPeso` usa coma decimal, también en la velocidad de transferencia de la sync («~2,5 MB/s») (#765)
- El catálogo de plantaciones cuenta grupos y árboles con el RPC `catalogo_conteos` en vez de bajar `groups` y `trees` (#758)
- "Editar grupo" pasa a `EditarGrupoModal` sobre `EntityFormModal` (full-screen, footer fijo sobre el teclado) en vez del bottom-sheet armado a mano en `PlantationDetailScreen`; el aviso de cambio de IDs queda anidado vía `extraContent` y se borra `GrupoForm` (#716)
- El pull del catálogo de especies guarda `tipo` y `subtipo` (drizzle 0032, DEFAULT `flora`/`arbol`); el seed no los escribe para no pisar lo que bajó del server. Sin UI (#775)
- Criterio único de conexión en `services/conexion.ts` (`hayConexion`, `sinRed`, `constaSinConexion`): con red pero internet sin confirmar, el login prueba primero la credencial local y después online, y el arranque restaura del cache sin tocar la red; la primera conexión confirmada revalida la sesión una sola vez (rol, purga de cuenta desactivada) con una época de sesión a nivel módulo que no revive un logout; `SIGNED_OUT` solo se acepta con conexión confirmada y el auto-refresh se para sin internet; especies, perfil, edición y alta de plantación y reapertura pasan a `hayConexion()` (#670)
- `runtimeVersion` con `policy: 'fingerprint'` y `fingerprint.config.js` (fuera `extra` y los scripts): un OTA con un módulo nativo nuevo ya no llega a un APK que no lo tiene; los APK instalados no reciben OTAs nuevos hasta instalar uno compilado con fingerprint (#698)
- Grupo ajeno: `getTreeEditGating` da foto y GPS al creador y a admin/superadmin (`puedeEditarArbolesDelGrupo`, rol por `esRutaAdmin`); borrar árboles, cambiar especie y `getGroupGating` siguen siendo del creador. `updatePhoto`, `removePhoto`, `addPhotoToTree`, `captureTreeGps` y `updateTreePhoto` (`edicionDeArboles.ts`) chequean el permiso; `getSyncableGroups` y `getTreesWithPendingPhotos` filtran por quién sube (`subidorActual`) y el punto naranja y los contadores usan el mismo filtro (`useQuienSube`); un técnico resuelve en modo plantación solo los N/N de sus grupos (#797)
- Con «Foto en todos los botones» la foto de las especies es opcional: `PHOTO_CAPTURE_REQUIRED_DEFAULT` y `contracts/photo-defaults.json` pasan a `false` (N/N sigue obligatoria), y `useTreeRegistration` ignora un segundo toque con la cámara abierta (#909)
- Fotos cuadradas de 1200×1200 (`PHOTO_SIDE`): `CameraCaptureView` muestra el preview entero en 4:3 con el marco cuadrado de `CropMask`, compartido con el recorte; `PhotoCropModal` y `cropGeometry` mantienen el 1:1 al mover y redimensionar sin salirse de la imagen; `cropResizeAndSave` recorta y redimensiona a 1200 por lado; `launchGalleryRaw` sin `allowsEditing`, así la galería entra al mismo recorte. Se van `isFullCrop` y el fallback a foto entera: un recorte fallido avisa y deja el recorte abierto, y una foto de galería sin tamaño vuelve a la cámara. `FotoDeConflicto` pasa a 120×120; las fotos existentes no se reprocesan (#836)

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
- El pull reemplaza la foto y el GPS locales que el server cambió y el teléfono no: la foto se compara contra `fotoBase` (un reemplazo en otro celular cambia el path) y se borra la copia obsoleta (`fotosLocalesObsoletas`), y el GPS contra `latitude_base`/`longitude_base`/`gps_captured_at_base`; antes la copia local ganaba siempre (#807)

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
- Migración 072 `grupo_ajeno_solo_admin`: `puede_escribir_grupo(group_id)` (SECURITY DEFINER); `sync_subgroup_rechazo` responde `PERMISSION` a un técnico sobre un grupo ajeno, después de `REFERENCIA_AJENA` y antes de los duplicados; las policies INSERT/UPDATE de `trees` y de `tree-photos` (`puede_escribir_foto` sobre `arbol_de_foto`) aplican la misma regla y `quitar_fotos_arboles` saltea los árboles de grupos ajenos; tabla `grupoAjeno` en `contracts/permisos-edicion.json`; pgTAP 55 (#797)
- Migración 073 `borrados_grupo_ajeno`: `sincronizar_borrados` borra árboles y grupos solo si pasan `puede_escribir_grupo`; en una plantación escribible el id ajeno se saltea en silencio; pgTAP 56 (#799)
- Migración 074 `grupo_nuevo_ajeno_solo_admin`: `sync_subgroup_rechazo` responde `PERMISSION` a un grupo nuevo sin `usuario_creador`, o a nombre de otro si quien sube no es admin; pgTAP 57 (#801)
- Migración 075 `conflictos_de_sincronizacion`: `sync_subgroup` acepta la base de cada dato (`base` del grupo, `gps_base` y `foto_base` por árbol) y, si el server tiene otro valor, conserva el suyo y lo devuelve en `conservados`; sin base pisa como antes (APK de prod). La foto viaja en un path por subida (`trees/<id>-<versión>.jpg`, que `arbol_de_foto` acepta) y la que pierde se anota en `fotos_quitadas`; el grupo conservado se resuelve antes del rechazo, sin falso `DUPLICATE_CODE`; pgTAP 58 (#805)
- Migración 076 `quitar_foto_con_base`: `quitar_fotos_arboles(p_arboles, p_bases DEFAULT NULL)` no quita una foto que cambió en el server y la devuelve en `conservados`; sin base quita como antes; pgTAP 59 (#815)
- Migración 077 `fotos_huerfanas`: `fotos_huerfanas_por_limpiar(p_limite)` (solo service role) lista los archivos de `tree-photos` que ningún `foto_url` usa, sin quitada pendiente y sin escribir hace más de 30 días (`fotos_huerfanas_antiguedad_minima()`); `limpiarFotosQuitadas` de `admin-plantaciones` los borra en tandas de 100, hasta 1000 por corrida, y responde `huerfanasBorradas`/`huerfanasPendientes`; el cron avisa lo que quedó. La función se deploya después de la 077; pgTAP 60 (#819)
- Migración 078 `stats_plantaciones_gps_fotos_tecnicos`: `stats_plantaciones` (DROP + CREATE) devuelve `puntos_gps`, `fotos` y `tecnicos uuid[]` (solo `rol_en_plantacion = 'tecnico'`) y deja de devolver `usuarios`. Suma `foto_subida(text)` IMMUTABLE, que comparte con `dashboard_arboles`, y hace REVOKE a `anon`. La web anterior ve Usuarios vacío hasta el deploy; pgTAP 61 (#838)
- Migración 079 `lugar_color_especie`: `plantation_species.lugar_color` con CHECK `>= 0` e índice único por plantación, relleno por `codigo COLLATE "C"` (ningún color cambia) y trigger BEFORE INSERT que asigna el menor lugar libre bajo un advisory lock por plantación. `aplicar_cambios_especies` procesa las bajas antes que las altas, y `reemplazar_especies_plantacion` toma el lock. Desde #865 la web lee la columna por nombre, así que en prod el push va apenas termina el deploy de la web; pgTAP 62 (#855, #865)
- Migración 080 `sync_no_escribe_ids_numericos`: `sync_subgroup_upsert_arboles` deja de escribir `plantacion_id` y `global_id`; un payload viejo que los trae sincroniza igual; pgTAP 63 (#856)
- Migración 081 `drop_ids_numericos`: dropea `trees.global_id`, `trees.plantacion_id`, `generate_tree_ids`, `next_global_id_seed` y `plantation_ids_status`, sin `CASCADE` e idempotente; se borran pgTAP 04, 05 y 09, y el 63 pasa a `63_ids_numericos_dados_de_baja`. Va apenas termina el deploy de la web de prod, con la consulta de pre-flight de su encabezado: la web de `main` exporta con `global_id` y llama a `plantation_ids_status`. El APK 1.3.0 deja de ofrecer CSV, Excel y KML en las plantaciones sin IDs; la web las exporta (#864)
- Migración 082 `admin_quita_fotos_finalizada`: `quitar_fotos_arboles` deja que un admin quite fotos en una plantación finalizada (en archivada, nadie); `puede_editar_finalizada` no cambia; pgTAP 64 (#907)
- `shared/` con funciones puras que importan web y mobile: `codigoPlantacion.ts`, que reemplaza las copias de cada app, `idParcial.ts` (orden del ID Parcial: alta del grupo, posición, id del grupo y del árbol), `instante.ts` (timestamps de Postgres y JS sin `Date.parse`, poco confiable en Hermes; lo reusa `textoDeConflicto.ts`) y `distancia.ts` (haversine, antes en `web/src/pdf/mapa/proyeccion.ts`); Metro (`watchFolders`), jest (`modulePaths`), vite, tsconfig, el lint web y `web-ci.yml` la incluyen, y `/deploy` cuenta un commit en `shared/` para las dos apps (#764, #808, #856)
- Contratos `contracts/permisos-edicion.json`, `contracts/sub-id.json` y `contracts/foto-local.json` (esquemas de foto local: `LOCAL_URI_SCHEMES` y `sqlIsLocalUri` en mobile, pgTAP 54), recorridos por pgTAP, web y mobile; `db-tests` y `web-ci` corren también con cambios en `contracts/**` (#739, #793)
- Las migraciones se aplican solo con `supabase db push` y quedan registradas en `supabase_migrations.schema_migrations`; ya no se archivan, y el skill `/migrar` arma el comando de push desde `origin/staging` u `origin/main` con su dry-run (#760, #767)
- Preferencias locales sobre `crearPreferencia<T>`/`usePreferencia<T>` (GPS, descarga de fotos, orden de árboles, botonera): la hidratación ya no pisa un valor elegido mientras lee y una falla de SecureStore deja el default; se borra `useSyncSetting` (#700, #770)
- Tipos de error de login como `AUTH_ERROR` as const, con predicados `esErrorDeConectividad`/`esErrorDeCuentaDesactivada` (#676)
- Re-descargar una plantación ya local no pisa su `pendingSync` (rama latente: la UI no ofrece re-descargarla) (#661)
- Se borra código muerto de mobile: `refreshing`/`handleRefresh` y el aviso de frescura de `usePlantaciones` (`checkFreshness`, que consultaba Supabase en cada foco de la lista sin que nadie lo mostrara), y el camino de conflicto de especie de `NNResolutionScreen`/`useNNResolution`, inalcanzable porque la pantalla solo lista árboles sin especie (#718, #727, #736)
- `docs/SPECS.md`: código de plantación, ID de Árbol y columnas del export (#703); decisión documentada: todo usuario de la organización ve el directorio completo (#686); checklist de configuración manual de Supabase y allowlist de Auth al día con los dos proyectos (#687, #709)
- Tests: pgTAP 33 a 37 e integración contra SQLite real (`plantation-campos-sync`, `especies-offline`, `tecnicos-offline`, `pendientes-varados`); fixtures `tests.crear_plantacion` para pgTAP y fábricas tipadas en `web/src/test/fabricas.ts` (#642, #643, #645, #648, #650, #651, #653, #714, #715)
- Mantenimiento de tests y lint: se van las 4 suites apagadas que quedaban en mobile (`group-lifecycle` y `sync-pipeline` rehechas contra código real, sin ningún `skip`), eslint de las dos apps llega a 0 warnings con tope `--max-warnings 0` en CI y los títulos de test pierden claves internas de planificación (#663, #664, #666)
- Skills: `/codebase-stats`, radiografía de la codebase con historial (suma `@vitest/coverage-istanbul` a web); `/push-update-apk` compara los nativos contra el APK del canal, incluidos los plugins efectivos de `app.config.js`; `/matriz-issues` suma bandeja de decisiones, relaciones y antigüedad; Claude también invoca `/issue`, y `/novedades` pone la fecha de la sincronización en el título de la sección en pruebas (#641, #694, #710, #696, #709, #858, #898)
- Base común de los PDF (`web/src/pdf/`): plantilla de marca (`Hoja` con encabezado y pie, `DocumentoPdf`, `emisionDePlantacion`, tokens con test contra `theme.css`), piezas del árbol compartidas por ficha y reporte (`pdf/arbol/`) y estilos y medidas comunes (`MEDIDA_PDF`, `puntoDeEspecie`, `rotuloEnMayusculas`, `interlineadoRenglon`, `memoria.ts`, `fuenteLeida.ts`). Los textos se sanean antes de medir y dibujar (`sanearTextos`, `renderizarSaneado`): un carácter sin glifo queda en su letra base o «?», y Helvetica ya no se descarta entre PDF, lo que tiraba `unitsPerEm` desde el segundo PDF. El logo se embebe una sola vez por documento: `pluginClaveImagenPdf` parchea `fetchImage` de `@react-pdf/layout` en `plugins` y `worker.plugins` (reporte de 7.000 árboles sin fotos: 3,36 → 1,40 MB). El encabezado lleva solo «Lugar · Período» (`lugarYPeriodo`), sin código ni organización, y ningún PDF lee ya la organización (#778, #877, #879, #886, #891, #895, #896, #904)
- `/deploy`: el `db push` de prod pasa al tope del checklist post-merge y se corre apenas el check «Cloudflare Pages» del merge en main da verde; `/migrar` y `docs/db-baseline.md` dicen lo mismo (#865)
- CSS sin dependencia del orden de carga: `.control` toma su padding de `--control-padding-derecho`/`--control-padding-vertical`, y las variantes que llegan por `className` van calificadas (`input.campoCodigo`, `.cabecera .busqueda`). El test `composicionCss.test.ts` falla si una clase que compone de otro módulo redeclara una propiedad de la compuesta (#791, #812, #820)
- Auditoría responsive (`npm run audit:responsive`): ancho 390, filas `dashboard-archivada`, `panel-filtros` y `panel-usuarios`, y X cuenta un diálogo que se sale de costado, con sus casos en `--autotest` (#852, #854)
- El test de ⌘K sin plantaciones espera el estado vacío en vez del disparador y deja de fallar de forma intermitente (#811)
- `TreeRegistrationScreen` baja de 400 a 189 líneas: diálogos, visor y botonera pasan a `useAccionesDeGrupo`, `useFotoDelVisor`, `useAccionesDeArbol`, `useTreeRegistrationScreen`, `TreeActionBar`, `BotoneraDeEspecies` y `ViewAllTreesRow`, con test propio; `removePhoto` usa `quitarFotoDelArbol` (#794, #818)

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
