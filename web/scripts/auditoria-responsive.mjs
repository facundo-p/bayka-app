/**
 * Auditoría responsive: recorre las pantallas de la app a varios anchos y
 * reporta los defectos que los tests no pueden ver (#359).
 *
 * jsdom no evalúa layout —todos los getBoundingClientRect dan cero—, así que
 * nada de lo que mide esto se puede testear en vitest. Un mapa colapsado a 0px
 * de alto o un botón fuera del viewport pasan los 688 tests sin despeinarse.
 *
 * Uso:
 *   npx playwright install chromium   # una vez por máquina
 *   npm run dev:demo                  # en otra terminal (viene de #353)
 *   npm run audit:responsive
 *
 *   npm run audit:responsive -- --baseline   # regraba scripts/auditoria.baseline.json
 *   npm run audit:responsive -- --autotest   # verifica que los checks disparen
 *   npm run audit:responsive -- --capturas   # además escribe PNGs en .auditoria/
 *   BASE_URL=http://localhost:4173 npm run audit:responsive
 *
 * Sale con código 1 si alguna celda empeoró respecto del baseline, o si una
 * celda que antes se medía ya no se puede medir.
 *
 * Límites conocidos, para no leer de más en un `·`:
 *  - Solo mide la carga inicial de cada ruta: nada de formularios, modales,
 *    estados de error/vacío ni nada post-interacción. Con un popover abierto O
 *    da ruido, porque no tiene noción de capa flotante.
 *  - O y R solo ven el primer viewport: en los anchos chicos, donde el
 *    documento scrollea, queda afuera la mayor parte del contenido.
 *  - Corre siempre a 900px de alto: el escalón `max-height: 760` no se ejerce.
 *  - `tapados` (texto encima de un control solo-ícono) se releva pero no cuenta
 *    para el criterio de fallo: elementFromPoint da falsos positivos con
 *    backdrop-filter y capas sticky.
 *  - T es un guardarraíl, no una métrica de progreso: hoy da 0 en las 81 celdas
 *    porque las tablas viven en un contenedor con scroll y las celdas envuelven
 *    en vez de recortar. Sirve para que eso no se rompa.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(AQUI, 'auditoria.baseline.json');
const CAPTURAS = join(AQUI, '..', '.auditoria');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5199';
const REGRABAR = process.argv.includes('--baseline');
const AUTOTEST = process.argv.includes('--autotest');
const CON_CAPTURAS = process.argv.includes('--capturas');

/** El id `p1` lo define el fake de `src/demo/datos.ts`. */
const RUTAS = [
  ['plantaciones', '/plantaciones'],
  ['dashboard', '/plantaciones/p1'],
  ['datos-parcelas', '/plantaciones/p1/datos/parcelas'],
  ['datos-grupos', '/plantaciones/p1/datos/grupos'],
  ['datos-arboles', '/plantaciones/p1/datos/arboles'],
  ['configuracion', '/plantaciones/p1/configuracion'],
  ['especies', '/especies'],
  ['usuarios', '/usuarios'],
  ['novedades', '/novedades'],
];

/** Los 4 escalones de la escala, más los extremos que nadie cubre. */
const ANCHOS = [1920, 1440, 1280, 1024, 900, 768, 600, 430, 360];

/**
 * Lo que se mide en cada página. Corre dentro del browser, así que no puede
 * cerrar sobre nada de este módulo.
 */
