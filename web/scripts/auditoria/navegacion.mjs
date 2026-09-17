/** Abrir una vista en Chromium y medirla. */
import {
  ALTO_VENTANA,
  BASE_URL,
  MEDIR_NAVEGADOR,
  SELECTOR_CARDS,
  TODOS_LOS_DETAILS,
} from './config.mjs';
import { contarNodos, desplegarDetails, medirEnPagina } from './pagina.navegador.js';

const TIMEOUT_CARGA_MS = 20000;
const TIMEOUT_ABRIR_MS = 10000;
const INTENTOS_ASENTAR = 10;
const PASO_ASENTAR_MS = 200;

/** Abre `vista` a su `ancho`, se la pasa a `usar` y cierra la página aunque falle. */
export async function conPagina(navegador, vista, usar) {
  const pagina = await navegador.newPage({ viewport: { width: vista.ancho, height: ALTO_VENTANA } });
  try {
    await abrirPagina(pagina, vista);
    return await usar(pagina);
  } finally {
    await pagina.close();
  }
}

/** Carga `ruta`, la lleva al estado `abrir` si la vista lo pide y deja inyectado `medir`. */
export async function abrirPagina(pagina, { ruta, abrir, raiz }) {
  await pagina.goto(BASE_URL + ruta, { waitUntil: 'networkidle', timeout: TIMEOUT_CARGA_MS });
  await asentar(pagina);
  if (abrir) {
    await llevarAEstado(pagina, abrir, raiz);
    await asentar(pagina);
  }
  await pagina.addScriptTag({ path: MEDIR_NAVEGADOR });
}

/** Despliega los `<details>`, o clickea el botón `abrir` y espera a que aparezca su `raiz`. */
async function llevarAEstado(pagina, abrir, raiz) {
  if (abrir === TODOS_LOS_DETAILS) return pagina.evaluate(desplegarDetails);
  await pagina.getByRole('button', { name: abrir }).click({ timeout: TIMEOUT_ABRIR_MS });
  await pagina.locator(raiz).waitFor({ timeout: TIMEOUT_ABRIR_MS });
}

/** Mide la página abierta, acotada a `selectorRaiz` si viene. */
export function medirPagina(pagina, selectorRaiz = null) {
  return pagina.evaluate(medirEnPagina, [selectorRaiz, SELECTOR_CARDS]);
}

/**
 * Espera a que el DOM deje de crecer antes de medir.
 *
 * `networkidle` más un timeout fijo no alcanza: Leaflet y los gráficos montan
 * después, y una corrida que mide antes reporta la pantalla limpia porque los
 * controles todavía no existen. Grabar el baseline en una corrida así vuelve
 * regresión falsa a todas las siguientes —pasó con dashboard@900—.
 */
async function asentar(pagina) {
  let previo = -1;
  for (let i = 0; i < INTENTOS_ASENTAR; i++) {
    await pagina.waitForTimeout(PASO_ASENTAR_MS);
    const actual = await pagina.evaluate(contarNodos);
    if (actual === previo) return;
    previo = actual;
  }
}
