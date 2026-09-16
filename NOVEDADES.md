# Novedades de Bayka

Qué trae cada actualización de Bayka, contado para quienes usan la app. Este es
el changelog para compartir con usuarios y clientes: sin referencias internas ni
detalles técnicos (esos viven en [CHANGELOG.md](CHANGELOG.md)).

> El formato de abajo es **contrato**: lo lee la pantalla `/novedades` de la
> web, y cambiarlo la rompe. Está en `.claude/skills/deploy/SKILL.md`
> ("Contrato de formato"); leerlo antes de editar este archivo a mano.

## En pruebas · próxima versión
<!-- sincronizado-hasta: d379d3a #463 -->

- **Pedí foto en todos los botones de una plantación.** Desde Configuración
  podés hacer que los técnicos saquen foto al registrar cualquier especie, no
  solo N/N. <!-- #440 -->
  - En la web de pruebas, abrí una plantación → Configuración → "Comportamiento
    en la app".
  - Activá "Foto en todos los botones" y recargá la página.
  - Esperá ver: el interruptor sigue activado y la ayuda dice "Cada botón de
    especie pide foto antes de registrar, como N/N".
- **Detalle de plantación más claro.** Tablero, Datos y Configuración entran en
  una sola pantalla, las descargas se juntan en el menú "Exportar", cada
  especie muestra su porcentaje y las parcelas se recorren con flechas.
  <!-- #344 #358 #363 #365 #371 #420 #435 -->
  - En la web de pruebas, entrá a una plantación.
  - Tocá "Exportar" y recorré las parcelas con las flechas del tablero.
  - Pasá a Configuración y revisá "Comportamiento en la app" y las especies.
  - Esperá ver: todo sin scroll de página, el mapa del tablero visible, "%"
    junto a cada especie y el botón "Marcar todas" en especies.
- **Mirá el tablero de una sola parcela.** Tocá una parcela y los números, las
  especies y el mapa pasan a ser los de esa parcela; "Ver todos" te devuelve a
  la plantación completa. <!-- #332 #344 -->
  - En la web de pruebas, abrí el Tablero de una plantación.
  - Tocá una parcela y después "Ver todos".
  - Esperá ver: con la parcela cambian el total, las especies y el mapa; con
    "Ver todos" vuelve la plantación entera y aparecen todas las parcelas.
- **Compará árboles sin cerrar ventanas.** El detalle de un árbol se abre al
  costado de la tabla; tocá otra fila y cambia al instante. <!-- #350 #420 -->
  - En la web de pruebas, abrí una plantación y andá a Datos → Árboles.
  - Tocá una fila y después otra.
  - Esperá ver: el panel de la derecha cambia de árbol, la tabla sigue visible
    y la fila abierta queda resaltada.
- **Nuevos filtros en Árboles.** Filtrá por grupo (después de elegir la parcela)
  y por árboles con o sin foto. <!-- #356 #425 -->
  - En la web de pruebas, andá a Datos → Árboles de una plantación.
  - Elegí una parcela, después un grupo, y probá "Con foto" y "Sin foto".
  - Esperá ver: Grupo se habilita recién al elegir la parcela y la tabla se
    achica con cada filtro.
- **Especies y usuarios se editan al costado.** Al tocar una especie o una
  persona se abre un panel con sus datos y en qué plantaciones está, y las
  listas suman filtros y búsqueda. <!-- #348 #363 #408 #420 #424 #432 -->
  - En la web de pruebas, andá a Especies, filtrá "Sin uso" y tocá una especie.
  - En Usuarios, buscá a alguien por su email y tocá su fila.
  - Esperá ver: el panel lateral con "Habilitada en" para la especie y
    "Plantaciones asignadas" para la persona, sin que se tape la lista.
