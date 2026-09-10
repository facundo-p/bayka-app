import { normalizarTexto } from '../lib/normalizarTexto';

export interface OpcionConDetalle {
  valor: string;
  principal: string;
  /** Segundo renglón, más chico y tenue (ej. el email). */
  secundario?: string | null;
}

/** Opciones cuyo texto principal o secundario contiene la búsqueda, sin distinguir acentos. */
export function filtrarOpciones(
  opciones: OpcionConDetalle[],
  busqueda: string,
): OpcionConDetalle[] {
  const termino = normalizarTexto(busqueda.trim());
  if (!termino) return opciones;
  return opciones.filter((opcion) =>
    [opcion.principal, opcion.secundario ?? ''].some((texto) =>
      normalizarTexto(texto).includes(termino),
    ),
  );
}
