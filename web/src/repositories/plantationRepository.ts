import { errorDeSupabase } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';
import { ESTADO_PLANTACION } from '../queries/plantationQueries';
import type { Perfil } from './profileRepository';
import {
  editarCamposDePlantacion,
  type ConflictoDeEdicionError,
  type ValoresDePlantacion,
} from './edicionDePlantacion';

/** Columnas que el repositorio escribe por nombre. */
export const COLUMNA = {
  visibleInApp: 'visible_in_app',
  fotoEnTodos: 'photo_capture_all_trees',
  gpsFrecuencia: 'gps_capture_frequency',
  gpsObligatoria: 'gps_capture_required',
} as const;

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

/**
 * Archivar va por RPC porque la policy UPDATE no deja tocar una archivada (#477);
 * eliminar, porque no hay policy DELETE y las reglas viven en SQL (#478).
 */
const RPC_PLANTACION = {
  archivar: 'archivar_plantacion',
  desarchivar: 'desarchivar_plantacion',
  eliminar: 'eliminar_plantacion',
  reabrir: 'reabrir_plantacion',
} as const;

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
  if (!puedeReintentar) throw errorDeSupabase(resultado.error);
  const reintento = await operacion(base);
  if (reintento.error) throw errorDeSupabase(reintento.error);
  return reintento.data;
}

/**
 * Best-effort: si el borrado también falla queda una plantación huérfana, pero se prioriza el error original.
 * Va por RPC porque no hay policy DELETE sobre `plantations` (#480); recién creada no tiene datos, así que alcanza con ser admin.
 */
