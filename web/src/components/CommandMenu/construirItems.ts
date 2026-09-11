import type { ResultadoBusqueda, TipoResultado } from '../../queries/buscarQueries';
import type { AccionRapida } from './accionesRapidas';
import { ORDEN_TIPOS, metaDeTipo } from './tiposResultado';

export const CLASE_ITEM = { accion: 'accion', resultado: 'resultado' } as const;

type ItemAccion = { clase: typeof CLASE_ITEM.accion; accion: AccionRapida };
type ItemResultado = { clase: typeof CLASE_ITEM.resultado; resultado: ResultadoBusqueda };

/** Ítem navegable de la paleta: una acción o un resultado de entidad. */
export type ItemPaleta = ItemAccion | ItemResultado;

/** Sección renderizable: encabezado + sus ítems (con su índice en la lista plana). */
export type Seccion = {
  clave: string;
  titulo: string;
  items: Array<{ item: ItemPaleta; indice: number }>;
};

/** Sección antes de numerar sus ítems. */
type Grupo = Omit<Seccion, 'items'> & { items: ItemPaleta[] };

const SECCION_RECIENTES = { clave: 'recientes', titulo: 'Recientes' } as const;
const SECCION_SUGERENCIAS = { clave: 'sugerencias', titulo: 'Sugerencias' } as const;
const SECCION_ACCIONES = { clave: 'acciones', titulo: 'Acciones' } as const;

export function esAccion(item: ItemPaleta): item is ItemAccion {
  return item.clase === CLASE_ITEM.accion;
}

export function esResultado(item: ItemPaleta): item is ItemResultado {
  return item.clase === CLASE_ITEM.resultado;
}

function itemDeAccion(accion: AccionRapida): ItemPaleta {
  return { clase: CLASE_ITEM.accion, accion };
}

function itemDeResultado(resultado: ResultadoBusqueda): ItemPaleta {
  return { clase: CLASE_ITEM.resultado, resultado };
}

/** to del ítem, sea acción o resultado. */
export function destinoDeItem(item: ItemPaleta): string {
  return esAccion(item) ? item.accion.to : item.resultado.to;
}

function agruparResultados(
  resultados: ResultadoBusqueda[],
): Map<TipoResultado, ResultadoBusqueda[]> {
  const grupos = new Map<TipoResultado, ResultadoBusqueda[]>();
  for (const resultado of resultados) {
    const lista = grupos.get(resultado.tipo) ?? [];
    lista.push(resultado);
    grupos.set(resultado.tipo, lista);
  }
  return grupos;
}

/** Un grupo por tipo de entidad, en el orden fijo de la paleta y no en el de llegada. */
function gruposPorTipo(resultados: ResultadoBusqueda[]): Grupo[] {
  const porTipo = agruparResultados(resultados);
  return ORDEN_TIPOS.map((tipo) => ({
    clave: tipo,
    titulo: metaDeTipo(tipo).etiqueta,
    items: (porTipo.get(tipo) ?? []).map(itemDeResultado),
  }));
}

/** Descarta los grupos vacíos y numera los ítems con su posición en la lista plana, que es
 *  el orden del teclado. */
function numerar(grupos: Grupo[]): { secciones: Seccion[]; itemsPlanos: ItemPaleta[] } {
  const itemsPlanos: ItemPaleta[] = [];
  const secciones = grupos
    .filter((grupo) => grupo.items.length > 0)
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.map((item) => ({ item, indice: itemsPlanos.push(item) - 1 })),
    }));
  return { secciones, itemsPlanos };
}

type EntradasPaleta = {
  acciones: AccionRapida[];
  resultados: ResultadoBusqueda[];
  recientes: ResultadoBusqueda[];
  sugerencias: ResultadoBusqueda[];
  hayTexto: boolean;
};

/** Sin texto se ve una sola lista con su propio encabezado: los recientes o, si todavía no
 *  hay, las sugerencias. */
function grupoSinTexto({ recientes, sugerencias }: EntradasPaleta): Grupo {
  if (recientes.length > 0) return { ...SECCION_RECIENTES, items: recientes.map(itemDeResultado) };
  return { ...SECCION_SUGERENCIAS, items: sugerencias.map(itemDeResultado) };
}

/** Arma las secciones a renderizar y la lista plana ordenada para el teclado.
 *  Con texto: acciones + resultados agrupados. Sin texto: recientes o sugerencias. */
export function construirItems(entradas: EntradasPaleta): ReturnType<typeof numerar> {
  if (!entradas.hayTexto) return numerar([grupoSinTexto(entradas)]);
  return numerar([
    { ...SECCION_ACCIONES, items: entradas.acciones.map(itemDeAccion) },
    ...gruposPorTipo(entradas.resultados),
  ]);
}