- **Buscá plantaciones más rápido.** El listado de Plantaciones busca por lugar
  o temporada y filtra por estado y temporada. Ya no está el filtro por fecha
  de creación. <!-- #352 #363 #424 -->
  - En la web de pruebas, andá a Plantaciones.
  - Escribí una temporada en el buscador y elegí "Finalizadas".
  - Esperá ver: solo las plantaciones que coinciden, con el recuento al pie.
- **Asignar técnicos sin confusiones.** El selector muestra el email de cada
  persona, tiene buscador y ofrece solo técnicos activos. <!-- #374 #402 -->
  - En la web de pruebas, abrí una plantación → Configuración → "Asignar
    técnico".
  - Buscá a alguien por su email.
  - Esperá ver: nombre y email en cada opción, sin administradores y sin
    elegir un rol.
- **La web se usa bien desde el celular.** La barra de arriba ocupa menos
  lugar, el listado de plantaciones muestra solo las columnas clave y en cada
  plantación las acciones se juntan en un botón «⋯».
  <!-- #361 #363 #365 #367 -->
  - En la web de pruebas, desde el celular, entrá y abrí Plantaciones.
  - Abrí una plantación y tocá «⋯».
  - Esperá ver: la barra de arriba no ocupa media pantalla, la tabla de
    plantaciones entra sin moverse de costado y el «⋯» tiene editar y
    exportar.
- **Novedades de cada versión.** Abajo en el menú lateral ves con qué versión
  estás trabajando; un punto te avisa cuando hay algo nuevo y al entrar ves
  qué cambió en cada versión. <!-- #335 #415 -->
  - En la web de pruebas, mirá el pie del menú lateral y tocá "Novedades".
  - Probá también la búsqueda rápida: Ctrl/⌘ K → "Ver novedades".
  - Esperá ver: esta misma pantalla, con la versión en uso y una tarjeta por
    versión; al volver, el punto del menú se apaga.
- **Roles con nombre completo.** Los administradores ahora figuran como
  "Administrador" en Usuarios y en Configuración, y la búsqueda rápida muestra
  el rol de cada persona escrito completo. Si a alguien le falta el nombre,
  aparece con un código corto en vez de quedar en blanco. <!-- #432 -->
  - En la web de pruebas, entrá a Usuarios y tocá "Agregar usuario".
  - Abrí el selector de rol; después apretá Ctrl/⌘ K y escribí el nombre de
    una persona.
  - Esperá ver: "Administrador" en la columna Rol y en el selector, y el rol
    completo ("Técnico", "Administrador") junto a cada persona en la búsqueda.
- **Tus plantaciones aparecen apenas entrás.** Ya no hace falta recargar la
  página después de iniciar sesión para ver las plantaciones y la temporada
  activa. <!-- #341 -->
  - En la web de pruebas, abrí una ventana privada e iniciá sesión.
  - No recargues ni cambies de pantalla.
  - Esperá ver: el listado de Plantaciones completo y la temporada activa en
    el menú lateral.
- **Cada cuenta ve solo lo suyo.** Si cerrás sesión y entra otra persona en la
  misma pestaña, ya no ve por unos segundos los datos de la cuenta anterior.
  <!-- #342 -->
  - En la web de pruebas, entrá con una cuenta y abrí Plantaciones.
  - Cerrá sesión y, en la misma pestaña, entrá con otra cuenta que tenga
    plantaciones distintas.
  - Esperá ver: desde el primer momento, solo las plantaciones de la segunda
    cuenta.
- **Aviso claro al llegar al límite de invitaciones.** Si mandaste muchas
  invitaciones seguidas, te avisamos que esperes unos minutos en vez de
  mostrar un error genérico. <!-- #330 -->
  - En la web de pruebas, entrá a Usuarios con una cuenta de superadmin.
  - Mandá tres invitaciones o reenvíos seguidos (en el entorno de pruebas el
    tope es de dos por hora).
  - Esperá ver: "Alcanzaste el límite de emails. Esperá unos minutos y probá
    de nuevo."