function medir() {
  /** Pintado: los estilos no lo esconden y ocupa lugar. No mira recortes. */
  const pintado = (el) => {
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden' || c.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };

  const AFUERA = { no: 0, x: 1, y: 2 };

  /** En qué eje `r` cae fuera de `ra`, si es que cae. */
  const ejeAfuera = (r, ra) => {
    if (r.right <= ra.left + 1 || r.left >= ra.right - 1) return AFUERA.x;
    if (r.bottom <= ra.top + 1 || r.top >= ra.bottom - 1) return AFUERA.y;
    return AFUERA.no;
  };

  /**
   * Primer ancestro que deja al rect afuera de su caja.
   * `exigirSinScroll` distingue los dos usos:
   *  - texto (false): estar fuera de un contenedor scrolleable igual significa
   *    que ahora mismo no se pinta, así que no puede solaparse con nada;
   *  - control (true): si el eje en que quedó afuera scrollea de verdad, se
   *    alcanza scrolleando y NO es un defecto. Sin esto, poner el `min-width`
   *    que el check T pide en una tabla haría subir los controles
   *    "inalcanzables" y la auditoría rechazaría el arreglo correcto.
   */
  const fueraDeCaja = (el, exigirSinScroll) => {
    const r = el.getBoundingClientRect();
    for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const co = getComputedStyle(anc);
      const ox = co.overflowX;
      const oy = co.overflowY;
      if (ox === 'visible' && oy === 'visible') continue;
      const eje = ejeAfuera(r, anc.getBoundingClientRect());
      if (eje === AFUERA.no) continue;
      if (!exigirSinScroll) return anc;
      const scrollea =
        eje === AFUERA.x
          ? (ox === 'auto' || ox === 'scroll') && anc.scrollWidth > anc.clientWidth + 2
          : (oy === 'auto' || oy === 'scroll') && anc.scrollHeight > anc.clientHeight + 2;
      if (!scrollea) return anc;
    }
    return null;
  };

  /**
   * Caja del texto REALMENTE pintado: la del Range recortada por cada ancestro
   * que recorta —incluido su propio elemento, que es el caso del ellipsis—.
   *
   * `getBoundingClientRect` de un Range devuelve el ancho completo del texto
   * aunque `overflow: hidden` lo esté cortando: sin esto un título elidido
   * sigue "solapando" al vecino que tiene al lado, y agregarle el ellipsis
   * —el arreglo correcto— sube el número de defectos en vez de bajarlo.
   *
   * Para solapes, un contenedor con scroll también recorta: lo que está fuera
   * de su ventana no se está pintando ahora.
   */
  const cajaPintada = (padre, r) => {
    const caja = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    for (let anc = padre; anc && anc !== document.body; anc = anc.parentElement) {
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
  };

  /**
   * Recorte horizontal que NO se puede deshacer scrolleando: es el que deja
   * texto ilegible. Por eje y no por elemento —una card que scrollea en
   * vertical sigue recortando de verdad en horizontal—, y acumulando todos
   * los ancestros en vez de quedarse con el primero.
   */
  const recorteHorizontal = (padre, r) => {
    let left = r.left;
    let right = r.right;
    for (let anc = padre; anc && anc !== document.body; anc = anc.parentElement) {
      const ox = getComputedStyle(anc).overflowX;
      if (ox === 'auto' || ox === 'scroll') break;
      if (ox !== 'hidden' && ox !== 'clip') continue;
      const ra = anc.getBoundingClientRect();
      left = Math.max(left, ra.left);
      right = Math.min(right, ra.right);
    }
    return { left, right };
  };

  const etiqueta = (el) =>
    (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.tagName)
      .trim()
      .slice(0, 30);

  /**
   * Unidad de medida del texto: el nodo de texto, no el elemento.
   *
   * Filtrar por `children.length === 0` dejaba afuera todo botón con ícono
   * (`<svg>` + texto), que en esta app son el 84% de los controles con texto —
   * y con ellos, solapes tan visibles como el botón de acción principal encima
   * del título de la pantalla. Un Range sobre el nodo da además la caja real
   * del texto pintado, no la del contenedor.
   */
  const textos = [];
  const rango = document.createRange();
  const paseo = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let nodo = paseo.nextNode(); nodo; nodo = paseo.nextNode()) {
    const contenido = (nodo.textContent || '').trim();
    // Sin tope de largo: recortar acá dejaba ciego al check con los párrafos
    // descriptivos, que es justo donde hay texto suelto que se puede encimar.
    // El recorte a 80 va en el reporte.
    if (!contenido) continue;
    const padre = nodo.parentElement;
    if (!padre || !pintado(padre)) continue;
    if (padre.closest('svg')) continue;

    rango.selectNodeContents(nodo);
    const r = rango.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) continue;
    if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
    // Lo que se recorta no se está pintando: no puede solaparse con nada.
    const pintadaX = cajaPintada(padre, r);
    if (pintadaX.right - pintadaX.left <= 2 || pintadaX.bottom - pintadaX.top <= 2) continue;

    textos.push({ nodo, padre, r, pintada: pintadaX, texto: contenido });
  }

  // ── Solapamientos: pares de texto cuyas cajas se pisan de verdad ───────
  const solapes = [];
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      const a = textos[i];
      const b = textos[j];
      // Texto de un ancestro contra el de su descendiente: no es un solape de
      // layout, es la misma caja anidada.
      if (a.padre.contains(b.padre) || b.padre.contains(a.padre)) continue;
      const ox = Math.min(a.pintada.right, b.pintada.right) - Math.max(a.pintada.left, b.pintada.left);
      const oy = Math.min(a.pintada.bottom, b.pintada.bottom) - Math.max(a.pintada.top, b.pintada.top);
      if (ox > 3 && oy > 3) {
        solapes.push({
          a: a.texto.slice(0, 30),
          b: b.texto.slice(0, 30),
          area: Math.round(ox * oy),
        });
      }
    }
  }
  solapes.sort((x, y) => y.area - x.area);

  // ── Texto recortado ─────────────────────────────────────────────────────
  // Un ancestro con overflow auto/scroll NO recorta: el contenido se alcanza
  // scrolleando. Hay que cortar la subida ahí, o se termina culpando al
  // `.shell { overflow: hidden }` del layout por texto perfectamente accesible.
  //
  // Recorte SIN aviso (la caja corta el texto y nada lo indica) = defecto.
  // Truncado con contrato de ellipsis completo (nowrap + overflow + ellipsis)
  // = deliberado: se releva aparte y no cuenta para el criterio de fallo. Es
  // la salida que el plan prescribe para un dato de largo variable en un slot
  // fijo; contarla haría que agregar el ellipsis empeore la nota.
  const recortados = [];
  const truncados = [];
  for (const { padre, r, texto } of textos) {
    const caja = recorteHorizontal(padre, r);
    const fuera = Math.round(Math.max(r.right - caja.right, caja.left - r.left));
    if (fuera <= 2) continue;
    const co = getComputedStyle(padre);
    const conEllipsis =
      co.textOverflow === 'ellipsis' && co.whiteSpace === 'nowrap' && co.overflowX !== 'visible';
    (conEllipsis ? truncados : recortados).push({ texto: texto.slice(0, 30), fuera });
  }

  // ── Controles inalcanzables ─────────────────────────────────────────────
  // `fuera del viewport` y `recortado sin scroll` son duros y siempre reales.
  // `tapado` es blando: elementFromPoint da falsos positivos con
  // backdrop-filter y capas sticky, así que no cuenta para el criterio de fallo.
  /**
   * ¿Se puede traer a la vista scrolleando algo? Un contenedor con scroll
   * horizontal propio, o el documento entero.
   *
   * Sin esto, poner el `min-width` que el check T pide en una tabla mandaría
   * los botones de la última columna "fuera del viewport" y la auditoría
   * rechazaría el arreglo correcto. Y cuando el que scrollea es el documento,
   * el defecto ya está contado como S: no hay que contarlo dos veces.
   */
  const alcanzableScrolleando = (el) => {
    for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const ox = getComputedStyle(anc).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && anc.scrollWidth > anc.clientWidth + 2) return true;
    }
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  };

  const fueraViewport = [];
  const tapados = [];
  const foco = 'button, a, input, select, textarea, [role="radio"], [role="checkbox"]';
  for (const el of document.querySelectorAll(foco)) {
    if (!pintado(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 2 || r.left < -2) {
      if (!alcanzableScrolleando(el)) {
        fueraViewport.push({ q: etiqueta(el), motivo: 'fuera del viewport' });
      }
      continue;
    }
    // Recortado por una card que NO scrollea en ese eje: no hay forma de
    // llegar. Si el contenedor scrollea, el control se alcanza y no es defecto.
    if (fueraDeCaja(el, true)) {
      fueraViewport.push({ q: etiqueta(el), motivo: 'recortado sin scroll' });
      continue;
    }
    if (r.top < 0 || r.bottom > window.innerHeight) continue; // abajo del fold, no es defecto
    const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (centro && !el.contains(centro) && centro !== el && !centro.contains(el)) {
      tapados.push({ q: etiqueta(el) });
    }
  }

  // ── Controles desparejos en una misma fila ──────────────────────────────
  // Dos controles vecinos con altos distintos leen como error de estilo, y
  // ninguna otra métrica los ve: no solapan, no recortan y están dentro del
  // viewport. Es exactamente lo que pasó al mover el CSS del buscador a un
  // módulo compartido, donde perdió la cascada contra FormField y quedó 12px
  // más alto que sus vecinos en las cuatro barras.
  const ALTO_DESPAREJO = 8;

  /**
   * Un botón de texto plano (sin borde ni fondo) no es una caja: su alto es el
   * de su línea y no tiene por qué coincidir con el de un input al lado.
   */
  const esCaja = (el) => {
    const co = getComputedStyle(el);
    const conBorde =
      parseFloat(co.borderTopWidth) > 0 || parseFloat(co.borderBottomWidth) > 0;
    const conFondo = co.backgroundColor !== 'rgba(0, 0, 0, 0)';
    return conBorde || conFondo;
  };

  /**
   * Un control que apila su propio contenido (etiqueta + sub-etiqueta) fija su
   * alto: no tiene por qué medir lo mismo que un input de una línea al lado.
   */
  const apilaContenido = (el) => {
    const co = getComputedStyle(el);
    return (
      co.display.includes('flex') &&
      co.flexDirection.startsWith('column') &&
      el.children.length > 1
    );
  };

  /**
   * Primer ancestro común: sólo cuenta si es una fila flex. Dos controles que
   * casualmente comparten la misma banda vertical en columnas distintas de la
   * pantalla no están "en la misma fila".
   */
  const mismaFilaFlex = (a, b) => {
    for (let anc = a.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      if (!anc.contains(b)) continue;
      const co = getComputedStyle(anc);
      return co.display.includes('flex') && !co.flexDirection.startsWith('column');
    }
    return false;
  };

  const desparejos = [];
  const controles = [];
  for (const el of document.querySelectorAll('input, select, button, [role="radio"]')) {
    if (!pintado(el) || !esCaja(el) || apilaContenido(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) controles.push({ el, r });
  }
  for (let i = 0; i < controles.length; i++) {
    for (let j = i + 1; j < controles.length; j++) {
      const a = controles[i];
      const b = controles[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const centroA = (a.r.top + a.r.bottom) / 2;
      const centroB = (b.r.top + b.r.bottom) / 2;
      if (Math.abs(centroA - centroB) > 3) continue;
      if (Math.abs(a.r.height - b.r.height) <= ALTO_DESPAREJO) continue;
      if (!mismaFilaFlex(a.el, b.el)) continue;
      desparejos.push({
        a: etiqueta(a.el),
        b: etiqueta(b.el),
        altos: `${Math.round(a.r.height)}/${Math.round(b.r.height)}`,
      });
    }
  }

  // ── Cards colapsadas ────────────────────────────────────────────────────
  // Debajo de 900px el shell deja de ser columna flex (`.main > * {display:block}`)
  // y todo lo que dependía de `flex: 1` queda en 0px. Una card de 0px no solapa,
  // no recorta y no scrollea: sin este check puntúa limpio.
  //
  // Se relevan las DOS dimensiones y si el contenido entra. Quién colapsó se
  // decide afuera, comparando cada card contra sí misma en el ancho más grande:
  // un umbral fijo no sirve porque hay panels que miden 139px en todos los
  // anchos porque son así de bajos. Y no se filtra por ancho mínimo: el mapa a
  // 1024 mide 107px de ancho —destruido— y un filtro de ancho lo escondería,
  // además de hacer que angostar una card BAJE el número de defectos.
  const cards = {};
  const sospechosas = document.querySelectorAll(
    '[class*="_panel_"], [class*="_mapa_"], [class*="_cardTabla_"], .leaflet-container',
  );
  for (const el of sospechosas) {
    if (getComputedStyle(el).display === 'none' || !el.children.length) continue;
    const { height, width } = el.getBoundingClientRect();
    const clave = el.className.toString().split(' ')[0] || el.tagName.toLowerCase();
    cards[clave] = {
      h: Math.round(height),
      w: Math.round(width),
      // Si el contenido entra, la card se ajustó a su contenido y está bien:
      // encogerse no es colapsar. Si desborda, lo que sobra no se ve.
      desborda: el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4,
    };
  }

  // ── Tablas que recortan en vez de scrollear ─────────────────────────────
  // `Table` tiene `width: 100%` sin piso: sin `min-width` el navegador aprieta
  // las columnas hasta que el texto se recorta DENTRO de la celda, en vez de
  // desbordar la tabla y generar scroll en el contenedor. Por eso no sirve
  // mirar `tabla.scrollWidth`: una <table> en flujo normal se dimensiona a su
  // contenido y da scrollWidth === clientWidth siempre. La señal está en las
  // celdas, y en que la tabla no quepa en un contenedor que no scrollea.
  const tablasRecortadas = [];
  for (const tabla of document.querySelectorAll('table')) {
    let celdasRecortadas = 0;
    for (const celda of tabla.querySelectorAll('td, th')) {
      if (celda.scrollWidth > celda.clientWidth + 2) celdasRecortadas++;
    }

    // Primer ancestro que recorta o scrollea.
    let contenedor = null;
    let overflow = 'visible';
    for (let anc = tabla.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const ox = getComputedStyle(anc).overflowX;
      if (ox !== 'visible') {
        contenedor = anc;
        overflow = ox;
        break;
      }
    }
    const anchoTabla = Math.max(tabla.scrollWidth, Math.round(tabla.getBoundingClientRect().width));
    const sobra = contenedor ? anchoTabla - contenedor.clientWidth : 0;
    // Desbordar un contenedor que scrollea está bien: eso ES la salida buena.
    const desbordaSinScroll =
      sobra > 2 && overflow !== 'auto' && overflow !== 'scroll';

    if (celdasRecortadas > 0 || desbordaSinScroll) {
      tablasRecortadas.push({ celdasRecortadas, sobra: Math.max(sobra, 0) });
    }
  }

  const doc = document.documentElement;
  return {
    scrollH: doc.scrollWidth - doc.clientWidth,
    solapes: solapes.slice(0, 4),
    nSolapes: solapes.length,
    recortados: recortados.slice(0, 4),
    nRecortados: recortados.length,
    truncados: truncados.slice(0, 4),
    nTruncados: truncados.length,
    fueraViewport: fueraViewport.slice(0, 4),
    nFueraViewport: fueraViewport.length,
    textoVisible: (document.body.innerText ?? '').trim().length,
    tapados: tapados.slice(0, 4),
    nTapados: tapados.length,
    desparejos: desparejos.slice(0, 4),
    nDesparejos: desparejos.length,
    cards,
    tablasRecortadas,
    nTablasRecortadas: tablasRecortadas.length,
  };
}

/**
 * Una card colapsada es la que perdió el alto que tenía en desktop, no la que
 * es corta de nacimiento. Se compara cada card contra sí misma en el ancho más
 * grande de la corrida: debajo de 40px es colapso seguro, y por debajo del 40%
 * de su alto de referencia también.
 */
/* Menos texto visible que esto y la pantalla no se renderizó: la de contenido
   más pobre (novedades) pasa largamente de acá. */
const MINIMO_TEXTO_PANTALLA = 200;

const TAMANO_COLAPSO_DURO = 40;
const FRACCION_COLAPSO = 0.4;

function marcarColapsadas(informe, pantalla, anchos) {
  const referencia = informe[`${pantalla}@${anchos[0]}`]?.cards ?? {};
  for (const ancho of anchos) {
    const f = informe[`${pantalla}@${ancho}`];
    if (!f || f.error) continue;
    const colapsadas = [];
    for (const [clase, card] of Object.entries(f.cards ?? {})) {
      const base = referencia[clase];
      // Colapso duro: no queda nada en alguno de los dos ejes.
      const duro = card.h < TAMANO_COLAPSO_DURO || card.w < TAMANO_COLAPSO_DURO;
      // Colapso relativo: perdió la mayor parte de su tamaño de desktop Y el
      // contenido ya no entra. Sin lo segundo, una card que simplemente se
      // ajusta a su contenido —y se ve entera— contaba como rota.
      const relativo =
        base != null &&
        card.desborda &&
        (card.h < base.h * FRACCION_COLAPSO || card.w < base.w * FRACCION_COLAPSO);
      if (duro || relativo) {
        colapsadas.push({ el: clase, alto: card.h, ancho: card.w, base: base ?? null });
      }
    }
    f.colapsadas = colapsadas;
    f.nColapsadas = colapsadas.length;
  }
}

/** Celda compacta para la matriz: `·` cuando está limpia. */
function celda(f) {
  if (f.error) return 'ERR';
  const p = [];
  if (f.scrollH > 0) p.push(`S${f.scrollH}`);
  if (f.nSolapes) p.push(`O${f.nSolapes}`);
  if (f.nRecortados) p.push(`R${f.nRecortados}`);
  if (f.nFueraViewport) p.push(`X${f.nFueraViewport}`);
  if (f.nVacia) p.push('VACIA');
  if (f.nDesparejos) p.push(`D${f.nDesparejos}`);
  if (f.nColapsadas) p.push(`H${f.nColapsadas}`);
  if (f.nTablasRecortadas) p.push(`T${f.nTablasRecortadas}`);
  return p.join('/') || '·';
}

/** Métricas que cuentan para decir si una celda empeoró. `tapados` no entra. */
const DUROS = [
  'nVacia',
  'scrollH',
  'nSolapes',
  'nRecortados',
  'nFueraViewport',
  'nColapsadas',
  'nTablasRecortadas',
  'nDesparejos',
];

/**
 * El baseline entra al repo, así que guarda lo mínimo que el trinquete compara:
 * las métricas duras, y solo las que no son cero.
 *
 * El informe completo trae además los detalles de cada defecto y el tamaño de
 * cada card. Eso sirve para leer la corrida que tenés adelante, no para
 * versionarlo: son 2400 líneas de output generado donde cualquier píxel produce
 * diff. Así, una celda limpia es `{}` y lo único que se lee en el archivo son
 * los defectos conocidos que faltan arreglar.
 */
function serializarBaseline(informe) {
  const filas = Object.entries(informe).map(([clave, f]) => {
    const magro = f.error
      ? { error: f.error }
      : Object.fromEntries(DUROS.filter((m) => (f[m] ?? 0) !== 0).map((m) => [m, f[m]]));
    return ` ${JSON.stringify(clave)}: ${JSON.stringify(magro)}`;
  });
  return `{\n${filas.join(',\n')}\n}\n`;
}

/**
 * Un check que no puede disparar nunca reporta cero y parece una app impecable.
 * Esto le inyecta a una pantalla limpia cada defecto que el script dice cazar y
 * exige que lo reporte. Es la única forma de distinguir "no hay defectos" de
 * "el check está muerto".
 */
const CASOS_AUTOTEST = [
  {
    nombre: 'T · contenedor de tabla que recorta en vez de scrollear',
    ruta: '/especies',
    ancho: 600,
    css: '[class*="_tablaScroll_"]{overflow-x:hidden !important}',
    espera: (r) => r.nTablasRecortadas > 0,
  },
  {
    nombre: 'T · celdas apretadas hasta recortar el texto',
    ruta: '/especies',
    ancho: 600,
    css: 'table{table-layout:fixed !important} td,th{overflow:hidden !important}',
    espera: (r) => r.nTablasRecortadas > 0,
  },
  {
    nombre: 'H · card aplastada a cero',
    ruta: '/plantaciones/p1',
    ancho: 1920,
    css: '[class*="_panel_"]{height:0 !important;min-height:0 !important}',
    // Pasa por marcarColapsadas, no por una regla inline: la rama relativa
    // (fracción + desborda) es la que produce la mayoría de los hits reales.
    clasificar: true,
    espera: (r) => r.nColapsadas > 0,
  },
  {
    nombre: 'H · card que pierde el alto y deja contenido afuera',
    ruta: '/plantaciones/p1',
    ancho: 1920,
    css: '[class*="_panel_"]{max-height:60px !important;overflow:hidden !important}',
    clasificar: true,
    espera: (r) => r.nColapsadas > 0,
  },
  {
    nombre: 'H · card que encoge pero se ve entera NO cuenta',
    ruta: '/especies',
    ancho: 1920,
    css: '[class*="_cardTabla_"]{flex:0 0 auto !important}',
    clasificar: true,
    espera: (r) => r.nColapsadas === 0,
    esperaLimpio: (r) => r.nColapsadas === 0,
  },
  {
    nombre: 'O · dos textos encimados',
    ruta: '/especies',
    ancho: 1920,
    // Estructural y no coordenadas fijas: un `top/left` a mano deja de pisar
    // nada en cuanto el layout se mueve, y el check pasa a estar sin ejercer.
    css:
      '[class*="_barra_"]{display:grid !important}' +
      ' [class*="_barra_"] > *{grid-area:1/1 !important;justify-self:start !important;' +
      'margin:0 !important}',
    espera: (r) => r.nSolapes > 0,
  },
  {
    nombre: 'O · botón con ícono encima de un título',
    ruta: '/especies',
    ancho: 1920,
    // El caso que el check no veía: el texto vive en un elemento con hijos.
    css: 'button{position:fixed !important;top:100px !important;left:320px !important;z-index:99}',
    espera: (r) => r.nSolapes > 0,
  },
  {
    nombre: 'O · dos textos apilados en la misma celda de grilla',
    ruta: '/usuarios',
    ancho: 1440,
    // Estructural, no un position:fixed con coordenadas: es el caso que
    // destapó que el check ignoraba los nodos de texto largos.
    css: '[class*="_pieCard_"]{display:grid !important} [class*="_pieCard_"] > *{grid-area:1/1 !important}',
    espera: (r) => r.nSolapes > 0,
  },
  {
    nombre: 'R · texto recortado sin aviso',
    ruta: '/especies',
    ancho: 1920,
    // Mismo apretón que el caso del ellipsis, pero sin `text-overflow`: acá
    // no hay nada que le diga al usuario que falta texto.
    css:
      '[class*="_recuento_"]{display:block !important;width:40px !important;' +
      'overflow:hidden !important;white-space:nowrap !important}',
    espera: (r) => r.nRecortados > 0,
  },
  {
    nombre: 'X · control fuera del viewport',
    ruta: '/especies',
    ancho: 1920,
    css: '[class*="_barra_"] button{position:relative !important;left:3000px !important}',
    espera: (r) => r.nFueraViewport > 0,
  },
  {
    nombre: 'X · control recortado por una card que no scrollea',
    ruta: '/especies',
    ancho: 1920,
    css:
      '[class*="_barra_"]{width:120px !important;overflow:hidden !important;' +
      'flex-wrap:nowrap !important}',
    espera: (r) => r.nFueraViewport > 0,
  },
  {
    nombre: 'X · control alcanzable scrolleando NO cuenta',
    ruta: '/usuarios',
    ancho: 1280,
    // Es el arreglo que el check T empuja: no puede contarse como regresión.
    css: 'table{min-width:1400px !important}',
    espera: (r) => r.nFueraViewport === 0,
    esperaLimpio: (r) => r.nFueraViewport === 0,
  },
  {
    nombre: 'R · truncado con ellipsis NO cuenta (sí como truncado)',
    ruta: '/especies',
    ancho: 1920,
    // El arreglo que las fases 1 y 5 prescriben: no puede subir la nota.
    css:
      '[class*="_recuento_"]{display:block !important;width:60px !important;overflow:hidden' +
      ' !important;white-space:nowrap !important;text-overflow:ellipsis !important}',
    espera: (r) => r.nRecortados === 0 && r.nTruncados > 0,
    esperaLimpio: (r) => r.nRecortados === 0,
  },
  {
    nombre: 'O · sin ellipsis la meta del detalle se encima con las tabs',
    ruta: '/plantaciones/p1',
    ancho: 1440,
    // El defecto original de #357, y su arreglo, en el mismo caso: sacándole
    // el truncado a `.meta` el check tiene que dispararse, y con el truncado
    // puesto tiene que callarse. Si midiera la caja del Range en vez de la
    // pintada, la segunda mitad fallaría.
    css: '[class*="_meta_"]{overflow:visible !important;text-overflow:clip !important}',
    espera: (r) => r.nSolapes > 0,
    esperaLimpio: (r) => r.nSolapes === 0,
  },
  {
    nombre: 'D · control más alto que su vecino de fila',
    ruta: '/especies',
    ancho: 1920,
    // La regresión que las otras métricas no vieron: un control que pierde su
    // alto compacto no solapa, no recorta y está dentro del viewport.
    css: '[class*="_campo_"] input{min-height:64px !important}',
    espera: (r) => r.nDesparejos > 0,
    esperaLimpio: (r) => r.nDesparejos === 0,
  },
  {
    nombre: 'VACIA · una pantalla que no renderiza no puntúa limpio',
    ruta: '/usuarios',
    ancho: 1440,
    css: 'body > * { display: none !important }',
    espera: (r) => r.textoVisible < 200,
    esperaLimpio: (r) => r.textoVisible >= 200,
  },
  {
    nombre: 'S · scroll horizontal de documento',
    ruta: '/especies',
    ancho: 1920,
    css: 'body::after{content:"";display:block;width:3000px;height:1px}',
    espera: (r) => r.scrollH > 0,
  },
];

/**
 * Espera a que el DOM deje de crecer antes de medir.
 *
 * `networkidle` más un timeout fijo no alcanza: Leaflet y los gráficos montan
 * después, y una corrida que mide antes reporta la pantalla limpia porque los
 * controles todavía no existen. Grabar el baseline en una corrida así vuelve
 * regresión falsa a todas las siguientes —pasó con dashboard@900—.
 */
async function asentar(pagina, intentos = 10, paso = 200) {
  let previo = -1;
  for (let i = 0; i < intentos; i++) {
    await pagina.waitForTimeout(paso);
    const actual = await pagina.evaluate(() => document.querySelectorAll('*').length);
    if (actual === previo) return;
    previo = actual;
  }
}

/** Corre el clasificador real de colapso sobre una medición suelta. */
function clasificarSuelta(referencia, medicion) {
  const informe = { 'x@2': referencia, 'x@1': medicion };
  marcarColapsadas(informe, 'x', [2, 1]);
  return informe['x@1'];
}

async function autotest(navegador) {
  let fallos = 0;
  for (const caso of CASOS_AUTOTEST) {
    const pagina = await navegador.newPage({ viewport: { width: caso.ancho, height: 900 } });
    await pagina.goto(BASE_URL + caso.ruta, { waitUntil: 'networkidle', timeout: 20000 });
    await asentar(pagina);

    let limpio = await pagina.evaluate(medir);
    await pagina.addStyleTag({ content: caso.css });
    await pagina.waitForTimeout(300);
    let roto = await pagina.evaluate(medir);
    await pagina.close();

    if (caso.clasificar) {
      roto = clasificarSuelta(limpio, roto);
      limpio = clasificarSuelta(limpio, limpio);
    }

    const dispara = caso.espera(roto);
    // Por defecto se exige que el check calle sin el defecto; los casos que
    // verifican "esto NO debe contarse" lo redefinen.
    const calla = caso.esperaLimpio ? caso.esperaLimpio(limpio) : !caso.espera(limpio);
    const ok = dispara && calla;
    if (!ok) fallos++;
    const motivo = dispara
      ? calla
        ? ''
        : ' (también sin el defecto)'
      : ' (NO dispara)';
    console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${caso.nombre}${motivo}`);
  }
  console.log(
    fallos
      ? `\n${fallos} checks no sirven.`
      : '\nTodos los checks disparan con su defecto y callan sin él.',
  );
  return fallos ? 1 : 0;
}

async function main() {
  const navegador = await chromium.launch();

  if (AUTOTEST) {
    console.log('\nAutotest de los checks:\n');
    const codigo = await autotest(navegador);
    await navegador.close();
    return codigo;
  }
  const informe = {};

  for (const [pantalla, ruta] of RUTAS) {
    for (const ancho of ANCHOS) {
      const pagina = await navegador.newPage({ viewport: { width: ancho, height: 900 } });
      const clave = `${pantalla}@${ancho}`;
      try {
        await pagina.goto(BASE_URL + ruta, { waitUntil: 'networkidle', timeout: 20000 });
        await asentar(pagina);
        const medicion = await pagina.evaluate(medir);
        // Una pantalla en blanco da cero en todos los checks y se lee como
        // impecable. Sin esto, un crash de render se reporta como una fila
        // limpia —que es exactamente lo que pasó con el mapa y `.not(is,null)`.
        medicion.nVacia = medicion.textoVisible < MINIMO_TEXTO_PANTALLA ? 1 : 0;
        informe[clave] = medicion;
        if (CON_CAPTURAS) {
          mkdirSync(CAPTURAS, { recursive: true });
          await pagina.screenshot({ path: join(CAPTURAS, `${pantalla}-${ancho}.png`) });
        }
      } catch (e) {
        informe[clave] = { error: String(e).slice(0, 140) };
      }
      await pagina.close();
    }
  }
  await navegador.close();

  for (const [pantalla] of RUTAS) marcarColapsadas(informe, pantalla, ANCHOS);

  // ── Matriz ──────────────────────────────────────────────────────────────
  const ancho0 = 17;
  console.log('\nS=scroll horizontal  O=solapes  R=texto recortado  X=fuera del viewport');
  console.log('H=card colapsada  T=tabla que recorta sin scrollear  D=controles desparejos');
  console.log('VACIA=la pantalla no renderizó nada\n');
  console.log('pantalla'.padEnd(ancho0) + ANCHOS.map((a) => String(a).padStart(13)).join(''));
  for (const [pantalla] of RUTAS) {
    const fila = ANCHOS.map((a) => celda(informe[`${pantalla}@${a}`]).padStart(13)).join('');
    console.log(pantalla.padEnd(ancho0) + fila);
  }

  if (REGRABAR) {
    writeFileSync(BASELINE, serializarBaseline(informe));
    console.log(`\nBaseline regrabado: ${BASELINE}`);
    return 0;
  }

  if (!existsSync(BASELINE)) {
    console.log('\nNo hay baseline todavía. Corré con --baseline para grabarlo.');
    return 0;
  }

  // ── Comparación contra el baseline ──────────────────────────────────────
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const peores = [];
  const mejores = [];
  for (const clave of Object.keys(informe)) {
    const antes = base[clave];
    const ahora = informe[clave];
    if (!antes) continue;
    // Una celda que antes se medía y ahora no, es una regresión: sin esto,
    // olvidarse de levantar el server da las 81 celdas en ERR y un verde
    // impecable — justo el modo de falla que esta auditoría existe para evitar.
    if (ahora.error) {
      peores.push(`${clave}: no se pudo medir (${ahora.error.slice(0, 60)})`);
      continue;
    }
    if (antes.error) continue;
    for (const m of DUROS) {
      const a = antes[m] ?? 0;
      const b = ahora[m] ?? 0;
      if (b > a) peores.push(`${clave} ${m}: ${a} → ${b}`);
      else if (b < a) mejores.push(`${clave} ${m}: ${a} → ${b}`);
    }
  }

  if (mejores.length) console.log(`\n${mejores.length} métricas mejoraron.`);
  if (peores.length) {
    console.log(`\n${peores.length} métricas EMPEORARON respecto del baseline:`);
    for (const p of peores) console.log('  ' + p);
    return 1;
  }
  console.log('\nSin regresiones respecto del baseline.');
  return 0;
}

process.exit(await main());
