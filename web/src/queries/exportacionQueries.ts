/* Filas de exportación de una plantación (espeja `getExportRows` de mobile); LEFT JOIN a species
 * para que un árbol sin especie o huérfano nunca se caiga del export, se marca "N/N". */
import { idDeArbol } from '../../../shared/codigoPlantacion';
import { numerarPorIdParcial } from '../../../shared/idParcial';
import { supabase } from '../lib/supabase';
import { leerPaginado } from './leerPaginado';

/** Preserva los nulls de la base; la normalización ("N/N", celdas vacías) es responsabilidad del serializador, no de la query. */
export type FilaExportacion = {
  /** `<SubID>-<código de plantación>` (#559); solo el SubID si el embed de la plantación no llega. */
  idArbol: string;
  /** Número del árbol en la plantación, calculado al exportar (#822). */
  idParcial: number;
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
  id: string;
  posicion: number;
  sub_id: string;
  species: { nombre: string } | null;
  groups: {
    id: string;
    created_at: string;
    nombre: string;
    plantations: { lugar: string; periodo: string; codigo: string } | null;
    parcelas: ParcelaCruda | null;
  } | null;
};

/**
 * Columnas + embeds; scope por plantación vía `groups!inner(plantation_id)`. `parcelas.deleted_at`
 * no puede ir de filtro (`!inner` excluiría grupos sin parcela, caso válido); se post-filtra en `mapearFila`.
 */
const SELECT_EXPORTACION =
  'id, posicion, sub_id, species(nombre), ' +
  'groups!inner(id, created_at, nombre, plantation_id, plantations(lugar, periodo, codigo), parcelas(nombre, deleted_at))';

/** Null si el grupo no tiene parcela o si está soft-deleted (no debe salir en la planilla). */
function nombreParcela(parcela: ParcelaCruda | null): string | null {
  if (!parcela || parcela.deleted_at !== null) return null;
  return parcela.nombre;
}

function mapearFila({ fila, idParcial }: { fila: FilaCruda; idParcial: number }): FilaExportacion {
  const plantacion = fila.groups?.plantations;
  const lugar = plantacion?.lugar ?? '';
  return {
    idArbol: idDeArbol(fila.sub_id, plantacion?.codigo),
    idParcial,
    zona: lugar,
    plantacion: lugar,
    parcela: nombreParcela(fila.groups?.parcelas ?? null),
    grupo: fila.groups?.nombre ?? '',
    subId: fila.sub_id,
    periodo: plantacion?.periodo ?? '',
    especie: fila.species?.nombre ?? null,
  };
}

/** Lo que ordena el ID Parcial. */
function arbolNumerable(fila: FilaCruda) {
  return {
    fila,
    arbolId: fila.id,
    grupoId: fila.groups?.id ?? '',
    grupoCreadoEn: fila.groups?.created_at ?? '',
    posicion: fila.posicion,
  };
}

/**
 * En orden de ID Parcial, que se numera con la plantación entera: por eso se lee todo
 * antes de ordenar. Lectura paginada por `id` para evitar el tope de 1000 filas de PostgREST.
 */
export async function listarFilasExportacion(plantationId: string): Promise<FilaExportacion[]> {
  const filas = await leerPaginado<FilaCruda>(
    (desde, hasta) =>
      supabase
        .from('trees')
        .select(SELECT_EXPORTACION)
        .eq('groups.plantation_id', plantationId)
        .order('id')
        .range(desde, hasta) as unknown as PromiseLike<{
        data: FilaCruda[] | null;
        error: { message: string; code?: string } | null;
      }>,
  );
  return numerarPorIdParcial(filas.map(arbolNumerable)).map(mapearFila);
}