- **La frecuencia de GPS se guarda al confirmar.** El valor exacto se guarda
  cuando terminás de escribir (al salir del campo o con Enter), no en cada
  número. <!-- #311 -->
  - En la web de pruebas, abrí una plantación → Configuración → "Comportamiento
    en la app".
  - En "O un valor exacto: cada N árboles", escribí 15 y apretá Enter.
  - Esperá ver: al recargar la página sigue en 15.
- **Logo prolijo.** El logo del menú lateral ya no aparece estirado. <!-- #329 -->
  - En la web de pruebas, desde la compu, mirá el logo arriba del menú lateral.
  - Esperá ver: el logo con su proporción original.
- **Búsqueda rápida más precisa.** Encuentra las acciones aunque las escribas
  sin tildes, y al abrirla sin escribir muestra un solo título.
  <!-- #402 #423 -->
  - En la web de pruebas, entrá a una plantación, apretá Ctrl/⌘ K y escribí
    "configuracion", sin tilde.
  - Borrá lo escrito.
  - Esperá ver: "Ir a Configuración…" entre las acciones y, con el buscador
    vacío, un solo título arriba de la lista ("Recientes" o "Sugerencias").
- **Recuentos en singular.** Con una sola unidad, los números ya no aparecen en
  plural: "1 grupo", "1 especie", "1 árbol", "1 habilitada". <!-- #435 -->
  - En la web de pruebas, abrí una plantación → Datos → Grupos y elegí una
    parcela que tenga un solo grupo.
  - Pasá al Tablero y buscá esa parcela entre las tarjetas.
  - Esperá ver: "1 grupo" en su tarjeta, no "1 grupos".
- **Los cambios se ven enseguida en toda la web.** Al editar una especie,
  asignar un técnico o editar a una persona, las demás pantallas muestran el
  dato nuevo sin esperar ni recargar. <!-- #408 -->
  - En la web de pruebas, entrá a Usuarios y mirá la columna Plantaciones de
    un técnico.
  - Enseguida asignalo a otra plantación (Configuración → "Asignar técnico")
    y volvé a Usuarios sin recargar.
  - Esperá ver: la columna Plantaciones ya suma una. Para dejarlo como
    estaba, quitalo con la ✕ de su fila en Configuración.
- **Foto en cada especie, si la plantación lo pide.** Con "Foto en todos los
  botones" activado, tocar cualquier especie abre el selector de foto antes de
  registrar el árbol, igual que N/N; si cancelás, el árbol no se registra.
  <!-- #440 -->
  - En la web de pruebas, activá "Foto en todos los botones" en una plantación
    (Configuración → "Comportamiento en la app").
  - En la app Bayka TEST, sincronizá esa plantación, entrá a un grupo y tocá
    una especie: primero "Cancelar", después sacá una foto.
  - Esperá ver: el selector "Agregar foto" las dos veces; con "Cancelar" no
    aparece ningún árbol nuevo y con foto se registra con su foto. Con el
    interruptor apagado, la especie se registra directo, como siempre.
- **Aviso cuando te quitan de una plantación.** Si un administrador te quita
  de una plantación, al sincronizar la app te avisa y tus datos descargados
  quedan para consulta, sin perderse. <!-- #318 #334 -->
  - En la web de pruebas, abrí una plantación que un técnico ya descargó en la
    app Bayka TEST → Configuración → quitalo con el botón de su fila.
  - En la app Bayka TEST del técnico, tocá "Sincronizar" en esa plantación.
  - Esperá ver: el aviso "Sin acceso a la plantación" en vez de "Datos
    actualizados", y la plantación sigue visible con sus datos.
- **Ajustes y Perfil más prolijos.** Tienen la misma barra de título que
  Plantaciones y los ajustes de GPS aparecen agrupados. <!-- #337 -->
  - En la app Bayka TEST, abrí Ajustes y después Perfil.
  - Esperá ver: la barra de título igual que en Plantaciones, el grupo "Ajustes
    GPS" en Ajustes y nada pegado a la barra de estado del teléfono.
