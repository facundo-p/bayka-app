/**
 * El baseline entra al repo, así que guarda lo mínimo que el trinquete compara:
 * las métricas duras, y solo las que no son cero. Una celda limpia es `{}` y lo
 * único que se lee en el archivo son los defectos conocidos que faltan arreglar.
 *
 * El detalle de cada defecto no se versiona —cualquier píxel produciría diff—:
 * se imprime para las métricas que empeoran.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BASELINE, DUROS, METRICAS } from './config.mjs';

const MAX_EJEMPLOS = 4;

export function serializarBaseline(informe) {
  const filas = Object.entries(informe).map(
    ([clave, f]) => ` ${JSON.stringify(clave)}: ${JSON.stringify(magro(f))}`,
  );
  return `{\n${filas.join(',\n')}\n}\n`;
}

function magro(f) {
  if (f.error) return { error: f.error };
  return Object.fromEntries(DUROS.filter((m) => (f[m] ?? 0) !== 0).map((m) => [m, f[m]]));
}

export function grabarBaseline(informe) {
  writeFileSync(BASELINE, serializarBaseline(informe));
  console.log(`\nBaseline regrabado: ${BASELINE}`);
}

/** Compara contra el baseline grabado, imprime el resultado y devuelve el código de salida. */
export function contrastarConBaseline(informe) {
  if (!existsSync(BASELINE)) {
    console.log('\nNo hay baseline todavía. Corré con --baseline para grabarlo.');
    return 0;
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  return informar(comparar(informe, base));
}

/** Las celdas que el baseline no tiene no se comparan: son vistas o anchos nuevos. */
function comparar(informe, base) {
  const peores = [];
  let mejoras = 0;
  for (const [clave, ahora] of Object.entries(informe)) {
    if (!base[clave]) continue;
    const cambios = compararCelda(clave, base[clave], ahora);
    peores.push(...cambios.peores);
    mejoras += cambios.mejoras;
  }
  return { peores, mejoras };
}

function compararCelda(clave, antes, ahora) {
  // Una celda que antes se medía y ahora no es una regresión: sin esto,
  // olvidarse de levantar el server da todas las celdas en ERR y un verde.
  if (ahora.error) {
    const linea = `${clave}: no se pudo medir (${ahora.error.slice(0, 60)})`;
    return { peores: [{ linea, ejemplos: [] }], mejoras: 0 };
  }
  const cambios = { peores: [], mejoras: 0 };
  if (antes.error) return cambios;
  for (const m of METRICAS) {
    const a = antes[m.campo] ?? 0;
    const b = ahora[m.campo] ?? 0;
    if (b < a) cambios.mejoras++;
    if (b <= a) continue;
    const ejemplos = m.detalle ? ahora.detalle[m.detalle] : [];
    cambios.peores.push({ linea: `${clave} ${m.campo}: ${a} → ${b}`, ejemplos });
  }
  return cambios;
}

function informar({ peores, mejoras }) {
  if (mejoras) console.log(`\n${mejoras} métricas mejoraron.`);
  if (!peores.length) {
    console.log('\nSin regresiones respecto del baseline.');
    return 0;
  }
  console.log(`\n${peores.length} métricas EMPEORARON respecto del baseline:`);
  for (const { linea, ejemplos } of peores) {
    console.log(`  ${linea}`);
    for (const e of ejemplos.slice(0, MAX_EJEMPLOS)) console.log(`      ${JSON.stringify(e)}`);
  }
  return 1;
}
