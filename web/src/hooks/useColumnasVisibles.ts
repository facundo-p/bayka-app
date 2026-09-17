import type { TableColumn } from '../components/Table';
import { BP, useMediaQuery } from './useMediaQuery';

/**
 * Columnas que entran en el ancho actual.
 *
 * Se filtra el array y no se esconden las celdas por CSS: esconder `<td>` por
 * `nth-child` obliga a esconder el `<th>` por el mismo índice, y el día que
 * alguien inserte una columna en el medio los dos se desalinean en silencio.
 * Filtrando, la relación encabezado↔celda no se puede romper y el árbol de
 * accesibilidad queda coherente.
 */
export function useColumnasVisibles<T>(
  columnas: Array<TableColumn<T>>,
  conPanel = false,
): Array<TableColumn<T>> {
  const movil = useMediaQuery(BP.movil);
  if (!movil && !conPanel) return columnas;
  return columnas.filter(
    (columna) => !(movil && columna.fueraEnMovil) && !(conPanel && columna.fueraConPanel),
  );
}
