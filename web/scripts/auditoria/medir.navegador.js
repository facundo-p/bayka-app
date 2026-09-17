/**
 * Lo que se mide en cada página. Corre en el navegador: `page.evaluate` no ve
 * imports, así que esto se inyecta entero con `addScriptTag` y todo queda como
 * global de la página. El punto de entrada es `medir`.
 */
/* exported medir -- lo llama pagina.navegador.js */

/** Holgura para no contar redondeos de subpíxel como defecto. */
const TOLERANCIA_PX = 2;
/** Un borde que apenas toca la caja no la deja afuera. */
const MARGEN_AFUERA_PX = 1;
/** Por debajo de esto en algún eje, dos textos se rozan: no se pisan. */
const SOLAPE_MINIMO_PX = 3;
/** Centros verticales más separados que esto no están en la misma fila. */
const DESFASE_FILA_PX = 3;
/** Diferencia de alto entre controles vecinos que ya se lee como error. */
const ALTO_DESPAREJO_PX = 8;
const DESBORDE_CARD_PX = 4;
const LARGO_ETIQUETA = 30;

const AFUERA = Object.freeze({ no: 0, x: 1, y: 2 });
const ENFOCABLES = 'button, a, input, select, textarea, [role="radio"], [role="checkbox"]';
const CONTROLES = 'input, select, button, [role="radio"]';

/**
 * Conteos de la matriz, tamaño de cada card y detalle de cada defecto, de
 * `selectorRaiz` o de la página entera.
 */
function medir(selectorRaiz, selectorCards) {
  const raiz = resolverRaiz(selectorRaiz);
  const detalle = detallarDefectos(raiz);
  const doc = document.documentElement;
  return {
    scrollH: doc.scrollWidth - doc.clientWidth,
    textoVisible: (raiz.innerText ?? '').trim().length,
    cards: relevarCards(raiz, selectorCards),
    ...contarDefectos(detalle),
    detalle,
  };
}

/**
 * Los recorridos hacia ARRIBA (recortes, scroll, fila flex) siguen llegando a
 * `document.body`: acotar la raíz no cambia quién recorta al diálogo.
 *
 * Si el selector no matchea se corta acá. Caer a `document.body` mediría la
 * página entera diciendo que midió el diálogo, que es la clase de cobertura
 * fantasma que la auditoría existe para no tener.
 */
function resolverRaiz(selector) {
  const raiz = selector ? document.querySelector(selector) : document.body;
  if (!raiz) throw new Error(`raíz ausente: ${selector}`);
  return raiz;
}

function detallarDefectos(raiz) {
  const textos = relevarTextos(raiz);
  return {
    solapes: detectarSolapes(textos),
    ...detectarRecortes(textos),
    fueraViewport: detectarInalcanzables(raiz),
    desparejos: detectarDesparejos(raiz),
    tablasRecortadas: detectarTablasRecortadas(raiz),
    desbordesLaterales: detectarDesbordesLaterales(raiz),
  };
}

function contarDefectos(detalle) {
  return {
    nSolapes: detalle.solapes.length,
    nRecortados: detalle.recortados.length,
    nTruncados: detalle.truncados.length,
    nFueraViewport: detalle.fueraViewport.length,
    nDesparejos: detalle.desparejos.length,
    nTablasRecortadas: detalle.tablasRecortadas.length,
    nDesbordesLaterales: detalle.desbordesLaterales.length,
  };
}

// ── Geometría compartida ──────────────────────────────────────────────────

/** `desde` y sus ancestros, sin llegar a `body`. */
function* ancestros(desde) {
  for (let el = desde; el && el !== document.body; el = el.parentElement) yield el;
}

/** Cada par una sola vez, sin emparejar un elemento consigo mismo. */
function* paresDistintos(lista) {
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) yield [lista[i], lista[j]];
  }
}

/** Uno dentro del otro: es la misma caja anidada, no dos vecinas. */
function anidados(a, b) {
  return a.contains(b) || b.contains(a);
}

/** Lo que sobra se alcanza scrolleando, en vez de quedar recortado. */
function esScrolleable(overflow) {
  return overflow === 'auto' || overflow === 'scroll';
}

function desbordaX(el) {
  return el.scrollWidth > el.clientWidth + TOLERANCIA_PX;
}

function desbordaY(el) {
  return el.scrollHeight > el.clientHeight + TOLERANCIA_PX;
}

function tieneArea(ancho, alto) {
  return ancho > TOLERANCIA_PX && alto > TOLERANCIA_PX;
}

