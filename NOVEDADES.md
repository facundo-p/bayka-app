# Novedades de Bayka

Qué trae cada actualización de Bayka, contado para quienes usan la app. Este es
el changelog para compartir con usuarios y clientes: sin referencias internas ni
detalles técnicos (esos viven en [CHANGELOG.md](CHANGELOG.md)).

> El formato de abajo es **contrato**: lo lee la pantalla `/novedades` de la
> web, y cambiarlo la rompe. Está en `.claude/skills/deploy/SKILL.md`
> ("Contrato de formato"); leerlo antes de editar este archivo a mano.

## En pruebas · próxima versión
<!-- sincronizado-hasta: 72ae4ca #776 -->

- **Cada plantación tiene su código.** Al crear o editar una plantación cargás
  un código corto y único en la organización (por ejemplo, SS26-1), que pasa a
  formar el ID de sus árboles. Se ve en el listado y en el detalle, junto al
  período, y solo se cambia mientras la plantación está activa. Las
  plantaciones que ya existían recibieron el suyo. <!-- #691 #699 #764 -->
  - En la web de pruebas, entrá a Plantaciones → "Nueva plantación" y escribí
    "ab 12-x" en Código.
  - Creala y después intentá crear otra con el mismo código.
  - Esperá ver: el código queda "AB12-X" y aparece en el listado y en el
    detalle; el repetido se marca en el campo con "Ya existe otra plantación
    con ese código." sin cerrar el formulario.
- **Cada árbol tiene un ID único en toda la organización.** Es su SubID más el
  código de la plantación (por ejemplo, LP1L23BANC12-SS26-1). En Datos →
  Árboles reemplaza a la columna SubID y titula el detalle del árbol, y podés
  pegarlo entero en la búsqueda global o en el buscador de Árboles para
  encontrar ese árbol. <!-- #699 #717 -->
  - En la web de pruebas, abrí una plantación → Datos → Árboles y copiá el ID
    de un árbol.
  - Pegalo en la búsqueda (Ctrl/⌘ K) y después en "Buscar SubID…".
  - Esperá ver: la columna "ID Árbol", el ID como título del detalle, y en las
    dos búsquedas solo ese árbol; un SubID parcial sigue encontrando como
    antes.
- **Las exportaciones llevan el ID Árbol.** El Excel y el CSV suman el ID Árbol
  como primera columna, y en el KML cada punto se llama con ese ID, no con el
  nombre de la especie. <!-- #703 #721 -->
  - En la web de pruebas, abrí una plantación con los IDs generados →
    Exportar → "Exportar Excel" y después "Descargar KML".
  - Abrí el Excel y cargá el KML en Google Earth.
  - Esperá ver: la primera columna del Excel es "ID Árbol" y cada punto del
    mapa se llama con el ID de su árbol.
- **La búsqueda te lleva directo a la parcela o al grupo.** Elegir una parcela
  o un grupo en la búsqueda global abre su sección con el código ya buscado,
  así ves la fila que elegiste. Parcelas y Grupos suman su propio buscador por
  código o nombre, y los grupos de la búsqueda global muestran de qué
  plantación son. <!-- #688 #722 -->
  - En la web de pruebas, abrí la búsqueda (Ctrl/⌘ K) y escribí el código de
    un grupo que exista en más de una plantación (por ejemplo, L1).
  - Elegí uno de los grupos.
  - Esperá ver: cada grupo con «lugar · Parcela …» debajo y, al elegirlo,
    Datos → Grupos con el código en "Buscar por código o nombre…" y su fila a
    la vista.
- **Cambiá la especie de un árbol desde la web.** En el detalle de un árbol, el
  bloque Especie suma «Cambiar»: elegís otra especie de la plantación y el ID
  del árbol toma su código. Si alguien la cambió desde otro lado mientras
  tanto, te avisa y muestra la que quedó. <!-- #731 -->
  - En la web de pruebas, como administrador, abrí una plantación activa →
    Datos y tocá un árbol.
  - En Especie tocá «Cambiar», elegí otra especie y guardá.
  - Esperá ver: la especie y el ID nuevos en el panel, la tabla, el mapa y el
    dashboard. En una plantación finalizada «Cambiar» solo lo ve el
    superadmin, y en una archivada no aparece.
- **Clasificá las especies en árbol o arbusto.** Cada especie tiene tipo, por
  ahora Flora, y subtipo: Árbol o Arbusto. Las que ya existían quedan como
  Árbol. El listado de Especies suma la columna Subtipo y un filtro por
  subtipo. <!-- #775 -->
  - En la web de pruebas, entrá a Especies y abrí una especie.
  - Elegí «Arbusto» en Subtipo, guardá y filtrá por «Subtipo: arbusto».
  - Esperá ver: la especie aparece en el filtro con subtipo Arbusto, las demás
    siguen en Árbol y una especie nueva arranca en Árbol.
- **Las especies científicas tienen su propia pestaña.** En Especies, la
  pestaña Científicas reúne cada nombre científico con los nombres comunes que
  agrupa. Ahí se crean, se renombran y se eliminan, la búsqueda (Ctrl/⌘ K) las
  encuentra, y en cada especie el nombre científico se elige de esa lista en
  vez de escribirse a mano. Los que ya estaban cargados aparecen vinculados a
  sus especies. <!-- #776 -->
  - En la web de pruebas, entrá a Especies → Científicas y creá «Prosopis
    alba».
  - En Comunes abrí una especie, elegile «Prosopis alba» y guardá. Después
    renombrá la científica.
  - Esperá ver: la científica lista esa especie y deja de verse atenuada, el
    nombre nuevo aparece en la columna «Nombre científico» de Comunes y
    «Eliminar» queda deshabilitado mientras agrupe especies.
- **Editar una plantación no pisa lo que otro cambió mientras tanto.** Si
  alguien cambió el mismo dato desde otra pestaña o desde la app mientras
  editabas, la web te avisa, guarda el resto y te muestra el valor actual. Vale
  para el formulario de la plantación y para la configuración de GPS,
  visibilidad y foto. <!-- #648 -->
  - En la web de pruebas, abrí la misma plantación en dos pestañas y en las
    dos tocá Editar.
  - En una cambiá el objetivo y guardá; en la otra cambiá el objetivo y la
    descripción y guardá.
  - Esperá ver: el aviso de que alguien cambió algunos datos, el objetivo con
    el valor de la primera pestaña y la descripción guardada.
- **Vaciar un dato opcional de la plantación ahora se guarda.** Borrar la
  descripción, la fecha de inicio o el objetivo desde Editar deja el campo
  vacío; antes volvía el valor anterior. <!-- #648 -->
  - En la web de pruebas, abrí una plantación con descripción → Editar.
  - Borrá la descripción, guardá y recargá la página.
  - Esperá ver: la plantación queda sin descripción.
- **Especies por nombre y sin pisar los cambios de la app.** La configuración
  de especies muestra el catálogo en orden alfabético, el mismo de la botonera
  de la app, y cada cambio toca solo la especie que marcaste o desmarcaste: ya
  no deshace lo que un celular cambió en otras. <!-- #650 #642 -->
  - En la web de pruebas, abrí una plantación → Configuración → Especies.
  - Con la app Bayka TEST en modo avión, quitá una especie sin árboles de esa
    plantación; en la web habilitá otra distinta y después sincronizá la app.
  - Esperá ver: el listado en orden alfabético con el pie "En la app se
    ordenan por nombre", y los dos cambios en la web y en la app.
