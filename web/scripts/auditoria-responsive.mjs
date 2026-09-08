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
 *   npm run dev:demo                  # en otra terminal: servidor sin backend
 *   npm run audit:responsive
 *
 *   npm run audit:responsive -- --baseline   # regraba scripts/auditoria.baseline.json
 *   BASE_URL=http://localhost:4173 npm run audit:responsive
 *
 * Sale con código 1 si alguna celda empeoró respecto del baseline.
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
  /**
   * Visible de verdad: además de los estilos, el rect tiene que caer dentro del
   * viewport Y dentro de cada ancestro que recorte. Sin lo segundo, una fila
   * scrolleada fuera de su card sigue teniendo rect y aparece "solapada" con lo
   * que haya debajo — es la fuente de falsos positivos más grande de todas.
   */
  const visible = (el) => {
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden' || c.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    if (r.bottom <= 0 || r.top >= window.innerHeight) return false;

    for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const co = getComputedStyle(anc);
      if (co.overflowX === 'visible' && co.overflowY === 'visible') continue;
      const ra = anc.getBoundingClientRect();
      const dentro =
        r.right > ra.left + 1 && r.left < ra.right - 1 &&
        r.bottom > ra.top + 1 && r.top < ra.bottom - 1;
      if (!dentro) return false;
    }
    return true;
  };

  const etiqueta = (el) =>
    (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.tagName)
      .trim()
      .slice(0, 30);

  // Hojas con texto propio: las candidatas a solaparse de forma legible.
  const hojas = [...document.querySelectorAll('body *')].filter((el) => {
    if (el.children.length > 0 || !visible(el)) return false;
    const t = (el.textContent || '').trim();
    return t.length > 0 && t.length < 80;
  });

  // ── Solapamientos: pares de texto cuyos rects se pisan de verdad ────────
  const solapes = [];
  for (let i = 0; i < hojas.length; i++) {
    for (let j = i + 1; j < hojas.length; j++) {
      const a = hojas[i];
      const b = hojas[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 3 && oy > 3) {
        solapes.push({
          a: (a.textContent || '').trim().slice(0, 30),
          b: (b.textContent || '').trim().slice(0, 30),
          area: Math.round(ox * oy),
        });
      }
    }
  }
  solapes.sort((x, y) => y.area - x.area);

  // ── Texto recortado por un ancestro con overflow hidden ─────────────────
  // Un ancestro con overflow auto/scroll NO recorta: el contenido se alcanza
  // scrolleando. Hay que cortar la subida ahí, o se termina culpando al
  // `.shell { overflow: hidden }` del layout por texto perfectamente accesible.
  const recortados = [];
  for (const el of hojas) {
    const re = el.getBoundingClientRect();
    for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const ox = getComputedStyle(anc).overflowX;
      if (ox === 'auto' || ox === 'scroll') break;
      if (ox !== 'hidden' && ox !== 'clip') continue;
      const ra = anc.getBoundingClientRect();
      const fuera = Math.round(Math.max(re.right - ra.right, ra.left - re.left));
      if (fuera > 2) recortados.push({ texto: (el.textContent || '').trim().slice(0, 30), fuera });
      break;
    }
  }

  // ── Controles inalcanzables ─────────────────────────────────────────────
  // `fuera-viewport` es duro y siempre real. `tapado` es blando: elementFromPoint
  // da falsos positivos con backdrop-filter y capas sticky (la topbar es
  // translúcida), así que no cuenta para el criterio de fallo.
  const fueraViewport = [];
  const tapados = [];
  const foco = 'button, a, input, select, textarea, [role="radio"], [role="checkbox"]';
  for (const el of document.querySelectorAll(foco)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 2 || r.left < -2) {
      fueraViewport.push({ q: etiqueta(el) });
      continue;
    }
    if (r.top < 0 || r.bottom > window.innerHeight) continue; // abajo del fold, no es un defecto
    const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (centro && !el.contains(centro) && centro !== el && !centro.contains(el)) {
      tapados.push({ q: etiqueta(el) });
    }
  }

  // ── Cards colapsadas ────────────────────────────────────────────────────
  // Debajo de 900px el shell deja de ser columna flex (`.main > * {display:block}`)
  // y todo lo que dependía de `flex: 1` queda en 0px de alto. Una card de 0px no
  // solapa, no recorta y no scrollea: sin este check puntúa limpio.
  // Ancho mínimo para considerarlo una card y no un wrapper de fila: sin este
  // filtro, los contenedores de 30px de alto de cada fila de tabla puntúan como
  // cards colapsadas.
  const ANCHO_MINIMO_CARD = 240;
  // Solo se releva la altura; quién colapsó se decide afuera, comparando cada
  // card contra sí misma en el ancho más grande. Un umbral fijo no sirve: hay
  // panels que miden 139px en todos los anchos porque son así de altos.
  const alturasCards = {};
  const sospechosas = document.querySelectorAll(
    '[class*="_panel_"], [class*="_mapa_"], [class*="_cardTabla_"], .leaflet-container',
  );
  for (const el of sospechosas) {
    if (getComputedStyle(el).display === 'none' || !el.children.length) continue;
    const { height, width } = el.getBoundingClientRect();
    if (width < ANCHO_MINIMO_CARD) continue;
    const clave = el.className.toString().split(' ')[0] || el.tagName.toLowerCase();
    alturasCards[clave] = Math.round(height);
  }

  // ── Tablas que recortan en vez de scrollear ─────────────────────────────
  // `Table` tiene `width: 100%` sin piso: sin `min-width` el navegador aprieta
  // las columnas hasta recortar el texto en vez de generar scroll. Distinguir
  // "recorta" de "scrollea" es justo lo que hay que verificar.
  const tablasRecortadas = [];
  for (const tabla of document.querySelectorAll('table')) {
    if (tabla.scrollWidth <= tabla.clientWidth + 2) continue;
    let scrolleable = false;
    for (let anc = tabla.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const ox = getComputedStyle(anc).overflowX;
      if (ox === 'auto' || ox === 'scroll') {
        scrolleable = anc.scrollWidth > anc.clientWidth + 2;
        break;
      }
    }
    if (!scrolleable) {
      tablasRecortadas.push({ sobra: Math.round(tabla.scrollWidth - tabla.clientWidth) });
    }
  }

  const doc = document.documentElement;
  return {
    scrollH: doc.scrollWidth - doc.clientWidth,
    solapes: solapes.slice(0, 4),
    nSolapes: solapes.length,
    recortados: recortados.slice(0, 4),
    nRecortados: recortados.length,
    fueraViewport: fueraViewport.slice(0, 4),
    nFueraViewport: fueraViewport.length,
    tapados: tapados.slice(0, 4),
    nTapados: tapados.length,
    alturasCards,
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
const ALTO_COLAPSO_DURO = 40;
const FRACCION_COLAPSO = 0.4;

function marcarColapsadas(informe, pantalla, anchos) {
  const referencia = informe[`${pantalla}@${anchos[0]}`]?.alturasCards ?? {};
  for (const ancho of anchos) {
    const f = informe[`${pantalla}@${ancho}`];
    if (!f || f.error) continue;
    const colapsadas = [];
    for (const [clase, alto] of Object.entries(f.alturasCards ?? {})) {
      const base = referencia[clase];
      const esperado = base == null ? null : base * FRACCION_COLAPSO;
      if (alto < ALTO_COLAPSO_DURO || (esperado != null && alto < esperado)) {
        colapsadas.push({ el: clase, alto, base: base ?? null });
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
  if (f.nColapsadas) p.push(`H${f.nColapsadas}`);
  if (f.nTablasRecortadas) p.push(`T${f.nTablasRecortadas}`);
  return p.join('/') || '·';
}

/** Métricas que cuentan para decir si una celda empeoró. `tapados` no entra. */
const DUROS = ['scrollH', 'nSolapes', 'nRecortados', 'nFueraViewport', 'nColapsadas', 'nTablasRecortadas'];

async function main() {
  const navegador = await chromium.launch();
  const informe = {};

  for (const [pantalla, ruta] of RUTAS) {
    for (const ancho of ANCHOS) {
      const pagina = await navegador.newPage({ viewport: { width: ancho, height: 900 } });
      const clave = `${pantalla}@${ancho}`;
      try {
        await pagina.goto(BASE_URL + ruta, { waitUntil: 'networkidle', timeout: 20000 });
        await pagina.waitForTimeout(400);
        informe[clave] = await pagina.evaluate(medir);
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
  console.log('H=card colapsada  T=tabla que recorta sin scrollear\n');
  console.log('pantalla'.padEnd(ancho0) + ANCHOS.map((a) => String(a).padStart(13)).join(''));
  for (const [pantalla] of RUTAS) {
    const fila = ANCHOS.map((a) => celda(informe[`${pantalla}@${a}`]).padStart(13)).join('');
    console.log(pantalla.padEnd(ancho0) + fila);
  }

  if (REGRABAR) {
    writeFileSync(BASELINE, JSON.stringify(informe, null, 1));
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
    if (!antes || antes.error || ahora.error) continue;
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