/** Cuánto se sale `r` de costado de `caja`, en px enteros. */
function sobresaleX(r, caja) {
  return Math.round(Math.max(r.right - caja.right, caja.left - r.left));
}

/**
 * Con borde o fondo se ve dónde termina. Un botón de texto plano no es una
 * caja: su alto es el de su línea y no tiene un borde del que salirse.
 */
function esCaja(el) {
  const co = getComputedStyle(el);
  const conBorde = parseFloat(co.borderTopWidth) > 0 || parseFloat(co.borderBottomWidth) > 0;
  return conBorde || co.backgroundColor !== 'rgba(0, 0, 0, 0)';
}

/** Cómo se nombra un elemento en el detalle: su primera clase, o su tag. */
function claseDe(el) {
  return el.className.toString().split(' ')[0] || el.tagName.toLowerCase();
}

/** Los estilos no lo esconden y ocupa lugar. No mira recortes. */
function pintado(el) {
  // Un <details> cerrado esconde su contenido con `content-visibility`, que no
  // toca display ni visibility: el texto sigue ubicado encima del ítem de abajo
  // sin pintarse, y se contaba como solape (#409).
  if (!el.checkVisibility()) return false;
  const c = getComputedStyle(el);
  if (c.display === 'none' || c.visibility === 'hidden' || c.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  return tieneArea(r.width, r.height);
}

function etiqueta(el) {
  return (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.tagName)
    .trim()
    .slice(0, LARGO_ETIQUETA);
}

// ── Texto ─────────────────────────────────────────────────────────────────

/**
 * La unidad es el nodo de texto, no el elemento. Filtrar por
 * `children.length === 0` dejaba afuera todo botón con ícono (`<svg>` +
 * texto), que son la mayoría de los controles con texto de esta app, y con
 * ellos solapes tan visibles como el botón de acción principal encima del
 * título de la pantalla.
 */
function relevarTextos(raiz) {
  const textos = [];
  const rango = document.createRange();
  for (const nodo of nodosDeTexto(raiz)) {
    const texto = medirTexto(nodo, rango);
    if (texto) textos.push(texto);
  }
  return textos;
}

function* nodosDeTexto(raiz) {
  const paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let nodo = paseo.nextNode(); nodo; nodo = paseo.nextNode()) yield nodo;
}

/** El texto del primer viewport, con la caja que realmente se pinta. */
function medirTexto(nodo, rango) {
  const ubicado = ubicarTexto(nodo, rango);
  if (!ubicado) return null;
  const { padre, r } = ubicado;
  if (r.bottom <= 0 || r.top >= window.innerHeight) return null;
  // Lo que se recorta no se está pintando: no puede solaparse con nada.
  const pintada = cajaPintada(padre, r);
  if (!tieneArea(pintada.right - pintada.left, pintada.bottom - pintada.top)) return null;
  return { ...ubicado, pintada };
}

/**
 * El Range da la caja del texto pintado, no la del contenedor. Sin tope de
 * largo: recortar acá dejaba ciego al check con los párrafos descriptivos, que
 * es justo donde hay texto suelto que se puede encimar.
 */
function ubicarTexto(nodo, rango) {
  const texto = (nodo.textContent || '').trim();
  const padre = nodo.parentElement;
  if (!texto || !padre || !pintado(padre) || padre.closest('svg')) return null;
  rango.selectNodeContents(nodo);
  const r = rango.getBoundingClientRect();
  return tieneArea(r.width, r.height) ? { padre, r, texto } : null;
}

/**
 * Caja del texto REALMENTE pintado: la del Range recortada por cada ancestro
 * que recorta, incluido su propio elemento, que es el caso del ellipsis.
 *
 * `getBoundingClientRect` de un Range devuelve el ancho completo del texto
 * aunque `overflow: hidden` lo esté cortando: sin esto un título elidido
 * sigue "solapando" al vecino, y agregarle el ellipsis —el arreglo correcto—
 * sube el número de defectos en vez de bajarlo. Un contenedor con scroll
 * también recorta: lo que está fuera de su ventana no se está pintando ahora.
 */
function cajaPintada(padre, r) {
  const caja = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  for (const anc of ancestros(padre)) {
    const co = getComputedStyle(anc);
    const ra = anc.getBoundingClientRect();
    if (co.overflowX !== 'visible') {
      caja.left = Math.max(caja.left, ra.left);
      caja.right = Math.min(caja.right, ra.right);
    }
    if (co.overflowY !== 'visible') {
      caja.top = Math.max(caja.top, ra.top);
      caja.bottom = Math.min(caja.bottom, ra.bottom);
    }
  }
  return caja;
}