- **Editar una plantación finalizada es solo del superadmin.** Un administrador
  ve «Editar» deshabilitado en una plantación finalizada, con el motivo, en vez
  de cargar cambios que no se guardaban. <!-- #742 -->
  - En la web de pruebas, como administrador, abrí una plantación finalizada.
  - Pasá el mouse por el lápiz de Editar.
  - Esperá ver: el botón deshabilitado con «Solo el superadmin edita una
    plantación finalizada»; como superadmin, sigue habilitado.
- **Descargá la foto de un árbol.** El detalle de un árbol suma un botón
  Descargar debajo de la foto; el archivo lleva la plantación y el SubID en
  el nombre. <!-- #726 -->
  - En la web de pruebas, abrí una plantación → Datos → Árboles y tocá un
    árbol con foto.
  - Tocá «Descargar» debajo de la foto.
  - Esperá ver: se descarga un archivo foto-<lugar>-<período>-<SubID>.jpg con
    la foto del árbol.
- **La web abre más rápido las plantaciones grandes.** El listado de
  plantaciones, el dashboard y la pestaña Datos ya no descargan todos los
  árboles para contarlos, y el mapa se carga recién cuando hay puntos para
  mostrar. <!-- #758 #761 -->
  - En la web de pruebas, abrí la plantación con más árboles.
  - Mirá el Dashboard, con su mapa, y después la pestaña Datos.
  - Esperá ver: los dos cargan casi enseguida, el mapa muestra los árboles y
    el total del dashboard coincide con la suma de la columna Árboles de las
    parcelas en Datos.
- **Todos los datos de la plantación, desde la app.** Al crear o editar una
  plantación cargás lugar, periodo, fecha de inicio, objetivo de árboles,
  descripción, GPS obligatorio y su frecuencia, foto en todos los botones y si
  la ven los técnicos. La fecha se elige con el calendario del celular. Se
  guarda sin señal y sube al sincronizar. <!-- #645 #677 -->
  - En la app Bayka TEST, como administrador y en modo avión, creá una
    plantación completando todos los campos.
  - Sincronizá; después, desde su engranaje → "Editar plantación", cambiá el
    objetivo y "Visible para técnicos" y volvé a sincronizar.
  - Esperá ver: en la web de pruebas, la plantación con todos los datos tal
    como los cargaste en el celular, la fecha sin correrse un día, también
    después de editarla.
- **Te avisa si ya hay una plantación con el mismo lugar y periodo.** Mientras
  escribís, el formulario compara con las plantaciones del celular sin
  distinguir mayúsculas; al subirla, con las de toda la organización. El aviso
  no frena la creación. <!-- #645 #656 -->
  - En la app Bayka TEST, creá una plantación con el lugar y el periodo de una
    que ya tenés en el celular, escritos con otras mayúsculas.
  - Con señal, creá otra igual a una plantación de la web de pruebas que el
    celular no tenga descargada.
  - Esperá ver: en el primer caso el aviso amarillo "Ya tenés una …" debajo
    del lugar y periodo; en el segundo, el aviso "Mismo lugar y periodo" al
    crear. En los dos, la plantación se crea igual.
- **La app también pide el código de la plantación.** Al crear o editar una
  plantación en el celular cargás su código, en mayúsculas y hasta 8
  caracteres, y la app te avisa si otra plantación ya lo usa. Si la creaste
  sin conexión y al sincronizar resulta repetido, la tarjeta te avisa que no
  se pudo subir hasta que lo cambies. <!-- #703 #764 -->
  - En la web de pruebas, creá una plantación con el código PRUEBA1.
  - En la app Bayka TEST, en modo avión, creá una plantación con ese mismo
    código; después sacá el modo avión y sincronizá.
  - Esperá ver: la tarjeta avisa que otra plantación de la organización ya usa
    ese código; al editarla y cambiarle el código, se sube en la próxima
    sincronización.
