# Responsive de la web

Qué significa "responsive" en `web/`, qué se decidió y qué hay que respetar al
tocar layout. Para la app de campo, ver `ui-ux-guidelines.md`.

## El objetivo, y lo que NO es

**Usable, no rediseñada.** De 360px para arriba: sin scroll horizontal de
documento, nada solapado, todo control alcanzable. Sigue siendo el layout de
escritorio, plegado. No hay pantallas mobile propias, ni tablas convertidas en
listas de cards, ni navegación aparte.

La app está optimizada para escritorio y notebook. Arriba de 1400 nada cambió.

## La escala

| px | Nombre | Qué pasa ahí |
|---|---|---|
| **1400** | notebook | La barra del detalle deja de entrar en un renglón (1366×768 real) |
| **1200** | compacta | Grillas de 2 columnas → 1; las toolbars empiezan a envolver |
| **900** | tablet | El sidebar pasa a barra horizontal; vuelve el scroll de documento |
| **600** | teléfono | Las tablas sueltan columnas secundarias; los modales van al ancho |
| **(max-height: 760)** | ventana baja | Fallback de alto, no de ancho |

No hay escalón en 430 ni en 360: entre 600 y 360 el problema siempre fue el
mismo desborde creciendo, y eso se cubre con `clamp()`, no con otro breakpoint.

**Los valores van literales en cada `@media`.** `var()` solo se resuelve en el
valor de una declaración, no en el prelude de una at-rule; `@custom-media`
necesitaría PostCSS, que el repo no tiene. La lista normativa vive en el bloque
Layout de `web/src/theme/theme.css` y `theme/__tests__/breakpoints.test.ts`
falla si aparece otro número, otra unidad o la sintaxis de rango.

## Patrones

Casi todos los defectos salieron de tres familias, no de bugs sueltos.

**Filas flex donde nada cede.** `display: flex` sin `flex-wrap`, hijos con
`flex-shrink: 0` y `white-space: nowrap`: cuando no entra, no baja de renglón,
se sale. La regla operativa: *ninguna fila puede tener un `min-content` mayor
que el viewport* — o envuelve, o tiene `overflow-x` propio.

**`min-width: 0` sin truncado.** Deja que la caja se encoja por debajo de su
contenido, pero el texto se sigue pintando y se desborda sobre el vecino. Si un
elemento lleva `min-width: 0` y tiene texto propio, necesita el contrato
completo: `white-space: nowrap` + `overflow: hidden` + `text-overflow:
ellipsis`. Si es un contenedor, el contrato le toca a sus hijos.

**Grillas `1fr` sin `minmax(0, …)`.** Un track `1fr` no baja de su `min-content`:
se queda con más de lo que le toca y la fila desborda. Para cantidad de columnas
según el espacio real, `repeat(auto-fit, minmax(Npx, 1fr))` — es container query
sin query, lo decide el ancho del contenedor y no el del viewport, y *borra* un
media query en vez de agregar otro.

Dos trampas que costaron caro:

- **`flex: 1` con piso en 0 resuelve a 0px cuando el contexto flex desaparece.**
  A ≤900 `AppLayout` pone `.main > * { display: block }` y todo lo que dependía
  de `flex: 1` para su alto queda en cero. Una card de 0px no solapa, no recorta
  y no scrollea: puntúa limpio. Por eso las cards de mapa y panel llevan
  `min-height`, que funciona en los dos modos.
- **Una regla pensada para el sidebar vertical sigue aplicando en la barra
  horizontal.** `width: 100%` en el buscador se quedaba con la fila entera y
  empujaba a los otros cuatro bloques a una fila cada uno; un `border-top`
  divisor quedaba flotando a media altura. Al tocar algo del sidebar, mirarlo
  también a ≤900.

## Columnas de tabla en teléfono

A ≤600 las tablas sueltan sus columnas secundarias. La marca vive en la columna
(`fueraEnMovil` en `TableColumn`), no en una lista de claves aparte que se pueda
desincronizar, y la aplica `useColumnasVisibles`.

Se filtra el array y no se esconden las celdas por CSS: esconder `<td>` por
`nth-child` obliga a esconder el `<th>` por el mismo índice, y el día que
alguien inserte una columna en el medio los dos se desalinean en silencio.
Filtrando, la relación header↔celda no se puede romper y es testeable en jsdom.

Dos reglas duras, con test propio: **nunca se cae la columna de identidad ni la
de acciones.**

## Container queries: no, y por qué

`@container` es Baseline desde 2023, así que no es un problema de soporte.

1. Lo que estaba roto no era "faltan queries", era falta de `wrap`, de
   `ellipsis` y de `minmax(0, …)`. Una container query no arregla ninguno de
   esos casos.
2. `container-type: inline-size` aplica `contain`, que crea un containing block
   nuevo para descendientes `position: fixed`. Con los menús desplegables, el
   mensaje de acción y los panes de Leaflet, abre una clase de bug nueva a
   cambio de nada.
3. Los casos honestamente card-driven se resuelven mejor con
   `repeat(auto-fit, minmax(…))`.

**Cuándo volver a evaluarlas:** si aparece un componente que necesite *contenido
distinto* —no sólo otra cantidad de columnas— según el ancho de su slot, y ese
ancho no sea derivable del viewport.

## Cómo se verifica

Los bugs de layout no los ve ningún test: jsdom no evalúa layout, así que todos
los `getBoundingClientRect` dan cero. Un mapa colapsado a 0px de alto o un botón
fuera del viewport pasan la suite entera sin despeinarse.

Para eso está `npm run audit:responsive` (ver `web/README.md`), que recorre las
pantallas a 9 anchos en Chromium y compara contra un baseline versionado.
**No corre en CI, por decisión**: se corre a mano al tocar layout.

Dos cosas que la auditoría enseñó por las malas y conviene no olvidar:

- **Una pantalla que no renderiza puntúa mejor que una rota.** Cero solapes,
  cero recortes, cero desbordes. Un crash de render se reportó como fila limpia
  hasta que se agregó el check `VACIA`.
- **Un check que no puede disparar reporta cero y parece salud.** Por eso está
  `--autotest`: le inyecta a una pantalla limpia cada defecto que dice cazar y
  exige que lo reporte, y que calle sin él.

Y lo que la auditoría **no** ve, que hay que mirar a ojo: nada que no rompa la
geometría. Una barra superior que se come el 91% del alto de la ventana antes
de mostrar un dato no solapa, no recorta y se alcanza scrolleando (#366).
