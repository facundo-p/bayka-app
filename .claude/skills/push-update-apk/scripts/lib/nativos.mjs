/**
 * Diferencias nativas entre el mobile de un APK publicado y el working tree (#678).
 * Puro: la lectura de git, node_modules y el APK vive en nativos-vs-base.mjs.
 */
import { createRequire } from 'node:module';

const { SUFIJO_ARBOL_SUCIO } = createRequire(import.meta.url)(
  '../../../../../scripts/commitDelBuild.cjs',
);

export const CAMBIO = Object.freeze({
  agregado: 'agregado',
  quitado: 'quitado',
  version: 'version',
});

/** Nativo según node_modules; `null` si el paquete no está instalado (p. ej. uno quitado). */
export const NATIVO = Object.freeze({ si: true, no: false, desconocido: null });

/**
 * Dependencias agregadas, quitadas o con otra versión que son (o pueden ser) nativas.
 * Las JS puras quedan afuera: viajan en el OTA sin problema.
 *
 * @param {Record<string, string>} base dependencies del package.json del APK
 * @param {Record<string, string>} actual dependencies del working tree
 * @param {(nombre: string) => boolean | null} esNativo
 * @returns {{ nombre: string, cambio: string, desde?: string, hasta?: string, nativo: boolean | null }[]}
 */
export function cambiosNativos(base, actual, esNativo) {
  const nombres = [...new Set([...Object.keys(base), ...Object.keys(actual)])].sort();
  return nombres
    .map((nombre) => clasificar(nombre, base[nombre], actual[nombre]))
    .filter(Boolean)
    .map((c) => ({ ...c, nativo: esNativo(c.nombre) }))
    .filter((c) => c.nativo !== NATIVO.no);
}

function clasificar(nombre, desde, hasta) {
  if (desde === hasta) return null;
  if (desde === undefined) return { nombre, cambio: CAMBIO.agregado, hasta };
  if (hasta === undefined) return { nombre, cambio: CAMBIO.quitado, desde };
  return { nombre, cambio: CAMBIO.version, desde, hasta };
}

/** Config plugins de `expo.plugins` (string o [nombre, opciones]) agregados o quitados. */
export function cambiosDePlugins(base, actual) {
  const nombres = (plugins) => new Set((plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p)));
  const antes = nombres(base);
  const ahora = nombres(actual);
  return {
    agregados: [...ahora].filter((p) => !antes.has(p)).sort(),
    quitados: [...antes].filter((p) => !ahora.has(p)).sort(),
  };
}

/** Marcas de un paquete con código o config nativa que autolinking/prebuild levantan. */
export const MARCAS_NATIVAS = Object.freeze([
  'android',
  'expo-module.config.json',
  'react-native.config.js',
  'app.plugin.js',
]);

/** "a1b2c3d-dirty" → "a1b2c3d": commitDelBuild marca así un build con cambios sin commitear. */
export function commitSinSufijo(commit) {
  return commit.endsWith(SUFIJO_ARBOL_SUCIO) ? commit.slice(0, -SUFIJO_ARBOL_SUCIO.length) : commit;
}
