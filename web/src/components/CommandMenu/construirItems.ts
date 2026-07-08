import type { ResultadoBusqueda, TipoResultado } from '../../queries/buscarQueries';
import type { AccionRapida } from './accionesRapidas';
import { ORDEN_TIPOS, metaDeTipo } from './tiposResultado';

/** Ítem navegable de la paleta: una acción o un resultado de entidad. */
export type ItemPaleta =
  | { clase: 'accion'; accion: AccionRapida }
  | { clase: 'resultado'; resultado: ResultadoBusqueda };

/** Sección renderizable: encabezado + sus ítems (con su índice en la lista plana). */
export type Seccion = {
  clave: string;
  titulo: string;
  items: Array<{ item: ItemPaleta; indice: number }>;
};

function agruparResultados(resultados: ResultadoBusqueda[]): Map<TipoResultado, ResultadoBusqueda[]> {
  const grupos = new Map<TipoResultado, ResultadoBusqueda[]>();
  for (const resultado of resultados) {
    const lista = grupos.get(resultado.tipo) ?? [];
    lista.push(resultado);
    grupos.set(resultado.tipo, lista);
  }
  return grupos;
}

/** to del ítem, sea acción o resultado. */
export function destinoDeItem(item: ItemPaleta): string {
  return item.clase === 'accion' ? item.accion.to : item.resultado.to;
}

type EntradasPaleta = {
  acciones: AccionRapida[];
  resultados: ResultadoBusqueda[];
  recientes: ResultadoBusqueda[];
  hayTexto: boolean;
};

/** Arma las secciones a renderizar y la lista plana ordenada para el teclado.
 *  Con texto: acciones + resultados agrupados. Sin texto: recientes. */
export function construirItems(entradas: EntradasPaleta): {
  secciones: Seccion[];
  itemsPlanos: ItemPaleta[];
} {
  const itemsPlanos: ItemPaleta[] = [];
  const secciones: Seccion[] = [];
  const empujarSeccion = (clave: string, titulo: string, items: ItemPaleta[]) => {
    if (items.length === 0) return;
    const conIndice = items.map((item) => ({ item, indice: itemsPlanos.push(item) - 1 }));
    secciones.push({ clave, titulo, items: conIndice });
  };

  if (!entradas.hayTexto) {
    empujarSeccion(
      'recientes',
      'Recientes',
      entradas.recientes.map((resultado) => ({ clase: 'resultado', resultado })),
    );
    return { secciones, itemsPlanos };
  }

  empujarSeccion(
    'acciones',
    'Acciones',
    entradas.acciones.map((accion) => ({ clase: 'accion', accion })),
  );
  const grupos = agruparResultados(entradas.resultados);
  for (const tipo of ORDEN_TIPOS) {
    const delTipo = grupos.get(tipo) ?? [];
    empujarSeccion(
      tipo,
      tituloDeTipo(tipo),
      delTipo.map((resultado) => ({ clase: 'resultado', resultado })),
    );
  }
  return { secciones, itemsPlanos };
}

function tituloDeTipo(tipo: TipoResultado): string {
  return metaDeTipo(tipo).etiqueta;
}
