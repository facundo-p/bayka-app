import { useEffect } from 'react';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';

/**
 * Un `parcela=<id>` en la URL que no existe entre las opciones (p. ej. de otra
 * plantación) dejaría el select en una opción fantasma vacía y la tabla
 * filtrada por ella; se suelta a "todas". Solo con parcelas ya cargadas, para
 * no soltarla durante la carga. Lo llama la sección y no el select, que vive en
 * el panel de filtros y solo se monta con el panel abierto.
 */
export function useSoltarParcelaFantasma(
  parcelas: ParcelaConStats[],
  parcelaId: string,
  soltar: (parcelaId: string) => void,
) {
  const idFantasma = parcelaId !== '' && !parcelas.some((parcela) => parcela.id === parcelaId);
  useEffect(() => {
    if (parcelas.length > 0 && idFantasma) soltar('');
  }, [parcelas.length, idFantasma, soltar]);
}
