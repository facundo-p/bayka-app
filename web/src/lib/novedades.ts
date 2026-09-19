import novedadesRaw from '../../../NOVEDADES.md?raw';
import { ES_ENTORNO_DE_PRUEBAS, VERSION_APP } from './entorno';
import { esEntradaEnPruebas, parsearNovedades, type EntradaNovedades } from './parsearNovedades';

function sinPasos(entrada: EntradaNovedades): EntradaNovedades {
  return { ...entrada, items: entrada.items.map((item) => ({ ...item, pasos: undefined })) };
}

/**
 * Los pasos de prueba son para quien prueba staging: la web de pruebas los
 * muestra en cada versión y producción ve solo titular y detalle (#582). La
 * sección en pruebas tampoco debería existir en producción (`/deploy` la
 * convierte en la entrada de la versión), pero si se colara no se muestra.
 */
export function entradasVisibles(
  entradas: EntradaNovedades[],
  esEntornoDePruebas: boolean,
): EntradaNovedades[] {
  if (esEntornoDePruebas) return entradas;
  return entradas.filter((entrada) => !esEntradaEnPruebas(entrada)).map(sinPasos);
}

/**
 * Lo que el aviso del sidebar compara contra lo último visto. En staging suma la
 * marca de sincronización, así cada `/novedades` vuelve a encender el aviso
 * aunque la versión no se mueva hasta el pase a main.
 */
export function firmaNovedades(version: string, entradas: EntradaNovedades[]): string {
  const marca = entradas.find(esEntradaEnPruebas)?.sincronizadoHasta;
  return marca ? `${version} · ${marca}` : version;
}

// El archivo se hornea en el build: sin fetch, sin estado de carga. Si faltara,
// el build falla — que es lo que queremos.
export const ENTRADAS = entradasVisibles(parsearNovedades(novedadesRaw), ES_ENTORNO_DE_PRUEBAS);
export const FIRMA_NOVEDADES = firmaNovedades(VERSION_APP, ENTRADAS);
