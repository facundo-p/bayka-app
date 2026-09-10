/**
 * Auditoría responsive: recorre las vistas de la app a varios anchos en
 * Chromium y reporta los defectos de layout que los tests no ven, porque jsdom
 * no evalúa layout (#359).
 *
 * Uso:
 *   npx playwright install chromium   # una vez por máquina
 *   npm run dev:demo                  # en otra terminal
 *   npm run audit:responsive
 *
 *   npm run audit:responsive -- --baseline   # regraba scripts/auditoria/baseline.json
 *   npm run audit:responsive -- --autotest   # verifica que los checks disparen
 *   npm run audit:responsive -- --capturas   # además escribe PNGs en .auditoria/
 *   BASE_URL=http://localhost:4173 npm run audit:responsive
 *
 * Sale con código 1 si alguna celda empeoró respecto del baseline, o si una
 * celda que antes se medía ya no se puede medir. No corre en CI: se corre a
 * mano al tocar layout.
 *
 * Límites, para no leer de más en un `·`:
 *  - Mide la carga inicial de cada vista y los modales de VISTAS. No cubre
 *    estados de error ni de vacío, ni popovers.
 *  - O y R solo ven el primer viewport.
 *  - La ventana mide siempre ALTO_VENTANA: el escalón `max-height: 760` no se
 *    ejerce.
 *  - Los anchos muestrean los escalones, no las bandas entre ellos.
 *  - No detecta controles tapados por otra capa.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { autotest } from './autotest.mjs';
import { contrastarConBaseline, grabarBaseline } from './baseline.mjs';
import { estaVacia, marcarColapsadas } from './clasificar.mjs';
import { ANCHOS, CAPTURAS, METRICAS, VISTAS, claveCelda } from './config.mjs';
import { conPagina, medirPagina } from './navegacion.mjs';

const REGRABAR = process.argv.includes('--baseline');
const AUTOTEST = process.argv.includes('--autotest');
const CON_CAPTURAS = process.argv.includes('--capturas');

const ANCHO_COLUMNA_PANTALLA = 17;
const ANCHO_COLUMNA_CELDA = 13;
const METRICAS_POR_RENGLON = 4;

async function main() {
  const navegador = await chromium.launch();
  try {
    if (AUTOTEST) return await autotest(navegador);
    const informe = await medirTodo(navegador);
    imprimirMatriz(informe);
    if (!REGRABAR) return contrastarConBaseline(informe);
    grabarBaseline(informe);
    return 0;
  } finally {
    await navegador.close();
  }
}

async function medirTodo(navegador) {
  const informe = {};
  for (const vista of VISTAS) {
    for (const ancho of ANCHOS) {
      informe[claveCelda(vista.pantalla, ancho)] = await medirVista(navegador, vista, ancho);
    }
    marcarColapsadas(informe, vista.pantalla, ANCHOS);
  }
  return informe;
}

async function medirVista(navegador, vista, ancho) {
  try {
    return await conPagina(navegador, { ...vista, ancho }, async (pagina) => {
      const medicion = await medirPagina(pagina, vista.raiz);
      medicion.nVacia = estaVacia(medicion, Boolean(vista.raiz || vista.sinChrome)) ? 1 : 0;
      if (CON_CAPTURAS) await capturar(pagina, vista.pantalla, ancho);
      return medicion;
    });
  } catch (e) {
    return { error: String(e).slice(0, 140) };
  }
}

async function capturar(pagina, pantalla, ancho) {
  mkdirSync(CAPTURAS, { recursive: true });
  await pagina.screenshot({ path: join(CAPTURAS, `${pantalla}-${ancho}.png`) });
}

function imprimirMatriz(informe) {
  console.log('');
  imprimirLeyenda();
  const encabezado = ANCHOS.map((a) => String(a).padStart(ANCHO_COLUMNA_CELDA)).join('');
  console.log('pantalla'.padEnd(ANCHO_COLUMNA_PANTALLA) + encabezado);
  for (const { pantalla } of VISTAS) {
    const fila = ANCHOS.map((a) => celda(informe[claveCelda(pantalla, a)]));
    console.log(
      pantalla.padEnd(ANCHO_COLUMNA_PANTALLA) +
        fila.map((c) => c.padStart(ANCHO_COLUMNA_CELDA)).join(''),
    );
  }
}

function imprimirLeyenda() {
  const entradas = METRICAS.map((m) => `${m.letra}=${m.leyenda}`);
  for (let i = 0; i < entradas.length; i += METRICAS_POR_RENGLON) {
    console.log(entradas.slice(i, i + METRICAS_POR_RENGLON).join('  '));
  }
  console.log('');
}

/** Celda compacta para la matriz: `·` cuando está limpia. */
function celda(f) {
  if (f.error) return 'ERR';
  const partes = METRICAS.filter((m) => f[m.campo] > 0).map((m) =>
    m.sinValor ? m.letra : `${m.letra}${f[m.campo]}`,
  );
  return partes.join('/') || '·';
}

process.exit(await main());