// ── O · solapes ───────────────────────────────────────────────────────────

function detectarSolapes(textos) {
  const solapes = [];
  for (const [a, b] of paresDistintos(textos)) {
    // Texto de un ancestro contra el de su descendiente: la misma caja anidada.
    if (anidados(a.padre, b.padre)) continue;
    const pa = a.pintada;
    const pb = b.pintada;
    const ox = Math.min(pa.right, pb.right) - Math.max(pa.left, pb.left);
    const oy = Math.min(pa.bottom, pb.bottom) - Math.max(pa.top, pb.top);
    if (ox <= SOLAPE_MINIMO_PX || oy <= SOLAPE_MINIMO_PX) continue;
    solapes.push({
      a: a.texto.slice(0, LARGO_ETIQUETA),
      b: b.texto.slice(0, LARGO_ETIQUETA),
      area: Math.round(ox * oy),
    });
  }
  return solapes.sort((x, y) => y.area - x.area);
}

// ── R · texto recortado ───────────────────────────────────────────────────

/**
 * Recorte SIN aviso (la caja corta el texto y nada lo indica) = defecto.
 * Truncado con el contrato de ellipsis completo = deliberado: es la salida
 * para un dato de largo variable en un slot fijo, y contarlo haría que
 * agregar el ellipsis empeore la nota. Se releva aparte y no cuenta.
 */
function detectarRecortes(textos) {
  const recortados = [];
  const truncados = [];
  for (const { padre, r, texto } of textos) {
    const fuera = sobresaleX(r, recorteHorizontal(padre, r));
    if (fuera <= TOLERANCIA_PX) continue;
    const destino = conEllipsis(padre) ? truncados : recortados;
    destino.push({ texto: texto.slice(0, LARGO_ETIQUETA), fuera });
  }
  return { recortados, truncados };
}

function conEllipsis(el) {
  const co = getComputedStyle(el);
  return co.textOverflow === 'ellipsis' && co.whiteSpace === 'nowrap' && co.overflowX !== 'visible';
}

/**
 * Recorte horizontal que NO se puede deshacer scrolleando: el que deja texto
 * ilegible. Por eje y no por elemento —una card que scrollea en vertical sigue
 * recortando en horizontal—, y acumulando todos los ancestros.
 *
 * Un ancestro con scroll corta la subida: más arriba se terminaría culpando al
 * `.shell { overflow: hidden }` del layout por texto que se alcanza scrolleando.
 */
function recorteHorizontal(padre, r) {
  let left = r.left;
  let right = r.right;
  for (const anc of ancestros(padre)) {
    const ox = getComputedStyle(anc).overflowX;
    if (esScrolleable(ox)) break;
    if (ox !== 'hidden' && ox !== 'clip') continue;
    const ra = anc.getBoundingClientRect();
    left = Math.max(left, ra.left);
    right = Math.min(right, ra.right);
  }
  return { left, right };
}

// ── X · controles inalcanzables ───────────────────────────────────────────

function detectarInalcanzables(raiz) {
  const inalcanzables = [];
  for (const el of raiz.querySelectorAll(ENFOCABLES)) {
    if (!pintado(el)) continue;
    const motivo = motivoInalcanzable(el);
    if (motivo) inalcanzables.push({ q: etiqueta(el), motivo });
  }
  return inalcanzables;
}

function motivoInalcanzable(el) {
  const r = el.getBoundingClientRect();
  if (r.right > window.innerWidth + TOLERANCIA_PX || r.left < -TOLERANCIA_PX) {
    return alcanzableScrolleando(el) ? null : 'fuera del viewport';
  }
  return recortadoSinScroll(el) ? 'recortado sin scroll' : null;
}

/**
 * ¿Se puede traer a la vista scrolleando algo? Un contenedor con scroll
 * horizontal propio, o el documento entero.
 *
 * Sin esto, poner el `min-width` que el check T pide en una tabla mandaría
 * los botones de la última columna "fuera del viewport" y la auditoría
 * rechazaría el arreglo correcto. Y cuando el que scrollea es el documento,
 * el defecto ya está contado como S.
 */
function alcanzableScrolleando(el) {
  for (const anc of ancestros(el.parentElement)) {
    if (esScrolleable(getComputedStyle(anc).overflowX) && desbordaX(anc)) return true;
  }
  return desbordaX(document.documentElement);
}

