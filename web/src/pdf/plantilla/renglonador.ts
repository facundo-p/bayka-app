import { cortadorConMemoria } from './cortarTexto';
import type { Medidor } from './medirTexto';
import { partidorConMemoria, type Partidor } from './partirTexto';
import { CORTAR_TEXTO_LARGO } from './textoLargo';

/**
 * Los renglones de un texto en una caja de `ancho` pt, con memoria. Entero en
 * los que haga falta, o cortado con «…» en uno: lo decide `CORTAR_TEXTO_LARGO`.
 */
export function renglonador(medir: Medidor): Partidor {
  if (!CORTAR_TEXTO_LARGO) return partidorConMemoria(medir);
  const cortar = cortadorConMemoria(medir);
  return (texto, ancho, anchoPrimero = ancho) => [cortar(texto, anchoPrimero)];
}
