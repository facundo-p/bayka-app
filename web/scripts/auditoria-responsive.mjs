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
 *   npm run dev:demo                  # en otra terminal: servidor sin backend (#353)
 *   npm run audit:responsive
 *
 *   npm run audit:responsive -- --baseline   # regraba scripts/auditoria.baseline.json
 *   npm run audit:responsive -- --autotest   # verifica que los checks disparen
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

  /** Primer ancestro que recorta y deja al elemento afuera, o null. */
  const recortadoPor = (el) => {
    const r = el.getBoundingClientRect();
    for (let anc = el.parentElement; anc && anc !== document.body; anc = anc.parentElement) {
      const co = getComputedStyle(anc);
      if (co.overflowX === 'visible' && co.overflowY === 'visible') continue;
      const ra = anc.getBoundingClientRect();
      const dentro =
        r.right > ra.left + 1 && r.left < ra.right - 1 &&
        r.bottom > ra.top + 1 && r.top < ra.bottom - 1;
      if (!dentro) return anc;
    }
    return null;
  };

  /**
   * Visible de verdad: pintado, dentro del viewport y dentro de todo ancestro
   * que recorte. Sin lo último, una fila scrolleada fuera de su card sigue
   * teniendo rect y aparece "solapada" con lo que haya debajo.
   *
   * Ojo: esto vale para medir TEXTO. Para un control, quedar recortado por un
   * ancestro no lo hace invisible, lo hace inalcanzable — que es el defecto que
   * hay que reportar, no descartar.
   */
  const visible = (el) => {
    if (!pintado(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) return false;
    return recortadoPor(el) === null;
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
    if (!pintado(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 2 || r.left < -2) {
      fueraViewport.push({ q: etiqueta(el), motivo: 'fuera del viewport' });
      continue;
    }
    // Recortado por una card con overflow hidden: no se puede alcanzar ni
    // scrolleando. Es el modo en que los controles "desaparecen" arriba de 900.
    const recorta = recortadoPor(el);
    if (recorta) {
      fueraViewport.push({ q: etiqueta(el), motivo: 'recortado por un ancestro' });
      continue;
    }
    if (r.top < 0 || r.bottom > window.innerHeight) continue; // abajo del fold, no es defecto
    const centro = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (centro && !el.contains(centro) && centro !== el && !centro.contains(el)) {
      tapados.push({ q: etiqueta(el) });
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
    fueraViewport: fueraViewport.slice(0, 4),
    nFueraViewport: fueraViewport.length,
    tapados: tapados.slice(0, 4),
    nTapados: tapados.length,
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
  if (f.nColapsadas) p.push(`H${f.nColapsadas}`);
  if (f.nTablasRecortadas) p.push(`T${f.nTablasRecortadas}`);
  return p.join('/') || '·';
}

/** Métricas que cuentan para decir si una celda empeoró. `tapados` no entra. */
const DUROS = ['scrollH', 'nSolapes', 'nRecortados', 'nFueraViewport', 'nColapsadas', 'nTablasRecortadas'];

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
    espera: (r) => Object.values(r.cards).some((c) => c.h < 40),
  },
  {
    nombre: 'O · dos textos encimados',
    ruta: '/especies',
    ancho: 1920,
    css: '[class*="_recuento_"]{position:fixed !important;top:120px !important;left:400px !important;z-index:99}',
    espera: (r) => r.nSolapes > 0,
  },
  {
    nombre: 'X · control fuera del viewport',
    ruta: '/especies',
    ancho: 1920,
    css: '[class*="_toolbar_"] button{position:relative !important;left:3000px !important}',
    espera: (r) => r.nFueraViewport > 0,
  },
  {
    nombre: 'S · scroll horizontal de documento',
    ruta: '/especies',
    ancho: 1920,
    css: 'body::after{content:"";display:block;width:3000px;height:1px}',
    espera: (r) => r.scrollH > 0,
  },
];

async function autotest(navegador) {
  let fallos = 0;
  for (const caso of CASOS_AUTOTEST) {
    const pagina = await navegador.newPage({ viewport: { width: caso.ancho, height: 900 } });
    await pagina.goto(BASE_URL + caso.ruta, { waitUntil: 'networkidle', timeout: 20000 });
    await pagina.waitForTimeout(400);

    const limpio = await pagina.evaluate(medir);
    await pagina.addStyleTag({ content: caso.css });
    await pagina.waitForTimeout(300);
    const roto = await pagina.evaluate(medir);
    await pagina.close();

    const dispara = caso.espera(roto);
    const calla = !caso.espera(limpio);
    const ok = dispara && calla;
    if (!ok) fallos++;
    const motivo = dispara ? (calla ? '' : ' (dispara también sin el defecto)') : ' (NO dispara)';
    console.log(`  ${ok ? 'ok  ' : 'FALLA'} ${caso.nombre}${motivo}`);
  }
  console.log(fallos ? `\n${fallos} checks no sirven.` : '\nTodos los checks disparan con su defecto y callan sin él.');
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