/**
 * Recortado por una card que NO scrollea en el eje en que quedó afuera: no
 * hay forma de llegar. Si el eje scrollea, se alcanza y no es defecto; sin
 * eso, poner el `min-width` que el check T pide en una tabla haría subir los
 * controles "inalcanzables".
 */
function recortadoSinScroll(el) {
  let r = el.getBoundingClientRect();
  for (const anc of ancestros(el.parentElement)) {
    const co = getComputedStyle(anc);
    if (co.overflowX === 'visible' && co.overflowY === 'visible') continue;
    const ra = anc.getBoundingClientRect();
    const eje = ejeAfuera(r, ra);
    if (eje === AFUERA.no) continue;
    if (!scrolleaEn(anc, co, eje)) return true;
    // Scrollear lo TRASLADA a algún lugar de esta caja: los ancestros de más
    // arriba lo juzgan por ahí. Si no, un control bajo el fold de una card con
    // scroll propio se declara inalcanzable al llegar a `.shell`, que recorta
    // sin scrollear, y darle scroll a la card subía el número de defectos.
    r = ra;
  }
  return false;
}

/** En qué eje `r` cae fuera de `ra`, si es que cae. */
function ejeAfuera(r, ra) {
  if (r.right <= ra.left + MARGEN_AFUERA_PX || r.left >= ra.right - MARGEN_AFUERA_PX) {
    return AFUERA.x;
  }
  if (r.bottom <= ra.top + MARGEN_AFUERA_PX || r.top >= ra.bottom - MARGEN_AFUERA_PX) {
    return AFUERA.y;
  }
  return AFUERA.no;
}

function scrolleaEn(anc, co, eje) {
  return eje === AFUERA.x
    ? esScrolleable(co.overflowX) && desbordaX(anc)
    : esScrolleable(co.overflowY) && desbordaY(anc);
}

// ── D · controles desparejos ──────────────────────────────────────────────

/**
 * Dos controles vecinos con altos distintos leen como error de estilo, y
 * ninguna otra métrica los ve: no solapan, no recortan y están dentro del
 * viewport. Pasó al mover el CSS del buscador a un módulo compartido: perdió
 * la cascada contra FormField y quedó 12px más alto que sus vecinos.
 */
function detectarDesparejos(raiz) {
  const desparejos = [];
  for (const [a, b] of paresDistintos(controlesConCaja(raiz))) {
    if (!sonDesparejos(a, b)) continue;
    desparejos.push({
      a: etiqueta(a.el),
      b: etiqueta(b.el),
      altos: `${Math.round(a.r.height)}/${Math.round(b.r.height)}`,
    });
  }
  return desparejos;
}

function controlesConCaja(raiz) {
  return [...raiz.querySelectorAll(CONTROLES)]
    .filter((el) => pintado(el) && esCaja(el) && !apilaContenido(el))
    .map((el) => ({ el, r: el.getBoundingClientRect() }));
}

function sonDesparejos(a, b) {
  if (anidados(a.el, b.el)) return false;
  const centroA = (a.r.top + a.r.bottom) / 2;
  const centroB = (b.r.top + b.r.bottom) / 2;
  if (Math.abs(centroA - centroB) > DESFASE_FILA_PX) return false;
  if (Math.abs(a.r.height - b.r.height) <= ALTO_DESPAREJO_PX) return false;
  return mismaFilaFlex(a.el, b.el);
}

/**
 * Un control que apila su propio contenido (etiqueta + sub-etiqueta) fija su
 * alto: no tiene por qué medir lo mismo que un input de una línea al lado.
 */
function apilaContenido(el) {
  const co = getComputedStyle(el);
  return co.display.includes('flex') && co.flexDirection.startsWith('column') && el.children.length > 1;
}

/**
 * El primer ancestro común tiene que ser una fila flex. Dos controles que
 * comparten la misma banda vertical en columnas distintas de la pantalla no
 * están "en la misma fila".
 */
function mismaFilaFlex(a, b) {
  for (const anc of ancestros(a.parentElement)) {
    if (!anc.contains(b)) continue;
    const co = getComputedStyle(anc);
    return co.display.includes('flex') && !co.flexDirection.startsWith('column');
  }
  return false;
}

// ── H · cards colapsadas ──────────────────────────────────────────────────