- **Crear plantaciones con mala señal.** La plantación se crea al instante en
  el teléfono y se sube sola; si no hay señal, queda pendiente hasta
  sincronizar. <!-- #313 #320 -->
  - En la app Bayka TEST, como administrador, creá una plantación con señal
    débil o en modo avión.
  - Volvé a tener señal y sincronizá.
  - Esperá ver: la plantación aparece enseguida con su "Parcela 1" y, después
    de sincronizar, también en la web de pruebas.
- **Registrá árboles viendo todos los del grupo.** La barra de abajo pasa a ser
  una tira deslizable con todos los árboles cargados, del primero al último.
  Tocá cualquiera para seleccionarlo: el tacho y el botón de GPS actúan sobre
  ese árbol, así podés capturar el punto de uno viejo o borrar uno del medio.
  Debajo, la precisión actual queda siempre en el mismo lugar. <!-- #462 -->
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
  una sincronización o una descarga en curso. <!-- #454 #461 -->
  - En la app Bayka TEST, dejá la app abierta después de que se publique una
    actualización nueva.
  - Mientras está el aviso, tocá "Sincronizar" en una plantación.
  - Esperá ver: la franja dice "Hay una actualización lista. Al reiniciar se
    cierra lo que estés haciendo."; durante la sincronización pasa a
    "Actualización lista · esperando que termine la sincronización" con
    "Reiniciar" apagado, y la ✕ la descarta hasta el próximo arranque.
- **La sincronización te dice en qué va y tarda menos.** El cartel deja de
  quedarse quieto: muestra la etapa con su contador y una barra, y las fotos
  avanzan con "N de M". Además las plantaciones grandes sincronizan más
  rápido, sobre todo la segunda vez. <!-- #456 #457 #463 -->
  - En la app Bayka TEST, tocá el ícono de sincronizar todas las plantaciones.
  - Mirá el cartel de principio a fin, sin tocar nada, en una plantación con
    muchos árboles y fotos.
  - Esperá ver: se suceden "Parcelas", "Grupos", "Usuarios", "Especies
    asignadas" y "Árboles" con su contador, después "Descargando fotos..." con
    "N de M fotos", y nunca pasan más de unos segundos sin que algo cambie.
- **Una foto que fallaba siempre ahora baja bien.** Si la descarga de una foto
  se cortaba por la mitad, esa foto quedaba contada como fallida en todas las
  sincronizaciones siguientes. Ahora el reintento la baja completa.
  <!-- #455 -->
  - En la app Bayka TEST, sincronizá una plantación con fotos y, mientras dice
    "Descargando fotos...", cerrá la app desde el selector de aplicaciones.
  - Volvé a entrar y sincronizá esa plantación de nuevo.
  - Esperá ver: termina con las fotos descargadas, sin el aviso de fotos que no
    pudieron descargarse repitiéndose en cada intento.
- **Una descarga cortada ya no deja una plantación vacía.** Si falla la
  descarga de una plantación nueva, deja de aparecer en el listado como si
  estuviera descargada. <!-- #457 -->
  - En la app Bayka TEST, entrá a "Gestionar plantaciones descargadas" y elegí
    una que no tengas descargada.
  - Tocá "Descargar seleccion" y poné el teléfono en modo avión apenas arranca.
  - Esperá ver: después del error esa plantación no queda en el listado, y las
    que ya tenías descargadas siguen con sus datos.

## Web 1.1.0 · 21 de agosto de 2026

- **Mostrá u ocultá tu contraseña.** El inicio de sesión y los formularios de
  contraseña ahora tienen un botón con forma de ojo para ver lo que estás
  escribiendo y evitar errores de tipeo.

## Web 1.0.0 · Mobile 1.0.0 · 20 de agosto de 2026

- Primera versión numerada de Bayka: la gestión web para administrar
  plantaciones y la app Android para el trabajo en campo.
