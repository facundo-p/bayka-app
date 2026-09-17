# Novedades de Bayka

Qué trae cada actualización de Bayka, contado para quienes usan la app. Este es
el changelog para compartir con usuarios y clientes: sin referencias internas ni
detalles técnicos (esos viven en [CHANGELOG.md](CHANGELOG.md)).

> El formato de abajo es **contrato**: lo lee la pantalla `/novedades` de la
> web, y cambiarlo la rompe. Está en `.claude/skills/deploy/SKILL.md`
> ("Contrato de formato"); leerlo antes de editar este archivo a mano.

## Web 1.2.0 · Mobile 1.1.0 · 16 de septiembre de 2026

- **Pedí foto en todos los botones de una plantación.** Desde Configuración
  podés hacer que los técnicos saquen foto al registrar cualquier especie, no
  solo N/N.
- **Detalle de plantación más claro.** Tablero, Datos y Configuración entran en
  una sola pantalla, las descargas se juntan en el menú "Exportar", cada
  especie muestra su porcentaje y las parcelas se recorren con flechas.
- **Mirá el tablero de una sola parcela.** Tocá una parcela y los números, las
  especies y el mapa pasan a ser los de esa parcela; "Ver todos" te devuelve a
  la plantación completa.
- **Compará árboles sin cerrar ventanas.** El detalle de un árbol se abre al
  costado de la tabla; tocá otra fila y cambia al instante.
- **Nuevos filtros en Árboles.** Filtrá por grupo (después de elegir la parcela)
  y por árboles con o sin foto.
- **Especies y usuarios se editan al costado.** Al tocar una especie o una
  persona se abre un panel con sus datos y en qué plantaciones está, y las
  listas suman filtros y búsqueda.
- **Buscá plantaciones más rápido.** El listado de Plantaciones busca por lugar
  o temporada y filtra por estado y temporada. Ya no está el filtro por fecha
  de creación.
- **Asignar técnicos sin confusiones.** El selector muestra el email de cada
  persona, tiene buscador y ofrece solo técnicos activos.
- **La web se usa bien desde el celular.** La barra de arriba ocupa menos
  lugar, el listado de plantaciones muestra solo las columnas clave y en cada
  plantación las acciones se juntan en un botón «⋯».
- **Novedades de cada versión.** Abajo en el menú lateral ves con qué versión
  estás trabajando; un punto te avisa cuando hay algo nuevo y al entrar ves
  qué cambió en cada versión.
- **Roles con nombre completo.** Los administradores ahora figuran como
  "Administrador" en Usuarios y en Configuración, y la búsqueda rápida muestra
  el rol de cada persona escrito completo. Si a alguien le falta el nombre,
  aparece con un código corto en vez de quedar en blanco.
- **Tus plantaciones aparecen apenas entrás.** Ya no hace falta recargar la
  página después de iniciar sesión para ver las plantaciones y la temporada
  activa.
- **Cada cuenta ve solo lo suyo.** Si cerrás sesión y entra otra persona en la
  misma pestaña, ya no ve por unos segundos los datos de la cuenta anterior.
- **Aviso claro al llegar al límite de invitaciones.** Si mandaste muchas
  invitaciones seguidas, te avisamos que esperes unos minutos en vez de
  mostrar un error genérico.
- **La frecuencia de GPS se guarda al confirmar.** El valor exacto se guarda
  cuando terminás de escribir (al salir del campo o con Enter), no en cada
  número.
- **Logo prolijo.** El logo del menú lateral ya no aparece estirado.
- **Búsqueda rápida más precisa.** Encuentra las acciones aunque las escribas
  sin tildes, y al abrirla sin escribir muestra un solo título.
- **Recuentos en singular.** Con una sola unidad, los números ya no aparecen en
  plural: "1 grupo", "1 especie", "1 árbol", "1 habilitada".
- **Los cambios se ven enseguida en toda la web.** Al editar una especie,
  asignar un técnico o editar a una persona, las demás pantallas muestran el
  dato nuevo sin esperar ni recargar.
- **Foto en cada especie, si la plantación lo pide.** Con "Foto en todos los
  botones" activado, tocar cualquier especie abre el selector de foto antes de
  registrar el árbol, igual que N/N; si cancelás, el árbol no se registra.
- **Aviso cuando te quitan de una plantación.** Si un administrador te quita
  de una plantación, al sincronizar la app te avisa y tus datos descargados
  quedan para consulta, sin perderse.
- **Ajustes y Perfil más prolijos.** Tienen la misma barra de título que
  Plantaciones y los ajustes de GPS aparecen agrupados.
- **Crear plantaciones con mala señal.** La plantación se crea al instante en
  el teléfono y se sube sola; si no hay señal, queda pendiente hasta
  sincronizar.
- **Registrá árboles viendo todos los del grupo.** La barra de abajo pasa a ser
  una tira deslizable con todos los árboles cargados, del primero al último.
  Tocá cualquiera para seleccionarlo: el tacho y el botón de GPS actúan sobre
  ese árbol, así podés capturar el punto de uno viejo o borrar uno del medio.
  Debajo, la precisión actual queda siempre en el mismo lugar.
- **La app te avisa cuando hay una actualización lista.** Cuando termina de
  bajar una actualización, aparece arriba de todo una franja celeste con el
  botón "Reiniciar", para aplicarla en el momento en vez de esperar al próximo
  arranque. Nunca se reinicia sola, y el botón queda bloqueado mientras haya
  una sincronización o una descarga en curso.
- **La sincronización te dice en qué va, tarda menos y no se queda colgada.**
  El cartel muestra la etapa con su contador y una barra, las fotos avanzan
  con "N de M" y su velocidad aproximada, y las plantaciones grandes
  sincronizan más rápido, sobre todo la segunda vez. Si pasan 45 segundos sin
  ninguna novedad, aparece un aviso con un botón para cancelar: nada se corta
  solo, y lo que alcanzó a sincronizarse queda guardado.
- **Una foto que fallaba siempre ahora baja bien.** Si la descarga de una foto
  se cortaba por la mitad, esa foto quedaba contada como fallida en todas las
  sincronizaciones siguientes. Ahora el reintento la baja completa.
- **Una descarga cortada ya no deja una plantación vacía.** Si falla la
  descarga de una plantación nueva, deja de aparecer en el listado como si
  estuviera descargada.
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
