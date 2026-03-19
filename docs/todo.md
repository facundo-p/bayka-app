Pantalla general

- [x]  card de plantación debería mostrar cuantos árboles lleva cargados hoy el usuario
- [x]  card de plantación debería mostrar cuantos árboles totales hay registrados en la plantación

Pantalla de plantación

- [x]  Debería tener una opción de "resolver todos los N/N", que vaya mostrando todos los N/N de todos los subgrupos, permitiendo identificar a c/u.
- [x]  Cards con los que se listan subgrupos de la plantación son exageradamente grandes. Reducir su altura a la mitad.
- [x]  Cada card debería indicar la cantidad de árboles N/N que tiene cargados.
- [x]  La identificación de un N/N debería actualizar ese contador automáticamente.
- [x]  Cada card de subgrupo debería mostrarse un indicador de cantidad de árboles del subgrupo.
- [x]  Debería mostrarse, debajo del Nombre(lugar) de la plantación, el total de árboles cargados en la plantación, y el total cargados por el usuario el día de hoy.
- [x]  Debería permitirse borrar un Subgrupo, pidiendo confirmación (en caso de tener árboles registrados, avisar)
- [x]  Remover botón de "finalizar" de la card del sub grupo.
- [x]  Mostrar en la card del sub grupo un indicador de qe hay árboles n/n por resolver
- [x]  Subgrupo se escribe sin la G mayúscula
- [x]  El botón de "nuevo subgrupo" se superpone con el listado de cards de subgrupos. No debería pasar
- [x]  Al mantener presionada la row correspondiente a un subgrupo, debería abrirse una pantalla de edición para poder modificarle Nombre, Código y tipo. Validar que no exista otro subgrupo con mismo nombre y código. Al editar el código, actualizar todos los subindices de sus árboles, si los tuviese.
- [x]  En las rows de subgrupo no mostrar código de subgrupo
- [x]  En las rows de subgrupo mostrar un icono de árbol al costado del número de árboles.

Pantalla de Sub Grupo

- [x]  Remover indicadores de cantidad de n/n (mostrar la info en la primer row de la pantalla)
- [x]  Remover opción de resolver n/n (se mostrará en la pantalla de la plantación, permitiendo resolver los n/n de todos los subgrupos)
- [x]  Grilla de 3 botones por fila (no de 4)
- [x]  Hay 2 rows al inicio de la pantalla (uno dice "subgroup" y el otro "Registro de Árboles") que hacen lo mismo, volver a la pantalla anterior. Dejar 1 solo, que tenga la flechita
para volver, el nombre de la linea (centrado) y la cantidad de n/n. De esta manera se simplifican las 3 rows iniciales en una sola
- [x]  No permitir finalizar un subgrupo si no tiene árboles cargados.
- [x]  Permitir eliminar el subgrupo. Preguntar por confirmación activa (un slider o algo así, que requiera una acción más evidente que apretar el "Ok") para diferenciarlo del botón de
"Finalizar" y no confundirlos por error.
- [x]  Todos los botones deberían tener el mismo tamaño.
- [x]  Deberían vibrar al presionarse
- [x]  Debería actualizarse automáticamente la lista de los últimos 3 árboles plantados (no se está actualizando)
- [x]  No entiendo qué es el row que dice [id] con flecha para volver atrás
- [x]  Debería poder accederse a ver todo el listado de árboles cargados
- [x]  Debería permitirse borrar árboles cargados. Al hacerlo, se actualizan las posiciones de todos los árboles para que queden consecutivas
- [x]  El listado de las últimas 3 especies cargadas tiene que mostrarse parecido a como se ven los botones de la grilla en tamaño
- [x]  Los usuarios deberían poder acceder a ver el listado de especies registradas en un subgrupo aunque no sean los creadores. De hecho sería ideal que en ese caso accedan solo a ese listado, en lugar a la botonera. Lo mismo para subgrupos marcados como "Finalizadas" o "Sincronizadas".
- [x]  El usuario creador de un grupo en estado Finalizado, debe tener un botón de "Editar" en el que pueda volver la linea a estado "Activo".
- [x]  En el header, mostrar al costado del nombre del subgrupo, también su código y su tipo, pero grisado, para que resalte el nombre más que estos campos.
- [x]  En el header, mostrar al costado de la cantidad de árboles, un ícono de árbol.

Pantalla de resolución de n/n

- [x]  La primer row con "N/N 1 de x" y con la info del subgrupo del árbol, debe ser una fix row (que no se oculte al scrollear)
- [x]  El botón de "guardar" tiene que estar fijo también (porder verlo y apretarlo sin scrollear)
- [x]  Mismo problema que la pantalla de Subgrupo: las 2 rows iniciales hacen lo mismo. Dejar una sola con el texto "Volver"

Nav bar

- [x]  En la barra de navegación, no se ven los íconos de las opciones "Plantaciones" y "Perfil" (en los perfiles de admin no se ven tampoco ningua de las 3 opciones con íconos)