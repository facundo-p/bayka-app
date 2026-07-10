/*
 * Filas de exportación de una plantación (planilla CSV/Excel).
 *
 * Espeja el esquema canónico de mobile (`getExportRows` en
 * mobile/src/queries/exportQueries.ts, D-18-08/09/10): trees → groups →
 * plantations, con LEFT JOIN a parcelas y a species. El LEFT JOIN a species es
 * deliberado: un árbol con `species_id` null o huérfano (especie ausente del
 * catálogo) NUNCA debe caerse del export — el consumidor lo marca "N/N".
 *
 * Lectura paginada con `leerPaginado` para no toparse con el `max-rows` (1000)
 * de PostgREST: plantaciones con miles de árboles se exportan completas.
 *
 * NOTA de columnas (D-18-09): `zona` y `plantacion` resuelven ambas a
 * `plantations.lugar`; se mantienen como dos columnas por compatibilidad con la
 * planilla histórica.
 */
import { supabase } from '../lib/supabase';
import { leerPaginado } from './leerPaginado';

/**
 * Fila cruda de una unidad exportable (un árbol). Preserva los nulls tal como
 * llegan de la base: la normalización ("N/N", celdas vacías) es responsabilidad
 * del constructor de CSV, no de la query.
 */
export type FilaExportacion = {
  /** `global_id` del árbol (ID final); null si aún no se generó. */
  idGlobal: number | null;
  /** `plantacion_id` del árbol (ID parcial entero); null si no tiene. */
  idParcial: number | null;
  /** Lugar de la plantación (columna "Zona"). */
  zona: string;
  /** Lugar de la plantación (columna "Plantación"). */
  plantacion: string;
  /** Nombre de la parcela; null cuando el grupo no tiene parcela (LEFT JOIN). */
  parcela: string | null;
  /** Nombre del grupo. */
  grupo: string;
  /** `sub_id` del árbol. */
  subId: string;
  /** Período de la plantación. */
  periodo: string;
  /** Nombre de la especie; null si el árbol no tiene especie o es huérfana. */
  especie: string | null;
};

/**
 * Fila cruda del embed de PostgREST. Los embeds son many-to-one, así que en
 * runtime llegan como objetos (el cliente sin typegen los tipa como array).
 */
type FilaCruda = {
  global_id: number | null;
  plantacion_id: number | null;
  sub_id: string;
  species: { nombre: string } | null;
  groups: {
    nombre: string;
    plantations: { lugar: string; periodo: string } | null;
    parcelas: { nombre: string } | null;
  } | null;
};

/**
 * Columnas + embeds del export. El scope por plantación va por el join interno
 * `groups!inner(plantation_id)` (mismo patrón que idsQueries/mapaQueries);
 * `plantations`, `parcelas` y `species` se embeben para el resto de columnas.
 */
const SELECT_EXPORTACION =
  'global_id, plantacion_id, sub_id, species(nombre), ' +
  'groups!inner(nombre, plantation_id, plantations(lugar, periodo), parcelas(nombre))';

function mapearFila(fila: FilaCruda): FilaExportacion {
  const lugar = fila.groups?.plantations?.lugar ?? '';
  return {
    idGlobal: fila.global_id,
    idParcial: fila.plantacion_id,
    zona: lugar,
    plantacion: lugar,
    parcela: fila.groups?.parcelas?.nombre ?? null,
    grupo: fila.groups?.nombre ?? '',
    subId: fila.sub_id,
    periodo: fila.groups?.plantations?.periodo ?? '',
    especie: fila.species?.nombre ?? null,
  };
}

/**
 * Filas de exportación de la plantación, ordenadas por `global_id` ASC. Los
 * `global_id` null quedan al final del orden ascendente de PostgREST (`NULLS
 * LAST` por defecto en Postgres). Lectura paginada: sin el tope de 1000 filas.
 */
export async function listarFilasExportacion(plantationId: string): Promise<FilaExportacion[]> {
  const filas = await leerPaginado<FilaCruda>((desde, hasta) =>
    supabase
      .from('trees')
      .select(SELECT_EXPORTACION)
      .eq('groups.plantation_id', plantationId)
      .order('global_id', { ascending: true })
      .range(desde, hasta) as unknown as PromiseLike<{
      data: FilaCruda[] | null;
      error: { message: string; code?: string } | null;
    }>,
  );
  return filas.map(mapearFila);
}
