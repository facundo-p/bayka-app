# PDF de fichas e informe (épica #748)

La web genera tres PDF de marca Bayka en el navegador: la ficha de un árbol
(#754), las fichas de varios árboles (#755) y el informe de la plantación
(#756). Los mapas de los tres suman la imagen satelital en #757. Mockup aprobado:
https://claude.ai/artifact/JQnn1hEKyEHFzLpn8bxyFy (versión 3).

## Decisiones de Facu

| Tema | Decisión |
|---|---|
| Dónde | Solo web. El PDF se arma en el navegador, sin servidor. |
| Encabezado | Claro: logo horizontal a la izquierda, plantación a la derecha (lugar · período; código y organización debajo), filete oliva. |
| Pie | `Bayka · <documento>` a la izquierda; `Emitido el DD/MM/AAAA · Página X de Y` a la derecha. Sin autor. |
| ID Global sin generar | Los PDF se generan igual. La ficha marca «ID Global sin generar». |
| Foto sin permiso de lectura | «Foto no disponible». Si la policy de Storage lo confirma, Issue aparte; esta épica no toca la DB. |
| Fichas por hoja | 3 por hoja A4. La ficha suelta usa el mismo tamaño, sola arriba. |
| Minimapa de la ficha | Toda la parcela del árbol, con el árbol resaltado. |
| Botón de la ficha | «Descargar ficha PDF», ancho, al final del panel de detalle. |
| Selección | Botón «Seleccionar». Los checkboxes solo existen en ese modo. Al entrar aparece una barra azul bajo los filtros, con 0 marcados: «N árboles seleccionados · Cancelar · Generar fichas (N)». Con 0, «Generar fichas» queda deshabilitado y «Cancelar» disponible. Con la página entera marcada dice «Los N árboles de esta página». Vale para la página actual (≤ 50) y se limpia al cambiar de página o de filtro. |
| Colores del informe | Únicos dentro del informe, por orden de cantidad: los 8 de `COLORES_GRAFICOS` y 4 extra (ciruela `#7d4e7a`, verde azulado `#3e8a85`, siena `#b0623a`, pizarra `#5b6b7c`). N/N siempre ámbar. |
| Parcelas en el informe | Una tabla con barra por fila (sin gráfico de barras aparte). |
| Disposición del informe | Todo fluye. Si el mapa entra en lo que queda de la última hoja con al menos 7 cm de alto, va ahí. Si no, va a hoja completa al final. |
| Satélite | Esri World Imagery, con «Imágenes © Esri, Maxar» al pie del mapa. Los términos permiten mapas estáticos en PDF e informes para clientes, y los tiles responden con CORS `*`. |
| Flujo de PRs | Una PR por sub-issue. #754 contra `staging`. #755, #756 y #757 en Draft sobre la rama anterior hasta que se mergea su base. |

## Contenido

**Ficha.** Arriba a la izquierda, la especie: color, `código · nombre común`,
nombre científico en itálica y `tipo · subtipo` (Flora · Árbol). Arriba a la
derecha, el ID Árbol (`SubID-código de plantación`) en mono grande; debajo,
`ID Global N` o la marca «ID Global sin generar». En el cuerpo, de izquierda a
derecha: foto de 120 × 90 pt (≈ 4,2 × 3,2 cm), datos (parcela y grupo con
código y nombre, posición, fecha de registro, técnico, GPS con precisión) y
minimapa de 128 × 128 pt (≈ 4,5 cm), con las medidas del mockup aprobado.

Casos borde: sin foto («Sin foto»), foto no legible («Foto no disponible»), sin
GPS («Sin punto GPS» en el lugar del mapa y en el dato), mapa que no se pudo
dibujar («Mapa no disponible»; las demás fichas salen igual), N/N («N/N · Sin
identificar», sin científico ni subtipo). Al encuadrar el minimapa se descartan
los vecinos a más de 2 km del árbol: un GPS errado no achica la parcela.

**Informe.** Título, línea con lugar, período, código, organización y estado.
Cuatro indicadores: árboles contra la meta con barra de avance, % con GPS, % con
foto y N/N pendientes. Especies con barra y %. Parcelas: tabla con grupos,
árboles, barra y %, con fila de total. Mapa de puntos por especie con código de
parcela en cada una, leyenda y la cantidad de árboles sin GPS que no aparecen.
Siempre la plantación entera. Sin meta: se muestra el total, sin barra. Sin
árboles o sin GPS: el bloque dice por qué está vacío.

**Archivos.** `nombreArchivoDescarga`: `ficha-<lugar>-<periodo>-<subid>.pdf`,
`fichas-<lugar>-<periodo>.pdf` e `informe-<lugar>-<periodo>.pdf`.

## Arquitectura

Todo lo de PDF vive en `web/src/pdf/` y se carga con `import()` recién al tocar
el botón, como `write-excel-file` en `exportarXlsx.ts`. El bundle inicial no
cambia.

| Unidad | Qué hace | Testeable sin PDF |
|---|---|---|
| `pdf/plantilla/` | Tokens de marca para PDF (colores de `chartColors`/`theme.css`, tamaños), registro de fuentes, `Hoja` con encabezado y pie. Cambiar la estética es editar este módulo. | Tokens sí |
| `pdf/mapa/proyeccion.ts` | Web Mercator: encuadre de puntos en un rectángulo con margen, de lat/lng a px. Es la misma proyección de los tiles, así #757 alinea sin tocarla. | Sí |
| `pdf/mapa/dibujarMapa.ts` | Dibuja fondo, puntos, árbol resaltado, códigos de parcela, escala y norte en un canvas y devuelve un PNG. Con 7600 puntos un raster pesa y tarda menos que 7600 círculos vectoriales, y en #757 el satélite se compone en el mismo canvas. | Encuadre y escala sí |
| `pdf/fotos.ts` | `createSignedUrls` en una llamada, `fetch` con concurrencia acotada, reducción a JPEG de ~480 px. Un error por foto se vuelve placeholder; nunca corta el PDF. | Con mocks |
| `pdf/ficha/` | `datosFicha` (puro: fila → modelo de ficha) y el componente `Ficha`. | `datosFicha` sí |
| `pdf/informe/` | `datosInforme` (puro: `DashboardData` + puntos → modelo), `planificarInforme` (puro: dónde va el mapa según filas estimadas) y el documento. | Los dos puros sí |
| `services/pdf*.ts` | Orquestan: leen lo que falta, cargan `pdf/` con `import()`, arman el blob y descargan con `descargarBlob`. | Con mocks |

**Datos.**
- Las fichas usan una query nueva por ids, `listarArbolesParaFichas(plantationId, ids)`. Trae científico, tipo y subtipo de la especie, nombres de parcela y grupo, y `global_id`. El select del listado no cambia.
- El minimapa toma los puntos de `listarPuntosGps`, cacheados con `CLAVE_QUERY.mapa`, filtrados por parcela.
- La organización sale de una lectura de `organizations.nombre`.
- El técnico sale del `nombresUsuario` del listado.
- El informe reutiliza `CLAVE_QUERY.dashboard` con `calcularDashboard(fuente, null)`, y `listarPuntosGps` para el mapa. No lee árboles por su cuenta.

**Fuentes.** Linux Biolinum (OTF de `public/fonts`; si react-pdf no la lee, se
convierte a TTF), Poppins e IBM Plex Mono en TTF o WOFF locales. Nada de CDN.

**Demo.** El cliente demo suma `createSignedUrls`. La foto SVG de la demo se
rasteriza en el mismo canvas de `fotos.ts`.

## Satélite (#757)

Se elige el zoom más alto cuya cobertura del encuadre entre en un tope de tiles:
16 para la ficha y 36 para el informe. Los tiles se bajan en paralelo, se
componen en el canvas del mapa y los puntos van encima. Si falla cualquier tile,
el mapa sale liso, sin atribución.

Donde Esri no tiene imagen a ese zoom sirve un tile gris «Map data not yet
available» con 200, y el 404 de `blankTile=false` llega sin CORS. Por eso antes
de bajar los tiles se consulta el `tilemap` del servicio y, si falta imagen, se
baja de a un zoom, hasta tres. Con satélite el mapa sale en JPEG y lleva un
asterisco bajo su esquina inferior derecha; la atribución, «* Imágenes © Esri,
Maxar», va en letra mínima al centro del pie de cada hoja con un mapa satelital.
Las fichas calculan esas hojas de a tres fichas por hoja; el informe, en la
última, donde va el mapa.

## Errores

- Si falla la generación, se muestra el mensaje de `useDescarga` y no se descarga nada.
- Una foto que no carga no rompe la ficha.
- Un mapa sin puntos no rompe el informe.
- Mientras genera, el botón muestra que está trabajando y no acepta otro click.

## Verificación

- Tests unitarios de las funciones puras y de los services con mocks, más tests de componentes: el botón del panel, el ítem del menú Exportar y el modo selección (entrar, marcar, maestro de tres estados, limpiar al paginar o filtrar, salir).
- Visual: generar los PDF en `dev:demo` y contra staging, pasarlos a PNG con `pdftoppm` y revisarlos contra el mockup.
- Medidas: 50 fichas con foto y el informe de una plantación de ~7600 árboles, en tiempo y en peso del archivo. Se informan en la PR.
- Antes de cada PR, lo que corre `web-ci.yml`: `npm run typecheck`, `npm run lint`, `npm test` en `web/`.
- Code review con subagente de contexto limpio, incluida la búsqueda de *magic constants*.

## Fuera de alcance

- PDF en mobile.
- El informe por especie científica entre plantaciones (#746).
- Arreglar la colisión de colores de `colorEspeciePorCodigo` en la web: va a un Issue aparte.
- La policy de Storage para admins no miembros: va a un Issue aparte si se confirma.