/**
 * Debajo de 900px el shell deja de ser columna flex y todo lo que dependía de
 * `flex: 1` queda en 0px. Una card de 0px no solapa, no recorta y no scrollea:
 * sin este check puntúa limpio.
 *
 * Se relevan las dos dimensiones y si el contenido entra; quién colapsó se
 * decide afuera, contra la misma card en el ancho más grande. No se filtra por
 * ancho mínimo: el mapa a 1024 midió 107px de ancho —destruido— y un filtro así
 * lo escondería, además de hacer que angostar una card BAJE los defectos.
 */
function relevarCards(raiz, selector) {
  const cards = {};
  for (const el of raiz.querySelectorAll(selector)) {
    if (getComputedStyle(el).display === 'none' || !el.children.length) continue;
    const { height, width } = el.getBoundingClientRect();
    const clave = claseDe(el);
    // Si el contenido entra, la card se ajustó a él: encogerse no es colapsar.
    const desborda =
      el.scrollHeight > el.clientHeight + DESBORDE_CARD_PX ||
      el.scrollWidth > el.clientWidth + DESBORDE_CARD_PX;
    cards[clave] = { h: Math.round(height), w: Math.round(width), desborda };
  }
  return cards;
}

// ── T · tablas que recortan en vez de scrollear ───────────────────────────

/**
 * `Table` tiene `width: 100%` sin piso: sin `min-width` el navegador aprieta
 * las columnas hasta recortar el texto DENTRO de la celda, en vez de desbordar
 * y generar scroll en el contenedor. `tabla.scrollWidth` no sirve: una
 * <table> en flujo normal se dimensiona a su contenido. La señal está en las
 * celdas, y en que la tabla no quepa en un contenedor que no scrollea.
 */
function detectarTablasRecortadas(raiz) {
  const recortadas = [];
  for (const tabla of raiz.querySelectorAll('table')) {
    const { celdasRecortadas, sobra, desbordaSinScroll } = medirTabla(tabla);
    if (celdasRecortadas > 0 || desbordaSinScroll) recortadas.push({ celdasRecortadas, sobra });
  }
  return recortadas;
}

function medirTabla(tabla) {
  const contenedor = contenedorConOverflow(tabla);
  const anchoTabla = Math.max(tabla.scrollWidth, Math.round(tabla.getBoundingClientRect().width));
  const sobra = contenedor ? anchoTabla - contenedor.clientWidth : 0;
  return {
    celdasRecortadas: [...tabla.querySelectorAll('td, th')].filter(desbordaX).length,
    sobra: Math.max(sobra, 0),
    // Desbordar un contenedor que scrollea es la salida buena.
    desbordaSinScroll:
      sobra > TOLERANCIA_PX && !esScrolleable(getComputedStyle(contenedor).overflowX),
  };
}

/** Primer ancestro que recorta o scrollea en horizontal. */
function contenedorConOverflow(el) {
  for (const anc of ancestros(el.parentElement)) {
    if (getComputedStyle(anc).overflowX !== 'visible') return anc;
  }
  return null;
}

// ── L · texto que se sale de su caja ─────────────────────────────────────

/**
 * Texto que se sale de costado de una caja con borde o fondo, sin que nada lo
 * recorte. Si el que scrollea es un contenedor, el documento no scrollea (S) y
 * nada recorta (R): una URL en un paso de /novedades se salía 58px de la card
 * a 360 sin que ninguna métrica la viera (#416).
 *
 * Mira todo el texto, no solo el primer viewport: salirse de la caja no
 * depende de cuánto esté scrolleado el contenedor.
 */
function detectarDesbordesLaterales(raiz) {
  const desbordes = [];
  const rango = document.createRange();
  for (const nodo of nodosDeTexto(raiz)) {
    const ubicado = ubicarTexto(nodo, rango);
    const desborde = ubicado && cajaDesbordada(ubicado.padre, ubicado.r);
    if (desborde) desbordes.push({ texto: ubicado.texto.slice(0, LARGO_ETIQUETA), ...desborde });
  }
  return desbordes;
}

/**
 * La caja más cercana de la que `r` se sale de costado. Sube solo hasta el
 * primer ancestro que recorta o scrollea: de ahí para afuera lo que sobra se
 * corta, y es R, o se alcanza scrolleando, como una tabla en su contenedor.
 */
function cajaDesbordada(padre, r) {
  for (const anc of ancestros(padre)) {
    if (getComputedStyle(anc).overflowX !== 'visible') return null;
    if (!esCaja(anc)) continue;
    const fuera = sobresaleX(r, anc.getBoundingClientRect());
    if (fuera > TOLERANCIA_PX) return { caja: claseDe(anc), fuera };
  }
  return null;
}