async function borrarPlantacionHuerfana(plantationId: string): Promise<void> {
  try {
    await supabase.rpc(RPC_PLANTACION.eliminar, { p_id: plantationId });
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
  throw errorDeSupabase(error);
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

/** Columnas del formulario; un opcional vacío es null, así borrarlo llega a la base. */
function columnasDelFormulario(input: PlantacionInput): ValoresDePlantacion {
  return {
    lugar: input.lugar,
    periodo: input.periodo,
    descripcion: input.descripcion ?? null,
    fecha_inicio: input.fechaInicio ?? null,
    objetivo_arboles: input.objetivoArboles ?? null,
  };
}

/**
 * Guarda los campos del formulario que cambiaron respecto de `base` (lo que tenía
 * al abrirse). Nunca toca `estado` ni `organizacion_id`. Si alguien cambió uno de
 * esos campos mientras tanto, lanza `ConflictoDeEdicionError` y guarda el resto.
 */
export async function editarPlantacion(
  id: string,
  input: PlantacionInput,
  base: PlantacionInput,
): Promise<void> {
  await editarCamposDePlantacion(id, columnasDelFormulario(input), columnasDelFormulario(base));
}

const CAMPO_DE_COLUMNA = {
  lugar: 'lugar',
  periodo: 'periodo',
  descripcion: 'descripcion',
  fecha_inicio: 'fechaInicio',
  objetivo_arboles: 'objetivoArboles',
} as const satisfies Record<string, keyof PlantacionInput>;

function esColumnaDelFormulario(columna: string): columna is keyof typeof CAMPO_DE_COLUMNA {
  return columna in CAMPO_DE_COLUMNA;
}

/** Lo que quedó en el server tras un conflicto: el valor de otro donde chocó, lo enviado donde no. */
export function plantacionTrasConflicto(
  input: PlantacionInput,
  conflicto: ConflictoDeEdicionError,
): PlantacionInput {
  const resultado: Record<string, unknown> = { ...input };
  for (const { campo, valorServidor } of conflicto.conflictos) {
    if (esColumnaDelFormulario(campo))
      resultado[CAMPO_DE_COLUMNA[campo]] = valorServidor ?? undefined;
  }
  return resultado as PlantacionInput;
}

export type ConfigGps = {
  /** Cada cuántos árboles se captura GPS (entero ≥ 1, validado por la UI). */
  frecuencia: number;
  obligatoria: boolean;
};

function columnasGps(config: ConfigGps): ValoresDePlantacion {
  return {
    [COLUMNA.gpsFrecuencia]: config.frecuencia,
    [COLUMNA.gpsObligatoria]: config.obligatoria,
  };
}

/** Guarda la configuración de captura GPS (afecta solo registros futuros). */
export async function actualizarConfigGps(
  id: string,
  config: ConfigGps,
  base: ConfigGps,
): Promise<void> {
  await editarCamposDePlantacion(id, columnasGps(config), columnasGps(base));
}

/** Un toggle cambia al valor opuesto: la base es `!valor`. */
function guardarToggle(columna: string) {
  return (id: string, valor: boolean) =>
    editarCamposDePlantacion(id, { [columna]: valor }, { [columna]: !valor });
}

/** Toggle de UX, NO frontera de seguridad: el filtrado es client-side; quien puede leer la plantación la sigue leyendo oculta. */
export const actualizarVisibilidad = guardarToggle(COLUMNA.visibleInApp);

/** Con el flag activo, en la app todos los botones de la botonera piden foto, como N/N (#439). Afecta solo registros futuros. */
export const actualizarFotoEnTodos = guardarToggle(COLUMNA.fotoEnTodos);

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
  if (error) throw errorDeSupabase(error);
  return (count ?? 0) > 0;
}

/** Errores de negocio que devuelven en `{ success: false, error }`. */
export const ERRORES_ARCHIVADO = {
  /** No es admin/superadmin activo de la organización de la plantación. */
  noAutorizado: 'NOT_AUTHORIZED',
} as const;

export const MENSAJE_ARCHIVADO_NO_AUTORIZADO =
  'Tu usuario no tiene permisos para archivar o desarchivar esta plantación.';
export const MENSAJE_ERROR_ARCHIVADO = 'No se pudo completar la acción. Probá de nuevo.';

const MENSAJES_ERROR_ARCHIVADO: Record<string, string> = {
  [ERRORES_ARCHIVADO.noAutorizado]: MENSAJE_ARCHIVADO_NO_AUTORIZADO,
};

type RespuestaArchivado = { success?: boolean; error?: string } | null;

/** Idempotentes: repetir la acción sobre una que ya está en ese estado no falla. */
async function ejecutarArchivado(rpc: string, id: string): Promise<void> {
  const { data, error } = await supabase.rpc(rpc, { p_id: id });
  if (error) throw new Error(MENSAJE_ERROR_ARCHIVADO);
  const respuesta = data as RespuestaArchivado;
  if (!respuesta?.success) {
    throw new Error(MENSAJES_ERROR_ARCHIVADO[respuesta?.error ?? ''] ?? MENSAJE_ERROR_ARCHIVADO);
  }
}

export const ERRORES_REAPERTURA = {
  /** No es superadmin activo de la organización de la plantación. */
  noAutorizado: 'NOT_AUTHORIZED',
  archivada: 'PLANTACION_ARCHIVADA',
} as const;

export const MENSAJE_ERROR_REAPERTURA = 'No se pudo reabrir la plantación. Probá de nuevo.';

const MENSAJES_ERROR_REAPERTURA: Record<string, string> = {
  [ERRORES_REAPERTURA.noAutorizado]: 'Solo un superadmin puede reabrir una plantación.',
  [ERRORES_REAPERTURA.archivada]: 'La plantación está archivada: desarchivala antes de reabrirla.',
};

/**
 * Devuelve una plantación finalizada al estado activo (#470). Idempotente: si
 * ya estaba activa no falla. Los grupos conservan su estado.
 */
export async function reabrirPlantacion(id: string): Promise<void> {
  const { data, error } = await supabase.rpc(RPC_PLANTACION.reabrir, { p_id: id });
  if (error) throw new Error(MENSAJE_ERROR_REAPERTURA);
  const respuesta = data as RespuestaArchivado;
  if (!respuesta?.success) {
    throw new Error(MENSAJES_ERROR_REAPERTURA[respuesta?.error ?? ''] ?? MENSAJE_ERROR_REAPERTURA);
  }
}

export function archivarPlantacion(id: string): Promise<void> {
  return ejecutarArchivado(RPC_PLANTACION.archivar, id);
}

/** No cambia `estado`: una finalizada sigue finalizada. */
export function desarchivarPlantacion(id: string): Promise<void> {
  return ejecutarArchivado(RPC_PLANTACION.desarchivar, id);
}
