import { coincideBusqueda } from '../../lib/normalizarTexto';

export interface OpcionConDetalle {
  valor: string;
  principal: string;
  /** Segundo renglón, más chico y tenue (ej. el email). */
  secundario?: string | null;
}

/** Opciones cuyo texto principal o secundario contiene la búsqueda. */
export function filtrarOpciones(
  opciones: OpcionConDetalle[],
  busqueda: string,
): OpcionConDetalle[] {
  return opciones.filter((opcion) =>
    coincideBusqueda([opcion.principal, opcion.secundario], busqueda),
  );
}
