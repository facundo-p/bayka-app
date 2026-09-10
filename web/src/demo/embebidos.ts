/** Embebidos de un select (`tabla(...)`, `tabla!inner(...)`, anidados), resueltos
 *  por FK contra las fixtures. */
import { COLUMNA_QUE_APUNTA_A, TABLAS, type FilaDemo } from './datos';
import { partirNivelSuperior } from './gramatica';

export type Embebido = { tabla: string; anidados: Embebido[] };

const PATRON_EMBEBIDO = /^(\w+)(?:!\w+)?\((.*)\)$/s;

export function embebidosDe(columnas: string): Embebido[] {
  return partirNivelSuperior(columnas).flatMap((columna) => {
    const coincidencia = PATRON_EMBEBIDO.exec(columna);
    return coincidencia ? [{ tabla: coincidencia[1], anidados: embebidosDe(coincidencia[2]) }] : [];
  });
}

/** Solo many-to-one, que es lo único que embebe la web: PostgREST lo devuelve
 *  como objeto, o null si la FK no apunta a nada. Si la fila no tiene la FK
 *  (one-to-many, que llegaría como array), el embebido no se agrega. */
export function conEmbebidos(fila: FilaDemo, embebidos: Embebido[]): FilaDemo {
  const resuelta = { ...fila };
  for (const embebido of embebidos) {
    const columna = COLUMNA_QUE_APUNTA_A[embebido.tabla];
    if (columna && columna in fila) resuelta[embebido.tabla] = filaApuntada(fila[columna], embebido);
  }
  return resuelta;
}

function filaApuntada(id: unknown, { tabla, anidados }: Embebido): FilaDemo | null {
  const apuntada = TABLAS[tabla]?.filas.find((fila) => fila.id === id);
  return apuntada ? conEmbebidos(apuntada, anidados) : null;
}
