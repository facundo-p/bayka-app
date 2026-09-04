/* Filas de exportación de una plantación (espeja `getExportRows` de mobile); LEFT JOIN a species
 * para que un árbol sin especie o huérfano nunca se caiga del export, se marca "N/N". */
import { supabase } from '../lib/supabase';
import { leerPaginado } from './leerPaginado';

/** Etiqueta para árboles sin especie: evita perder la fila (compartida por CSV y XLSX). */
export const ESPECIE_NO_RESUELTA = 'N/N';

/** Preserva los nulls de la base; la normalización ("N/N", celdas vacías) es responsabilidad del serializador, no de la query. */
export type FilaExportacion = {
  /** `global_id` (ID final, null si aún no se generó) y `plantacion_id` (ID parcial, null si no tiene). */
  idGlobal: number | null;
  idParcial: number | null;
  /** Columnas "Zona"/"Plantación" duplicadas (mismo valor) por compat con la planilla histórica. */
  zona: string;
  plantacion: string;
  /** Nombre de la parcela; null cuando el grupo no tiene parcela (LEFT JOIN). */
  parcela: string | null;
  grupo: string;
  subId: string;
  periodo: string;
  /** Nombre de la especie; null si el árbol no tiene especie o es huérfana. */
  especie: string | null;
};

/**
 * Fila cruda del embed de PostgREST: los embeds son many-to-one, así que en runtime llegan
 * como objetos (el cliente sin typegen los tipa como array). `deleted_at` no es parte de
 * `FilaExportacion` (ver `SELECT_EXPORTACION`).
 */
type ParcelaCruda = { nombre: string; deleted_at: string | null };

type FilaCruda = {
  global_id: number | null;
  plantacion_id: number | null;
  sub_id: string;
  species: { nombre: string } | null;
  groups: {
    nombre: string;
    plantations: { lugar: string; periodo: string } | null;
    parcelas: ParcelaCruda | null;
  } | null;
};

/**
 * Columnas + embeds; scope por plantación vía `groups!inner(plantation_id)`. `parcelas.deleted_at`
 * no puede ir de filtro (`!inner` excluiría grupos sin parcela, caso válido); se post-filtra en `mapearFila`.
 */
const SELECT_EXPORTACION =
  'global_id, plantacion_id, sub_id, species(nombre), ' +
  'groups!inner(nombre, plantation_id, plantations(lugar, periodo), parcelas(nombre, deleted_at))';

/** Null si el grupo no tiene parcela o si está soft-deleted (no debe salir en la planilla). */
function nombreParcela(parcela: ParcelaCruda | null): string | null {
  if (!parcela || parcela.deleted_at !== null) return null;
  return parcela.nombre;
}

function mapearFila(fila: FilaCruda): FilaExportacion {
  const lugar = fila.groups?.plantations?.lugar ?? '';
  return {
    idGlobal: fila.global_id,
    idParcial: fila.plantacion_id,
    zona: lugar,
    plantacion: lugar,
    parcela: nombreParcela(fila.groups?.parcelas ?? null),
    grupo: fila.groups?.nombre ?? '',
    subId: fila.sub_id,
    periodo: fila.groups?.plantations?.periodo ?? '',
    especie: fila.species?.nombre ?? null,
  };
}

/**
 * Ordenadas por `global_id` ASC (nulls al final, default de Postgres). Lectura paginada
 * para evitar el tope de 1000 filas de PostgREST.
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