- **Si un dato cambió en la app y en la web, elegís cuál queda.** Editar una
  plantación ya no pisa lo que otro cambió desde la web: lo que no choca se
  sube, y la pantalla "Resolver cambios" muestra, por cada dato que cambió en
  los dos lados, tu valor, el de la web con quién y cuándo lo cambió, y el
  anterior. <!-- #648 -->
  - En la app Bayka TEST, en modo avión, cambiá el objetivo y la descripción
    de una plantación; en la web de pruebas cambiá el objetivo de la misma.
  - Recuperá la señal, sincronizá y tocá "Resolver" en el resumen (o "Cambios
    por resolver" en la tarjeta); elegí tu valor y guardá la elección.
  - Esperá ver: la descripción subió sin aviso, y después de elegir y
    sincronizar la web muestra el objetivo que elegiste.
- **Configurá las especies de una plantación sin señal.** Los cambios se
  guardan en el celular y suben al sincronizar, sin pisar lo que se cambió
  desde la web en otras especies. Si quitaste una especie que ya tenía árboles
  cargados desde otro celular, el resumen de la sincronización te avisa y la
  especie vuelve a la botonera. <!-- #650 -->
  - En la app Bayka TEST, en modo avión, habilitá una especie y quitá otra sin
    árboles en una plantación ya sincronizada; en la web de pruebas habilitá
    o quitá una especie distinta de la misma plantación.
  - Recuperá la señal y sincronizá.
  - Esperá ver: la botonera cambia apenas guardás, aun sin señal, y después de
    sincronizar quedan los dos cambios en la app y en la web.
- **Las especies del celular quedan al día con la web.** Una especie que se
  quita desde la web deja de aparecer en la botonera al sincronizar, y una
  especie que ya tiene árboles no se puede destildar en la configuración de la
  app. <!-- #642 #650 -->
  - En la web de pruebas, quitá una especie sin árboles de una plantación que
    tengas descargada en la app Bayka TEST, y sincronizá la app.
  - Abrí "Configurar especies" de una plantación con árboles.
  - Esperá ver: la especie quitada ya no está en la botonera, y las que tienen
    árboles muestran el candado y no se pueden destildar.
- **Asigná técnicos sin señal.** "Asignar técnicos" funciona en modo avión con
  la lista de técnicos de la última sincronización, y la asignación sube al
  sincronizar. Quitar a un técnico sigue pidiendo conexión. <!-- #651 -->
  - En la app Bayka TEST, como administrador, sincronizá una vez con señal.
  - En modo avión, abrí el engranaje de una plantación → "Asignar técnicos",
    asigná uno, guardá y volvé a abrir la pantalla.
  - Esperá ver: el técnico con "Se asignará al sincronizar", los ya asignados
    sin poder quitarse y la ayuda "Quitar técnicos requiere conexión a
    internet"; al sincronizar, el técnico ve la plantación.
- **Reabrí una plantación finalizada desde la app.** Un superadmin ya no
  necesita la web: el engranaje de una finalizada ofrece "Reabrir plantación",
  con la misma confirmación que la web. Requiere conexión. <!-- #644 -->
  - En la app Bayka TEST, como superadmin, abrí el engranaje de una plantación
    finalizada → "Reabrir plantación" y confirmá.
  - Repetí en modo avión con otra plantación finalizada.
  - Esperá ver: la plantación queda activa, con Configurar especies, Asignar
    técnicos y Finalizar disponibles, y la web la muestra activa; sin señal la
    opción aparece gris con "Reabrir requiere conexión a internet".
- **Te avisa cuando hay cambios que no pueden subir.** Si la plantación se
  finalizó, se archivó o se eliminó en el servidor, o perdiste el permiso, su
  tarjeta dice cuántos cambios quedaron sin subir y por qué. Si la reabren o
  te devuelven el permiso, suben solos; si no, "Descartar" te dice qué se
  pierde antes de borrarlos. <!-- #653 -->
  - En la app Bayka TEST, cargá un grupo sin señal en una plantación,
    archivala o finalizala desde la web de pruebas y sincronizá la app.
  - Desarchivala o reabrila desde la web y volvé a sincronizar; después repetí
    el primer paso y tocá "Descartar".
  - Esperá ver: el aviso "N cambios no se pudieron subir" con el motivo, que
    desaparece al sincronizar después de reabrir; al descartar, la
    confirmación lista qué se pierde y la plantación queda como en el servidor.
- **Las parcelas ya sincronizadas las edita y borra un administrador.** El
  técnico sigue creando parcelas y puede corregir o borrar las que creó en su
  celular mientras no se sincronizaron; borrar una parcela sin sincronizar
  pide confirmación porque no queda copia en el servidor. <!-- #643 #657 -->
  - En la app Bayka TEST, como técnico y en modo avión, creá una parcela,
    mantenela presionada, cambiale el nombre y guardá.
  - Sincronizá y volvé a mantenerla presionada.
  - Esperá ver: antes de sincronizar se edita; después ya no abre la edición y
    la web la muestra con el nombre corregido. Un administrador sigue editando
    y borrando como antes.
- **Cambiá la especie de un árbol desde la app.** En el detalle de un árbol de
  un grupo que cargaste, «Cambiar especie» abre un buscador por nombre común o
  científico. En un grupo finalizado te ofrece reabrirlo y cambiar en un solo
  paso. Si la especie también se cambió desde la web, al sincronizar queda la
  de la web y la app te avisa. <!-- #731 -->
  - En la app Bayka TEST, abrí un grupo activo que hayas cargado → «Ver todos
    los árboles» → tocá un árbol.
  - Tocá «Cambiar especie», elegí otra y sincronizá.
  - Esperá ver: el aviso «Especie cambiada» con el ID nuevo, y el árbol con la
    especie nueva en la web de pruebas.
- **Cada árbol muestra su ID en la app.** El detalle de un árbol muestra el ID
  completo, con el código de la plantación al final. Como ese ID se arma con
  los códigos de la parcela y del grupo, al cambiar uno de esos códigos la app
  te avisa antes cuántos árboles cambian de ID. <!-- #703 -->
  - En la app Bayka TEST, sincronizá, abrí una plantación con árboles y tocá
    un árbol de un grupo.
  - Volvé, mantené apretado ese grupo, cambiale el código y guardá.
  - Esperá ver: el ID del árbol termina en el código de la plantación, y antes
    de guardar el código nuevo aparece "Cambian los IDs de los árboles" con la
    cantidad; si cancelás, no se guarda.
- **Las exportaciones de la app llevan el ID Árbol.** El CSV y el Excel suman el
  ID Árbol como primera columna, y en el KML cada punto se llama con ese ID; el
  SubID pasa a la descripción. <!-- #703 #721 -->
  - En la app Bayka TEST, como administrador, tocá el engranaje de una
    plantación finalizada con los IDs generados.
  - Exportá el Excel y el KML.
  - Esperá ver: la primera columna del Excel es "ID Árbol" y en Google Earth
    cada punto se llama con el ID de su árbol.
- **La cámara se abre directo.** Ya no aparece el menú «Agregar foto»: tocar
  N/N, una especie con foto, o agregar o reemplazar la foto de un árbol abre la
  cámara, y la galería se elige con el botón «Galería» que está adentro. Si la
  foto es opcional, «Sin foto» registra el árbol sin foto; sin permiso de
  cámara podés elegir de la galería. <!-- #772 #660 -->
  - En la app Bayka TEST, entrá a un grupo activo y tocá N/N.
  - Tocá «Galería», elegí una foto y en el recorte tocá «Reintentar».
  - Esperá ver: la cámara sin menú previo, la foto de la galería pasa por el
    recorte, «Reintentar» vuelve a la cámara, y cerrar con la X o con atrás no
    registra nada.
- **Fotografiá el árbol seleccionado sin salir de la botonera.** Un botón de
  cámara junto al engranaje le saca la foto al árbol elegido en la tira. Si ya
  tiene foto, primero te avisa que la vas a reemplazar. <!-- #773 -->
  - En la app Bayka TEST, en un grupo activo registrá dos árboles sin foto y
    tocá el primero en la tira.
  - Tocá el botón de cámara y sacá la foto; después tocalo de nuevo.
  - Esperá ver: la foto queda en el árbol que elegiste y no en el último, y la
    segunda vez aparece el aviso «Reemplazar la foto» antes de la cámara.
- **Quitar o reemplazar una foto te pide confirmación.** Antes de borrar o
  pisar la foto de un árbol, la app avisa que no se puede deshacer y si el
  cambio llega a Bayka y a los demás celulares. Desde el detalle del árbol,
  «Ver actual» te muestra la foto antes de decidir. <!-- #723 #729 #771 -->
  - En la app Bayka TEST, abrí el listado de un grupo y entrá al detalle de un
    árbol con foto.
  - Tocá «Cambiar foto» → «Ver actual»; cerrá la foto y tocá «Quitar».
  - Esperá ver: el aviso «Reemplazar la foto» con Cancelar, Ver actual y
    Reemplazar; desde la foto ampliada, «Reemplazar» abre la cámara sin volver
    a preguntar; «Quitar» pide confirmación y Cancelar deja la foto.
- **Guardá o compartí la foto de un árbol.** El visor de fotos suma dos
  botones arriba a la derecha: Guardar deja una copia en el álbum «Bayka» de
  la galería y Compartir la manda por la app que elijas. Si la foto está solo
  en la nube, primero se descarga. <!-- #726 -->
  - En la app Bayka TEST, abrí la foto de un árbol desde el listado de un
    grupo.
  - Tocá Guardar (la flecha hacia abajo) y después Compartir.
  - Esperá ver: el aviso «Guardada en el álbum Bayka», la foto en ese álbum
    con la plantación y el SubID en el nombre, y la hoja de compartir del
    teléfono.
- **Elegí si bajar las fotos de otros celulares.** Las fotos que sacás en el
  celular se suben siempre al sincronizar; lo que podés apagar, en Ajustes →
  Fotos o en el aviso de sincronizar, es bajar las de los demás. Las que no
  bajaste se ven con una nube y se descargan de a una. Reemplaza al «Incluir
  fotos» del aviso de sincronizar: si lo tenías apagado, sigue apagado.
  <!-- #700 -->
  - En la app Bayka TEST, apagá «Descargar fotos de otros celulares» en
    Ajustes → Fotos.
  - Sincronizá una plantación con fotos sacadas en otro celular y abrí el
    detalle de uno de esos árboles.
  - Esperá ver: la nube en el listado, «Foto sin descargar en este celular»
    en el detalle y, al tocar «Descargar», la foto.
- **Liberá espacio en el celular.** En Ajustes → Fotos, «Liberar espacio»
  borra del celular las fotos que ya están en la nube, sin quitarlas de Bayka
  ni de los demás celulares. Antes de confirmar te dice cuántas fotos y cuánto
  espacio libera; las fotos sin subir se conservan. <!-- #700 -->
  - En la app Bayka TEST, con fotos ya sincronizadas, sacá una foto nueva sin
    sincronizar y entrá a Ajustes → Fotos.
  - Tocá «Liberar espacio · N fotos, X MB» y confirmá.
  - Esperá ver: el aviso de cuánto se libera y de que la foto sin subir se
    conserva; después las fotos liberadas muestran la nube, la nueva sigue en
    el celular y en la web no falta ninguna.
- **Sabé cuánto pesan las fotos antes de descargar una plantación.** En el
  catálogo, cada plantación muestra el peso de sus fotos y «Incluir fotos»
  suma el total de las que seleccionaste. <!-- #765 -->
  - En la app Bayka TEST, abrí el catálogo de plantaciones.
  - Seleccioná una o dos plantaciones con fotos.
  - Esperá ver: en cada tarjeta, junto a grupos y árboles, el peso de las
    fotos (por ejemplo, «41 MB»), y abajo «Incluir fotos · <total>»; una
    plantación sin fotos no muestra peso.
- **El catálogo se actualiza solo y abre más rápido.** Cada vez que entrás al
  catálogo ves las plantaciones nuevas sin reiniciar la app, y deslizando
  hacia abajo lo actualizás a mano sin perder lo que tenías seleccionado. Si
  te quedás sin conexión, sigue mostrando la última lista con un aviso.
  <!-- #718 #758 -->
  - En la app Bayka TEST, entrá al catálogo (el botón de descarga de
    Plantaciones) y volvé.
  - Creá en la web de pruebas una plantación asignada a tu usuario y volvé a
    entrar al catálogo; seleccioná una, filtrá por estado, deslizá hacia
    abajo y después poné el modo avión.
  - Esperá ver: el catálogo aparece enseguida, con la plantación nueva sin
    reiniciar la app, la selección y el filtro intactos después de deslizar,
    y sin conexión la lista con el aviso "Sin conexión · se muestra la última
    lista cargada".
- **Elegí el tamaño y el orden del código y del nombre en la botonera.** En
  Opciones de la carga de árboles, «Tamaño de la botonera» te deja poner
  arriba el código o el nombre y agrandar o achicar la letra de cada uno, con
  vista previa. Se aplica al instante, también en la resolución de N/N, queda
  guardado para tu usuario en este celular y «Restablecer el diseño original»
  lo deshace. <!-- #770 -->
  - En la app Bayka TEST, entrá a un grupo activo y tocá el engranaje.
  - En «Tamaño de la botonera» elegí «Nombre arriba» y subí la letra del
    nombre.
  - Esperá ver: la vista previa y la botonera con el nombre arriba, en
    negrita y más grande, y que se mantiene al cerrar y abrir la app.
- **Ordená los árboles de un grupo del último al primero.** El listado de
  árboles de un grupo suma un botón que alterna entre 1→N y N→1, así lo último
  que registraste queda arriba. La app recuerda tu elección para todos los
  grupos, aunque la cierres. <!-- #725 -->
  - En la app Bayka TEST, abrí un grupo con varios árboles → "Ver todos los
    árboles".
  - Tocá el botón «1→N» de arriba, salí, entrá a otro grupo y después cerrá y
    volvé a abrir la app.
  - Esperá ver: el listado sigue de N a 1 en todos los grupos, también en los
    finalizados, y la tira deslizable de árboles conserva su orden.
- **Editar un grupo se ve como los demás formularios.** "Editar grupo" se abre
  en pantalla completa, igual que "Nuevo grupo", y el botón Guardar queda
  siempre a la vista, arriba del teclado. <!-- #716 -->
  - En la app Bayka TEST, abrí una parcela y mantené presionado un grupo.
  - Tocá el nombre para que se abra el teclado.
  - Esperá ver: "Editar grupo" en pantalla completa, con Cancelar y Guardar
    visibles arriba del teclado.
- **El visor de fotos ya no queda tapado por las barras del teléfono.** La X
  y los botones Reemplazar y Eliminar foto respetan la barra de estado y la de
  navegación. <!-- #719 -->
  - En la app Bayka TEST, en un teléfono con muesca o navegación por gestos,
    abrí la foto de un árbol desde el listado de un grupo.
  - Mirá los bordes de arriba y de abajo.
  - Esperá ver: la X debajo de la barra de estado y los botones de abajo por
    encima de la barra de gestos.
- **Sin permiso de edición, el visor de fotos no ofrece cambiarla.** En un
  grupo de otro técnico o de una plantación finalizada o archivada, la foto se
  ve sin Reemplazar ni Eliminar foto. <!-- #769 -->
  - En la app Bayka TEST, abrí un grupo de otro técnico.
  - Tocá el ícono de foto de un árbol.
  - Esperá ver: la foto, con Guardar y Compartir arriba, y sin Reemplazar ni
    Eliminar foto abajo.
- **En un celular compartido, cada uno trabaja con su cuenta.** Si entrás sin
  conexión en un celular donde antes entró otra persona, lo que cargás queda a
  tu nombre y ves tu propio perfil. Al volver la señal, la app te pide iniciar
  sesión con conexión antes de sincronizar, así nada se sube a nombre de otro.
  Después de actualizar, cada cuenta tiene que entrar una vez con conexión para
  poder volver a entrar sin conexión. <!-- #662 #669 #695 -->
  - En la app Bayka TEST, con conexión, entrá con una cuenta A y cerrá sesión;
    repetí con una cuenta B.
  - En modo avión, entrá con A, creá un grupo y abrí Perfil.
  - Sacá el modo avión y sincronizá; cuando lo pida, entrá como A con conexión
    y volvé a sincronizar.
  - Esperá ver: el grupo figura como creado por A y Perfil muestra los datos de
    A; el primer intento de sincronizar muestra "Iniciá sesión" y, después de
    entrar como A, sincroniza.
- **Entrar con señal débil ya no te hace esperar.** En un wifi sin internet, una
  cuenta que ya usaste en el celular entra al instante. Si el servidor tarda en
  responder al iniciar sesión, la app termina de entrar cuando contesta y esa
  cuenta queda lista para entrar sin conexión. Y sincronizar con señal floja
  avisa que no se pudo conectar, en vez de pedirte que inicies sesión de
  nuevo. <!-- #670 #675 #669 -->
  - En la app Bayka TEST, conectate a un wifi sin salida a internet (por
    ejemplo, el hotspot de otro celular sin datos).
  - Iniciá sesión con una cuenta que ya usaste en este celular.
  - Esperá ver: entra al instante, sin quedarse unos segundos esperando al
    servidor.
- **Al volver la señal, la app actualiza tu cuenta.** Si abriste la app sin
  conexión, cuando se conecta actualiza tu rol y, si un administrador desactivó
  tu cuenta, cierra la sesión, sin que tengas que reiniciarla. <!-- #670 -->
  - En la app Bayka TEST, con la sesión iniciada, cerrá la app, poné el celular
    en modo avión y volvé a abrirla.
  - En la web de pruebas, desactivá esa cuenta; después sacá el modo avión en
    el celular.
  - Esperá ver: sin reiniciar la app, se cierra la sesión y aparece la pantalla
    de inicio de sesión.

## Web 1.4.0 · Mobile 1.3.0 · 24 de septiembre de 2026

- **Reabrí una plantación finalizada.** Si una plantación se finalizó y quedó
  trabajo sin subir en algún celular, un superadmin puede volver a activarla
  desde «⋯ Más acciones»: la app acepta registros de nuevo y lo pendiente se
  puede sincronizar. Los grupos que ya estaban finalizados siguen así.
  - En la web de pruebas, como superadmin, abrí una plantación finalizada →
    «⋯ Más acciones» → "Reabrir plantación".
  - Confirmá y mirá el detalle y el listado.
  - Esperá ver: la confirmación avisa que los grupos finalizados siguen
    finalizados; al confirmar la plantación queda activa y Editar y
    Configuración vuelven a estar disponibles.
- **La configuración de especies se guarda entera o no se guarda.** Al aplicar
  varios cambios juntos ya no puede quedar a medias —una especie que quitaste,
  todavía habilitada— ni guardarse un orden distinto del que muestra la
  pantalla.
  - En la web de pruebas, abrí una plantación → Configuración → Especies.
  - En el mismo lote quitá una especie habilitada, agregá dos del catálogo y
    aplicá.
  - Esperá ver: al recargar quedan exactamente las especies que elegiste, en el
    mismo orden en que las viste en pantalla.
- **Asignar técnicos sin señal te avisa en vez de quedarse cargando.** En la
  app, la pantalla de asignar técnicos ya no se queda en "Cargando técnicos…"
  para siempre cuando no hay conexión.
  - En la app Bayka TEST, entrá una vez con conexión para que quede guardada tu
    organización.
  - Poné el celular en modo avión y abrí una plantación → "Asignar técnicos".
  - Esperá ver: el aviso de que no hay conexión, en vez del cargando infinito.
- **Las especies nuevas ya no desaparecen del celular.** Una especie agregada
  desde la web sigue en la app aunque la cierres, y sus árboles muestran su
  código en vez de "??".
  - En la app Bayka TEST, con una especie creada en la web de pruebas y
    asignada a una plantación, sincronizá y registrá un árbol con esa especie.
  - Cerrá la app del todo y volvé a abrirla, sin sincronizar.
  - Esperá ver: el árbol con el código de la especie nueva y el botón de la
    especie todavía disponible.
- **Cambiar el código de una parcela o de un grupo actualiza sus árboles.** El
  SubID de los árboles ya registrados toma el código nuevo, en tu celular, en
  la web y en los demás celulares al sincronizar.
  - En la app Bayka TEST, abrí una plantación con árboles registrados y
    cambiá el código de una parcela (por ejemplo, de P1 a P9) y el de uno de
    sus grupos.
  - Sincronizá y abrí esa plantación en la web de pruebas → Datos → un árbol
    del grupo.
  - Esperá ver: el SubID empieza con los códigos nuevos, en la app y en la
    web, y otro celular lo ve igual después de sincronizar.

## Web 1.3.0 · Mobile 1.2.0 · 19 de septiembre de 2026

- **Archivá plantaciones sin borrarlas.** Desde «⋯ Más acciones» podés archivar
  una plantación: desaparece de los listados, de la búsqueda y de la temporada
  activa, queda en solo lectura y la desarchivás cuando quieras. El listado suma
  el filtro "Archivadas".
  - En la web de pruebas, abrí una plantación activa → «⋯ Más acciones» →
    "Archivar plantación" y confirmá.
  - Volvé a Plantaciones, probá los filtros y buscá la plantación con Ctrl/⌘ K.
  - Esperá ver: la plantación solo con el filtro "Archivadas", el detalle con la
    etiqueta "Archivada", Editar y Configuración bloqueados, Exportar
    disponible, y en «⋯» la opción "Desarchivar plantación".
- **Eliminá plantaciones de verdad.** Sin grupos ni árboles, cualquier
  administrador la elimina con una confirmación simple. Con datos, solo un
  superadmin, solo si está archivada y escribiendo su nombre: el aviso muestra
  cuántas parcelas, grupos, árboles y fotos se borran y que lo no sincronizado
  de los celulares se pierde. Si alguna foto no se pudo borrar, el superadmin
  puede reintentar la limpieza desde el mismo aviso.
  - En la web de pruebas, como administrador, abrí una plantación con grupos →
    «⋯ Más acciones» → "Eliminar plantación".
  - Como superadmin, archivá esa plantación, repetí "Eliminar plantación" y
    escribí su nombre.
  - Esperá ver: al administrador le ofrece archivar en vez de eliminar; al
    superadmin le pide el nombre exacto, muestra los conteos y, al confirmar,
    "La plantación se eliminó." y ya no aparece en ningún filtro.
- **Eliminá usuarios.** Un superadmin puede eliminar a una persona desde el
  menú «⋯» o desde su panel. Si no registró datos se borra por completo; si
  registró, queda bloqueada para siempre, su nombre se conserva en el historial
  y su email se libera para volver a invitarla. Los eliminados se ven con el
  filtro "Eliminados".
  - En la web de pruebas, como superadmin, en Usuarios abrí el «⋯» de un
    técnico con árboles cargados y tocá "Eliminar".
  - Confirmá y después elegí el filtro "Eliminados".
  - Esperá ver: el aviso dice cuántos registros tiene y que queda bloqueado; la
    persona desaparece de "Todos" y aparece en "Eliminados" con la etiqueta
    "Eliminado", sin acciones.
- **La web en el celular, pensada para el celular.** El menú es una barra fija
  abajo, al alcance del pulgar; arriba quedan el logo, una lupa para buscar y
  tu avatar. El botón de alta es un "+" junto al título, y los filtros de cada
  listado se abren en una hoja desde abajo, se aplican al toque y muestran
  cuántos hay activos.
  - En la web de pruebas, desde el celular, entrá a Plantaciones y tocá cada
    ítem de la barra de abajo, la lupa y el "+".
  - Tocá "Filtros", elegí "Finalizadas" y después "Ver N plantaciones".
  - Esperá ver: los tres ítems fijos abajo mientras bajás, el "+" en la misma
    línea que el título, la tabla cambiando apenas tocás el filtro y el botón
    "Filtros" con un número.
- **Cerrar sesión pregunta antes.** Tocás tu avatar al pie del menú y la web te
  muestra quién sos y te pide confirmar; ya no hay un ícono que te saque de
  una. Vale también en la computadora.
  - En la web de pruebas, tocá tu avatar al pie del menú y elegí "Cancelar";
    volvé a abrirlo y tocá "Cerrar sesión".
  - Esperá ver: con "Cancelar" seguís adentro; con "Cerrar sesión" volvés a la
    pantalla de inicio de sesión.
- **Buscá sin preocuparte por las tildes.** En Plantaciones, Especies, Usuarios
  y el buscador rápido, "rio" encuentra "Río" y "lucia" encuentra "Lucía".
  - En la web de pruebas, en Plantaciones escribí en el buscador un nombre con
    tilde sin ponerla; repetilo en Especies, en Usuarios y con Ctrl/⌘ K.
  - Esperá ver: los mismos resultados que si hubieras escrito la tilde.
- **Los avisos de error dicen qué pasó.** Cuando algo no se pudo guardar, el
  aviso distingue si estás sin conexión, si no tenés permiso o si el servidor
  rechazó el cambio, con el motivo. Antes todo decía "Revisá tu conexión".
  - En la web de pruebas, editá una plantación y guardá con la conexión
    cortada; después reconectá y guardá un cambio normal.
  - Esperá ver: sin conexión, "No se pudo guardar la plantación. Revisá tu
    conexión y probá de nuevo."; con conexión, se guarda sin aviso.
- **Tablas y Configuración más claras en el celular.** Un degradado en el borde
  de la tabla avisa que sigue hacia el costado, y los textos de ayuda de
  Configuración se leen completos en vez de cortarse.
  - En la web de pruebas, desde el celular, deslizá la tabla de Plantaciones
    hacia los costados y después abrí una plantación → Configuración.
  - Esperá ver: el degradado del lado donde quedan columnas escondidas, que
    desaparece al llegar al final, y el texto de ayuda de cada sección entero.
- **Plantación archivada en la app.** Si un administrador archiva una
  plantación, en la app queda en solo lectura con la franja "Plantación
  archivada" y no se ofrece para descargar. Lo que tengas sin subir sigue
  guardado: al sincronizar la app te explica que está archivada y sube todo
  cuando la desarchiven.
  - En la app Bayka TEST, como técnico, creá un grupo sin conexión en una
    plantación; desde la web de pruebas, un administrador la archiva.
  - En el celular, sincronizá; después desarchivala desde la web y sincronizá
    de nuevo.
  - Esperá ver: la primera vez, el aviso de plantación archivada y el grupo
    sigue pendiente, con la franja "Plantación archivada" y sin el botón "+"
    en el detalle; la segunda vez, el grupo sube.
- **Plantación eliminada en el servidor.** Si un superadmin elimina una
  plantación que tenés descargada, la app la marca "Eliminada en el servidor",
  queda en solo lectura y sus pendientes ya no encienden el punto naranja. La
  sincronización de todas las plantaciones te lista cuáles se eliminaron o te
  quitaron. "Eliminar del dispositivo" cuenta grupos, parcelas, fotos y
  borrados sin subir, pide una segunda confirmación y libera el espacio de las
  fotos.
  - En la app Bayka TEST, con una plantación descargada y un grupo sin subir,
    pedí que un superadmin la elimine desde la web de pruebas y sincronizá.
  - Tocá el ícono de sincronizar todas las plantaciones y después el tacho de
    la tarjeta.
  - Esperá ver: el aviso "Plantación eliminada en el servidor", la tarjeta con
    esa etiqueta y sin punto naranja, la lista "Eliminadas en el servidor" al
    terminar la sincronización de todas, y al eliminarla del dispositivo el
    detalle de lo que se pierde con una segunda confirmación.
- **No se puede finalizar una plantación con datos sin subir.** Si quedan
  fotos, parcelas o borrados pendientes, "Finalizar" queda deshabilitado con el
  detalle de qué falta sincronizar. Antes esos datos se perdían.
  - En la app Bayka TEST, como administrador, en una plantación lista para
    finalizar, sacale una foto a un árbol en modo avión y volvé a conectar sin
    sincronizar.
  - Abrí el menú de administración de la plantación.
  - Esperá ver: "Finalizar" deshabilitado con "Sincronizá antes de finalizar:
    1 foto sin subir"; después de sincronizar, se habilita.
- **Guardar especies y asignar técnicos es todo o nada.** Si se corta la
  conexión en el medio, o la plantación se archivó, finalizó o eliminó
  mientras tenías la pantalla abierta, nada cambia y ves el motivo. Los
  técnicos inactivos conservan su asignación.
  - En la app Bayka TEST, como administrador, abrí "Especies" de una
    plantación activa, cambiá la selección, activá el modo avión y tocá
    Guardar.
  - Reconectá y volvé a abrir la pantalla.
  - Esperá ver: un error de conexión al guardar y, al volver, las especies
    anteriores intactas.
- **Las fotos ya no se pierden si la sincronización se corta.** Una foto cuenta
  como subida recién cuando el servidor confirma su grupo; si falla, se
  reintenta sola, y el resumen muestra cuántas fallaron sin cortar las demás.
  - En la app Bayka TEST, registrá un grupo con dos o tres árboles con foto y
    cortá la conexión apenas empiece a sincronizar.
  - Reconectá y sincronizá de nuevo.
  - Esperá ver: el grupo sube con sus fotos y en la web de pruebas los árboles
    las muestran.
- **Quitar la foto de un árbol llega al servidor y a los demás celulares.** Ya
  no reaparece al sincronizar, ni en tu celular ni en el de otro técnico.
  - En la app Bayka TEST, abrí un árbol ya sincronizado con foto, tocá "Quitar"
    y sincronizá dos veces.
  - En la web de pruebas, buscá ese árbol en Datos → Árboles.
  - Esperá ver: el árbol sin foto en la web y sin foto en el celular después
    de la segunda sincronización.
- **El celular libera el espacio de las fotos que ya no usa.** Al eliminar una
  plantación del dispositivo, borrar árboles o grupos, o reemplazar o quitar
  una foto, los archivos se borran del teléfono.
  - En la app Bayka TEST, anotá el almacenamiento de la app en los ajustes de
    Android, reemplazá la foto de un árbol y borrá un grupo con fotos.
  - Esperá ver: el almacenamiento no crece con el reemplazo y baja al borrar
    el grupo.
- **Los rechazos dicen su motivo real.** Si una parcela no se puede subir
  porque la plantación se finalizó o archivó, o porque el dato del que depende
  ya no existe en el servidor, el resumen lo dice así en vez de "sin permisos"
  o "Error inesperado".
  - En la app Bayka TEST, creá una parcela en una plantación descargada sin
    sincronizar; desde la web de pruebas, finalizá esa plantación.
  - Sincronizá desde el celular.
  - Esperá ver: la parcela rechazada con "La plantación fue finalizada y ya no
    acepta cambios", no con un mensaje de permisos.
- **Textos de la app bien escritos.** Tildes, eñes y signos de apertura en
  toda la app, incluida la ventana de sincronización.
  - En la app Bayka TEST, mirá la pantalla de inicio de sesión y, en una
    plantación, tocá el tacho para eliminarla del dispositivo.
  - Esperá ver: "Contraseña" con eñe y "¿Estás seguro?" con "Sí, eliminar".

## Web 1.2.0 · Mobile 1.1.0 · 16 de septiembre de 2026

- **Pedí foto en todos los botones de una plantación.** Desde Configuración
  podés hacer que los técnicos saquen foto al registrar cualquier especie, no
  solo N/N.
  - En la web de pruebas, abrí una plantación → Configuración → "Comportamiento
    en la app".
  - Activá "Foto en todos los botones" y recargá la página.
  - Esperá ver: el interruptor sigue activado y la ayuda dice "Cada botón de
    especie pide foto antes de registrar, como N/N".
- **Detalle de plantación más claro.** Tablero, Datos y Configuración entran en
  una sola pantalla, las descargas se juntan en el menú "Exportar", cada
  especie muestra su porcentaje y las parcelas se recorren con flechas.
  - En la web de pruebas, entrá a una plantación.
  - Tocá "Exportar" y recorré las parcelas con las flechas del tablero.
  - Pasá a Configuración y revisá "Comportamiento en la app" y las especies.
  - Esperá ver: todo sin scroll de página, el mapa del tablero visible, "%"
    junto a cada especie y el botón "Marcar todas" en especies.
- **Mirá el tablero de una sola parcela.** Tocá una parcela y los números, las
  especies y el mapa pasan a ser los de esa parcela; "Ver todos" te devuelve a
  la plantación completa.
  - En la web de pruebas, abrí el Tablero de una plantación.
  - Tocá una parcela y después "Ver todos".
  - Esperá ver: con la parcela cambian el total, las especies y el mapa; con
    "Ver todos" vuelve la plantación entera y aparecen todas las parcelas.
- **Compará árboles sin cerrar ventanas.** El detalle de un árbol se abre al
  costado de la tabla; tocá otra fila y cambia al instante.
  - En la web de pruebas, abrí una plantación y andá a Datos → Árboles.
  - Tocá una fila y después otra.
  - Esperá ver: el panel de la derecha cambia de árbol, la tabla sigue visible
    y la fila abierta queda resaltada.
- **Nuevos filtros en Árboles.** Filtrá por grupo (después de elegir la parcela)
  y por árboles con o sin foto.
  - En la web de pruebas, andá a Datos → Árboles de una plantación.
  - Elegí una parcela, después un grupo, y probá "Con foto" y "Sin foto".
  - Esperá ver: Grupo se habilita recién al elegir la parcela y la tabla se
    achica con cada filtro.
- **Especies y usuarios se editan al costado.** Al tocar una especie o una
  persona se abre un panel con sus datos y en qué plantaciones está, y las
  listas suman filtros y búsqueda.
  - En la web de pruebas, andá a Especies, filtrá "Sin uso" y tocá una especie.
  - En Usuarios, buscá a alguien por su email y tocá su fila.
  - Esperá ver: el panel lateral con "Habilitada en" para la especie y
    "Plantaciones asignadas" para la persona, sin que se tape la lista.
- **Buscá plantaciones más rápido.** El listado de Plantaciones busca por lugar
  o temporada y filtra por estado y temporada. Ya no está el filtro por fecha
  de creación.
  - En la web de pruebas, andá a Plantaciones.
  - Escribí una temporada en el buscador y elegí "Finalizadas".
  - Esperá ver: solo las plantaciones que coinciden, con el recuento al pie.
- **Asignar técnicos sin confusiones.** El selector muestra el email de cada
  persona, tiene buscador y ofrece solo técnicos activos.
  - En la web de pruebas, abrí una plantación → Configuración → "Asignar
    técnico".
  - Buscá a alguien por su email.
  - Esperá ver: nombre y email en cada opción, sin administradores y sin
    elegir un rol.
- **La web se usa bien desde el celular.** La barra de arriba ocupa menos
  lugar, el listado de plantaciones muestra solo las columnas clave y en cada
  plantación las acciones se juntan en un botón «⋯».
  - En la web de pruebas, desde el celular, entrá y abrí Plantaciones.
  - Abrí una plantación y tocá «⋯».
  - Esperá ver: la barra de arriba no ocupa media pantalla, la tabla de
    plantaciones entra sin moverse de costado y el «⋯» tiene editar y
    exportar.
- **Novedades de cada versión.** Abajo en el menú lateral ves con qué versión
  estás trabajando; un punto te avisa cuando hay algo nuevo y al entrar ves
  qué cambió en cada versión.
  - En la web de pruebas, mirá el pie del menú lateral y tocá "Novedades".
  - Probá también la búsqueda rápida: Ctrl/⌘ K → "Ver novedades".
  - Esperá ver: esta misma pantalla, con la versión en uso y una tarjeta por
    versión; al volver, el punto del menú se apaga.
- **Roles con nombre completo.** Los administradores ahora figuran como
  "Administrador" en Usuarios y en Configuración, y la búsqueda rápida muestra
  el rol de cada persona escrito completo. Si a alguien le falta el nombre,
  aparece con un código corto en vez de quedar en blanco.
  - En la web de pruebas, entrá a Usuarios y tocá "Agregar usuario".
  - Abrí el selector de rol; después apretá Ctrl/⌘ K y escribí el nombre de
    una persona.
  - Esperá ver: "Administrador" en la columna Rol y en el selector, y el rol
    completo ("Técnico", "Administrador") junto a cada persona en la búsqueda.
- **Tus plantaciones aparecen apenas entrás.** Ya no hace falta recargar la
  página después de iniciar sesión para ver las plantaciones y la temporada
  activa.
  - En la web de pruebas, abrí una ventana privada e iniciá sesión.
  - No recargues ni cambies de pantalla.
  - Esperá ver: el listado de Plantaciones completo y la temporada activa en
    el menú lateral.
- **Cada cuenta ve solo lo suyo.** Si cerrás sesión y entra otra persona en la
  misma pestaña, ya no ve por unos segundos los datos de la cuenta anterior.
  - En la web de pruebas, entrá con una cuenta y abrí Plantaciones.
  - Cerrá sesión y, en la misma pestaña, entrá con otra cuenta que tenga
    plantaciones distintas.
  - Esperá ver: desde el primer momento, solo las plantaciones de la segunda
    cuenta.
- **Aviso claro al llegar al límite de invitaciones.** Si mandaste muchas
  invitaciones seguidas, te avisamos que esperes unos minutos en vez de
  mostrar un error genérico.
  - En la web de pruebas, entrá a Usuarios con una cuenta de superadmin.
  - Mandá tres invitaciones o reenvíos seguidos (en el entorno de pruebas el
    tope es de dos por hora).
  - Esperá ver: "Alcanzaste el límite de emails. Esperá unos minutos y probá
    de nuevo."
- **La frecuencia de GPS se guarda al confirmar.** El valor exacto se guarda
  cuando terminás de escribir (al salir del campo o con Enter), no en cada
  número.
  - En la web de pruebas, abrí una plantación → Configuración → "Comportamiento
    en la app".
  - En "O un valor exacto: cada N árboles", escribí 15 y apretá Enter.
  - Esperá ver: al recargar la página sigue en 15.
- **Logo prolijo.** El logo del menú lateral ya no aparece estirado.
  - En la web de pruebas, desde la compu, mirá el logo arriba del menú lateral.
  - Esperá ver: el logo con su proporción original.
- **Búsqueda rápida más precisa.** Encuentra las acciones aunque las escribas
  sin tildes, y al abrirla sin escribir muestra un solo título.
  - En la web de pruebas, entrá a una plantación, apretá Ctrl/⌘ K y escribí
    "configuracion", sin tilde.
  - Borrá lo escrito.
  - Esperá ver: "Ir a Configuración…" entre las acciones y, con el buscador
    vacío, un solo título arriba de la lista ("Recientes" o "Sugerencias").
- **Recuentos en singular.** Con una sola unidad, los números ya no aparecen en
  plural: "1 grupo", "1 especie", "1 árbol", "1 habilitada".
  - En la web de pruebas, abrí una plantación → Datos → Grupos y elegí una
    parcela que tenga un solo grupo.
  - Pasá al Tablero y buscá esa parcela entre las tarjetas.
  - Esperá ver: "1 grupo" en su tarjeta, no "1 grupos".
- **Los cambios se ven enseguida en toda la web.** Al editar una especie,
  asignar un técnico o editar a una persona, las demás pantallas muestran el
  dato nuevo sin esperar ni recargar.
  - En la web de pruebas, entrá a Usuarios y mirá la columna Plantaciones de
    un técnico.
  - Enseguida asignalo a otra plantación (Configuración → "Asignar técnico")
    y volvé a Usuarios sin recargar.
  - Esperá ver: la columna Plantaciones ya suma una. Para dejarlo como
    estaba, quitalo con la ✕ de su fila en Configuración.
- **Foto en cada especie, si la plantación lo pide.** Con "Foto en todos los
  botones" activado, tocar cualquier especie abre el selector de foto antes de
  registrar el árbol, igual que N/N; si cancelás, el árbol no se registra.
  - En la web de pruebas, activá "Foto en todos los botones" en una plantación
    (Configuración → "Comportamiento en la app").
  - En la app Bayka TEST, sincronizá esa plantación, entrá a un grupo y tocá
    una especie: primero "Cancelar", después sacá una foto.
  - Esperá ver: el selector "Agregar foto" las dos veces; con "Cancelar" no
    aparece ningún árbol nuevo y con foto se registra con su foto. Con el
    interruptor apagado, la especie se registra directo, como siempre.
- **Aviso cuando te quitan de una plantación.** Si un administrador te quita
  de una plantación, al sincronizar la app te avisa y tus datos descargados
  quedan para consulta, sin perderse.
  - En la web de pruebas, abrí una plantación que un técnico ya descargó en la
    app Bayka TEST → Configuración → quitalo con el botón de su fila.
  - En la app Bayka TEST del técnico, tocá "Sincronizar" en esa plantación.
  - Esperá ver: el aviso "Sin acceso a la plantación" en vez de "Datos
    actualizados", y la plantación sigue visible con sus datos.
- **Ajustes y Perfil más prolijos.** Tienen la misma barra de título que
  Plantaciones y los ajustes de GPS aparecen agrupados.
  - En la app Bayka TEST, abrí Ajustes y después Perfil.
  - Esperá ver: la barra de título igual que en Plantaciones, el grupo "Ajustes
    GPS" en Ajustes y nada pegado a la barra de estado del teléfono.
- **Crear plantaciones con mala señal.** La plantación se crea al instante en
  el teléfono y se sube sola; si no hay señal, queda pendiente hasta
  sincronizar.
  - En la app Bayka TEST, como administrador, creá una plantación con señal
    débil o en modo avión.
  - Volvé a tener señal y sincronizá.
  - Esperá ver: la plantación aparece enseguida con su "Parcela 1" y, después
    de sincronizar, también en la web de pruebas.
- **Registrá árboles viendo todos los del grupo.** La barra de abajo pasa a ser
  una tira deslizable con todos los árboles cargados, del primero al último.
  Tocá cualquiera para seleccionarlo: el tacho y el botón de GPS actúan sobre
  ese árbol, así podés capturar el punto de uno viejo o borrar uno del medio.
  Debajo, la precisión actual queda siempre en el mismo lugar.
  - En la app Bayka TEST, entrá a un grupo y registrá cinco o seis árboles.
  - Deslizá la tira y tocá un chip viejo, por ejemplo el de la posición 1.
  - Con ese chip elegido, tocá "Capturar" y después el tacho del chip.
  - Esperá ver: la tira muestra todos los árboles, el chip elegido queda
    resaltado, el botón pasa a "± N m Recapturar" con el pin en el chip, y
    borrar uno del medio pide confirmación porque renumera a los que siguen.
- **La app te avisa cuando hay una actualización lista.** Cuando termina de
  bajar una actualización, aparece arriba de todo una franja celeste con el
  botón "Reiniciar", para aplicarla en el momento en vez de esperar al próximo
  arranque. Nunca se reinicia sola, y el botón queda bloqueado mientras haya
  una sincronización o una descarga en curso.
  - En la app Bayka TEST, dejá la app abierta después de que se publique una
    actualización nueva.
  - Mientras está el aviso, tocá "Sincronizar" en una plantación.
  - Esperá ver: la franja dice "Hay una actualización lista. Al reiniciar se
    cierra lo que estés haciendo."; durante la sincronización pasa a
    "Actualización lista · esperando que termine la sincronización" con
    "Reiniciar" apagado, y la ✕ la descarta hasta el próximo arranque.
- **La sincronización te dice en qué va, tarda menos y no se queda colgada.**
  El cartel muestra la etapa con su contador y una barra, las fotos avanzan
  con "N de M" y su velocidad aproximada, y las plantaciones grandes
  sincronizan más rápido, sobre todo la segunda vez. Si pasan 45 segundos sin
  ninguna novedad, aparece un aviso con un botón para cancelar: nada se corta
  solo, y lo que alcanzó a sincronizarse queda guardado.
  - En la app Bayka TEST, tocá el ícono de sincronizar todas las plantaciones.
  - Mirá el cartel de principio a fin, sin tocar nada, en una plantación con
    muchos árboles y fotos.
  - Esperá ver: se suceden "Parcelas", "Grupos", "Usuarios", "Especies
    asignadas" y "Árboles" con su contador, después "Descargando fotos..." con
    "N de M fotos", y nunca pasan más de unos segundos sin que algo cambie.
- **Una foto que fallaba siempre ahora baja bien.** Si la descarga de una foto
  se cortaba por la mitad, esa foto quedaba contada como fallida en todas las
  sincronizaciones siguientes. Ahora el reintento la baja completa.
  - En la app Bayka TEST, sincronizá una plantación con fotos y, mientras dice
    "Descargando fotos...", cerrá la app desde el selector de aplicaciones.
  - Volvé a entrar y sincronizá esa plantación de nuevo.
  - Esperá ver: termina con las fotos descargadas, sin el aviso de fotos que no
    pudieron descargarse repitiéndose en cada intento.
- **Una descarga cortada ya no deja una plantación vacía.** Si falla la
  descarga de una plantación nueva, deja de aparecer en el listado como si
  estuviera descargada.
  - En la app Bayka TEST, entrá a "Gestionar plantaciones descargadas" y elegí
    una que no tengas descargada.
  - Tocá "Descargar seleccion" y poné el teléfono en modo avión apenas arranca.
  - Esperá ver: después del error esa plantación no queda en el listado, y las
    que ya tenías descargadas siguen con sus datos.
- **Lo que borrás se queda borrado.** Al eliminar un árbol o un grupo, el
  borrado ahora viaja al servidor en la siguiente sincronización. Antes el
  árbol reaparecía, y podían quedar dos con el mismo SubID.
- **Una plantación finalizada queda cerrada.** Cuando un administrador la
  finaliza, la app deja de ofrecer editarla y de permitir borrar sus grupos y
  parcelas. Si te quedó trabajo sin subir, la app te avisa que lo guardado
  sigue en el teléfono y que le pidas a un administrador que la reabra.

## Web 1.1.0 · 21 de agosto de 2026

- **Mostrá u ocultá tu contraseña.** El inicio de sesión y los formularios de
  contraseña ahora tienen un botón con forma de ojo para ver lo que estás
  escribiendo y evitar errores de tipeo.

## Web 1.0.0 · Mobile 1.0.0 · 20 de agosto de 2026

- Primera versión numerada de Bayka: la gestión web para administrar
  plantaciones y la app Android para el trabajo en campo.
