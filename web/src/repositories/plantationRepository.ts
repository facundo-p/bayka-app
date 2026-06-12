import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';
import type { Perfil } from './profileRepository';

/** Datos del formulario ya validados y tipados. Los opcionales ausentes
 *  no se mandan a la base (la migración 024 puede no estar aplicada). */
export type PlantacionInput = {
  lugar: string;
  periodo: string;
  descripcion?: string;
  fechaInicio?: string;
  superficieHa?: number;
  ubicacionLat?: number;
  ubicacionLng?: number;
  objetivoArboles?: number;
};

/** Paridad con la parcela automática de mobile: toda plantación nueva
 *  arranca con esta parcela default. */
const PARCELA_DEFAULT = { codigo: 'P1', nombre: 'Parcela 1' } as const;

type Payload = Record<string, string | number>;
type ErrorSupabase = { message: string; code?: string } | null;
type ResultadoSupabase = { data: unknown; error: ErrorSupabase };

/** Columnas base que existen desde siempre en `plantations`. */
function camposBase(input: PlantacionInput): Payload {
  return { lugar: input.lugar, periodo: input.periodo };
}

/** Columnas de la migración 024 — solo las que tienen valor, sin claves
 *  undefined (PostgREST rechaza columnas desconocidas aunque vengan null). */
function campos024(input: PlantacionInput): Payload {
  const campos: Payload = {};
  if (input.descripcion !== undefined) campos.descripcion = input.descripcion;
  if (input.fechaInicio !== undefined) campos.fecha_inicio = input.fechaInicio;
  if (input.superficieHa !== undefined) campos.superficie_ha = input.superficieHa;
  if (input.ubicacionLat !== undefined) campos.ubicacion_lat = input.ubicacionLat;
  if (input.ubicacionLng !== undefined) campos.ubicacion_lng = input.ubicacionLng;
  if (input.objetivoArboles !== undefined) campos.objetivo_arboles = input.objetivoArboles;
  return campos;
}

function esColumnaInexistente(error: ErrorSupabase): boolean {
  return error?.code === PG_ERROR.UNDEFINED_COLUMN;
}

/**
 * Ejecuta la operación con todos los campos; si falla porque alguna columna
 * de la 024 no existe (migración sin aplicar), reintenta solo con la base.
 */
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

/** Borra la plantación recién creada si la parcela default falló. Es
 *  best-effort: si el delete también falla queda una plantación sin parcela,
 *  pero igual reportamos el error original al usuario. */
async function borrarPlantacionHuerfana(plantationId: string): Promise<void> {
  try {
    await supabase.from('plantations').delete().eq('id', plantationId);
  } catch {
    // Sin red no hay nada más que hacer; el error original ya se propaga.
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

/**
 * Crea la plantación (estado 'activa', organización y autor del perfil)
 * junto con su parcela default P1. Devuelve el id creado.
 */
export async function crearPlantacion(input: PlantacionInput, perfil: Perfil): Promise<string> {
  const base: Payload = {
    ...camposBase(input),
    estado: 'activa',
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

/**
 * Actualiza los campos del formulario. Nunca toca `estado` (finalizar es
 * flujo de mobile) ni `organizacion_id`.
 */
export async function editarPlantacion(id: string, input: PlantacionInput): Promise<void> {
  const actualizar = (payload: Payload) =>
    supabase.from('plantations').update(payload).eq('id', id);
  await ejecutarConReintentoSin024(actualizar, camposBase(input), campos024(input));
}

/**
 * Chequeo soft de duplicado por lugar+período (no hay unique en la base):
 * case-insensitive vía ilike. En edición se excluye la propia fila.
 * Nota: ilike trata `%`/`_` como comodines; al ser solo una advertencia
 * no bloqueante, un falso positivo con esos caracteres es aceptable.
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
