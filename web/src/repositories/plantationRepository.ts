import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { ESTADO_PLANTACION } from '../queries/plantationQueries';
import type { Perfil } from './profileRepository';

/** Los opcionales ausentes no se mandan a la base: la migración 024 puede no estar aplicada. */
export type PlantacionInput = {
  lugar: string;
  periodo: string;
  descripcion?: string;
  fechaInicio?: string;
  objetivoArboles?: number;
};

/** Toda plantación nueva arranca con esta parcela default (paridad con mobile). */
const PARCELA_DEFAULT = { codigo: 'P1', nombre: 'Parcela 1' } as const;

/** Migración 023 sin aplicar: faltan las columnas de captura GPS. */
export const MENSAJE_GPS_SIN_MIGRACION =
  'Configuración GPS no disponible: falta aplicar la migración 023';

/** Migración 024 sin aplicar: falta la columna `visible_in_app`. */
export const MENSAJE_VISIBILIDAD_SIN_MIGRACION =
  'Visibilidad no disponible: falta aplicar la migración 024';

type Payload = Record<string, string | number | boolean>;
type ErrorSupabase = { message: string; code?: string } | null;
type ResultadoSupabase = { data: unknown; error: ErrorSupabase };

/** Columnas que siempre existen en `plantations` (pre-024). */
function camposBase(input: PlantacionInput): Payload {
  return { lugar: input.lugar, periodo: input.periodo };
}

/** Solo campos con valor: PostgREST rechaza columnas desconocidas si van undefined/null. */
function campos024(input: PlantacionInput): Payload {
  const campos: Payload = {};
  if (input.descripcion !== undefined) campos.descripcion = input.descripcion;
  if (input.fechaInicio !== undefined) campos.fecha_inicio = input.fechaInicio;
  if (input.objetivoArboles !== undefined) campos.objetivo_arboles = input.objetivoArboles;
  return campos;
}

function esColumnaInexistente(error: ErrorSupabase): boolean {
  return error?.code === PG_ERROR.UNDEFINED_COLUMN;
}

/** Reintenta solo con `base` si `extras` falla por columna inexistente (024 sin aplicar). */
async function ejecutarConReintentoSin024(
  operacion: (payload: Payload) => PromiseLike<ResultadoSupabase>,
  base: Payload,
  extras: Payload,
): Promise<unknown> {
  const resultado = await operacion({ ...base, ...extras });
  if (!resultado.error) return resultado.data;
  const puedeReintentar = Object.keys(extras).length > 0 && esColumnaInexistente(resultado.error);
  if (!puedeReintentar) throw new Error(resultado.error.message);
  const reintento = await operacion(base);
  if (reintento.error) throw new Error(reintento.error.message);
  return reintento.data;
}

/** Best-effort: si el delete también falla queda una plantación huérfana, pero se prioriza el error original. */
async function borrarPlantacionHuerfana(plantationId: string): Promise<void> {
  try {
    await supabase.from('plantations').delete().eq('id', plantationId);
  } catch {
    // Sin red no hay más por hacer; el error original ya se propaga.
  }
}

async function crearParcelaDefault(plantationId: string): Promise<void> {
  const { error } = await supabase
    .from('parcelas')
    .insert({ plantation_id: plantationId, ...PARCELA_DEFAULT });
  if (!error) return;
  await borrarPlantacionHuerfana(plantationId);
  throw new Error(error.message);
}

/** Crea la plantación (estado 'activa') junto con su parcela default P1. */
export async function crearPlantacion(input: PlantacionInput, perfil: Perfil): Promise<string> {
  const base: Payload = {
    ...camposBase(input),
    estado: ESTADO_PLANTACION.activa,
    organizacion_id: perfil.organizacionId,
    creado_por: perfil.id,
  };
  const insertar = (payload: Payload) =>
    supabase.from('plantations').insert(payload).select('id').single();
  const data = await ejecutarConReintentoSin024(insertar, base, campos024(input));
  const id = (data as { id: string }).id;
  await crearParcelaDefault(id);
  return id;
}

/** Actualiza los campos del formulario; nunca toca `estado` (finalizar es flujo de mobile) ni `organizacion_id`. */
export async function editarPlantacion(id: string, input: PlantacionInput): Promise<void> {
  const actualizar = (payload: Payload) =>
    supabase.from('plantations').update(payload).eq('id', id);
  await ejecutarConReintentoSin024(actualizar, camposBase(input), campos024(input));
}

/** Si la columna no existe (migración sin aplicar), lanza `mensajeSinMigracion` en vez del error crudo. */
async function actualizarCampos(
  id: string,
  payload: Payload,
  mensajeSinMigracion: string,
): Promise<void> {
  const { error } = await supabase.from('plantations').update(payload).eq('id', id);
  if (!error) return;
  throw new Error(esColumnaInexistente(error) ? mensajeSinMigracion : error.message);
}

export type ConfigGps = {
  /** Cada cuántos árboles se captura GPS (entero ≥ 1, validado por la UI). */
  frecuencia: number;
  obligatoria: boolean;
};

/** Guarda la configuración de captura GPS (afecta solo registros futuros). */
export async function actualizarConfigGps(id: string, config: ConfigGps): Promise<void> {
  await actualizarCampos(
    id,
    { gps_capture_frequency: config.frecuencia, gps_capture_required: config.obligatoria },
    MENSAJE_GPS_SIN_MIGRACION,
  );
}

/** Toggle de UX, NO frontera de seguridad: el filtrado es client-side y la lectura de plantations es `using (true)`. */
export async function actualizarVisibilidad(id: string, visible: boolean): Promise<void> {
  await actualizarCampos(id, { visible_in_app: visible }, MENSAJE_VISIBILIDAD_SIN_MIGRACION);
}

/**
 * Chequeo soft de duplicado (no hay unique en la base), case-insensitive vía ilike; excluye la propia fila en edición.
 * ilike trata `%`/`_` como comodines, pero al ser solo advertencia no bloqueante un falso positivo es aceptable.
 */
export async function existePlantacion(
  lugar: string,
  periodo: string,
  excluirId?: string,
): Promise<boolean> {
  let consulta = supabase
    .from('plantations')
    .select('id', { count: 'exact', head: true })
    .ilike('lugar', lugar.trim())
    .ilike('periodo', periodo.trim());
  if (excluirId) consulta = consulta.neq('id', excluirId);
  const { count, error } = await consulta;
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
