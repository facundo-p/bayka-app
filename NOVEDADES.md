# Novedades de Bayka

Qué trae cada actualización de Bayka, contado para quienes usan la app. Este es
el changelog para compartir con usuarios y clientes: sin referencias internas ni
detalles técnicos (esos viven en [CHANGELOG.md](CHANGELOG.md)).

> El formato de abajo es **contrato**: lo lee la pantalla `/novedades` de la
> web, y cambiarlo la rompe. Está en `.claude/skills/deploy/SKILL.md`
> ("Contrato de formato"); leerlo antes de editar este archivo a mano.

## En pruebas · próxima versión
<!-- sincronizado-hasta: 77f9778 #594 -->

- **Reabrí una plantación finalizada.** Si una plantación se finalizó y quedó
  trabajo sin subir en algún celular, un superadmin puede volver a activarla
  desde «⋯ Más acciones»: la app acepta registros de nuevo y lo pendiente se
  puede sincronizar. Los grupos que ya estaban finalizados siguen así. <!-- #594 -->
  - En la web de pruebas, como superadmin, abrí una plantación finalizada →
    «⋯ Más acciones» → "Reabrir plantación".
  - Confirmá y mirá el detalle y el listado.
  - Esperá ver: la confirmación avisa que los grupos finalizados siguen
    finalizados; al confirmar la plantación queda activa y Editar y
    Configuración vuelven a estar disponibles.
- **La configuración de especies se guarda entera o no se guarda.** Al aplicar
  varios cambios juntos ya no puede quedar a medias —una especie que quitaste,
  todavía habilitada— ni guardarse un orden distinto del que muestra la
  pantalla. <!-- #589 -->
  - En la web de pruebas, abrí una plantación → Configuración → Especies.
  - En el mismo lote quitá una especie habilitada, agregá dos del catálogo y
    aplicá.
  - Esperá ver: al recargar quedan exactamente las especies que elegiste, en el
    mismo orden en que las viste en pantalla.
- **Asignar técnicos sin señal te avisa en vez de quedarse cargando.** En la
  app, la pantalla de asignar técnicos ya no se queda en "Cargando técnicos…"
  para siempre cuando no hay conexión. <!-- #593 -->
  - En la app Bayka TEST, entrá una vez con conexión para que quede guardada tu
    organización.
  - Poné el celular en modo avión y abrí una plantación → "Asignar técnicos".
  - Esperá ver: el aviso de que no hay conexión, en vez del cargando infinito.

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
