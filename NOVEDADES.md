# Novedades de Bayka

Qué trae cada actualización de Bayka, contado para quienes usan la app. Este es
el changelog para compartir con usuarios y clientes: sin referencias internas ni
detalles técnicos (esos viven en [CHANGELOG.md](CHANGELOG.md)).

> El formato de abajo es **contrato**: los `## ` y los bullets
> `- **Titular.** Detalle` los parsea la web para la pantalla `/novedades`
> (`web/src/lib/parsearNovedades.ts`), igual que los headers de `CHANGELOG.md`
> son anclas del workflow de tags. Cambiar el formato rompe esa pantalla.
>
> Entre releases, staging tiene arriba una sección `## En pruebas · …` que
> mantiene el skill `/novedades`: cada bullet lleva su traza oculta
> `<!-- #N -->` y los pasos para probarlo como sub-bullets, y la sección, una
> marca `<!-- sincronizado-hasta: … -->`. La web la muestra solo en staging;
> `/deploy` la convierte en la entrada de la versión.

## En pruebas · próxima versión
<!-- sincronizado-hasta: 6733b7e #383 -->

- **Detalle de plantación más claro.** Tablero, Datos y Configuración entran en
  una sola pantalla, las descargas se juntan en el menú "Exportar", cada
  especie muestra su porcentaje y las parcelas se recorren con flechas.
  <!-- #344 #358 #363 #365 #371 -->
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
  costado de la tabla; tocá otra fila y cambia al instante. <!-- #350 -->
  - En la web de pruebas, abrí una plantación y andá a Datos → Árboles.
  - Tocá una fila y después otra.
  - Esperá ver: el panel de la derecha cambia de árbol, la tabla sigue visible
    y la fila abierta queda resaltada.
- **Nuevos filtros en Árboles.** Filtrá por grupo (después de elegir la parcela)
  y por árboles con o sin foto. <!-- #356 -->
  - En la web de pruebas, andá a Datos → Árboles de una plantación.
  - Elegí una parcela, después un grupo, y probá "Con foto" y "Sin foto".
  - Esperá ver: Grupo se habilita recién al elegir la parcela y la tabla se
    achica con cada filtro.
- **Especies y usuarios se editan al costado.** Al tocar una especie o una
  persona se abre un panel con sus datos y en qué plantaciones está, y las
  listas suman filtros y búsqueda. <!-- #348 #363 -->
  - En la web de pruebas, andá a Especies, filtrá "Sin uso" y tocá una especie.
  - En Usuarios, buscá a alguien por su email y tocá su fila.
  - Esperá ver: el panel lateral con "Habilitada en" para la especie y
    "Plantaciones asignadas" para la persona, sin que se tape la lista.
- **Buscá plantaciones más rápido.** El listado de Plantaciones busca por lugar
  o temporada y filtra por estado y temporada. Ya no está el filtro por fecha
  de creación. <!-- #352 #363 -->
  - En la web de pruebas, andá a Plantaciones.
  - Escribí una temporada en el buscador y elegí "Finalizadas".
  - Esperá ver: solo las plantaciones que coinciden, con el recuento al pie.
- **Asignar técnicos sin confusiones.** El selector muestra el email de cada
  persona, tiene buscador y ofrece solo técnicos activos. <!-- #374 -->
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
  qué cambió en cada versión. <!-- #335 -->
  - En la web de pruebas, mirá el pie del menú lateral y tocá "Novedades".
  - Probá también la búsqueda rápida: Ctrl/⌘ K → "Ver novedades".
  - Esperá ver: esta misma pantalla, con la versión en uso y una tarjeta por
    versión; al volver, el punto del menú se apaga.
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

## Web 1.1.0 · 21 de agosto de 2026

- **Mostrá u ocultá tu contraseña.** El inicio de sesión y los formularios de
  contraseña ahora tienen un botón con forma de ojo para ver lo que estás
  escribiendo y evitar errores de tipeo.

## Web 1.0.0 · Mobile 1.0.0 · 20 de agosto de 2026

- Primera versión numerada de Bayka: la gestión web para administrar
  plantaciones y la app Android para el trabajo en campo.
