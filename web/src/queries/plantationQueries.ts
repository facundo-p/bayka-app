import { supabase } from '../lib/supabase';
import {
  GPS_CAPTURE_FREQUENCY_DEFAULT,
  GPS_CAPTURE_REQUIRED_DEFAULT,
} from '../lib/gpsDefaults';
import { contarOLanzar } from './conteo';

/** Estados posibles de una plantación. ÚNICA fuente de verdad de estos valores:
 *  el tipo `EstadoPlantacion` se deriva de acá, así que valor y tipo no se
 *  pueden desincronizar y nadie los redefine como literales sueltos. */
export const ESTADO_PLANTACION = {
  activa: 'activa',
  finalizada: 'finalizada',
} as const;

export type EstadoPlantacion = (typeof ESTADO_PLANTACION)[keyof typeof ESTADO_PLANTACION];

/** Fila cruda de `plantations`. Los campos opcionales llegan con las
 *  migraciones 023 (GPS) y 024, que pueden no estar aplicadas todavía:
 *  se tolera su ausencia. */
type FilaPlantacion = {
  id: string;
  lugar: string;
  periodo: string;
  estado: EstadoPlantacion;
  created_at: string;
  visible_in_app?: boolean | null;
  gps_capture_frequency?: number | null;
  gps_capture_required?: boolean | null;
  descripcion?: string | null;
  fecha_inicio?: string | null;
  superficie_ha?: number | null;
  ubicacion_lat?: number | null;
  ubicacion_lng?: number | null;
  objetivo_arboles?: number | null;
};

export type Plantacion = {
  id: string;
  lugar: string;
  periodo: string;
  estado: EstadoPlantacion;
  visibleInApp: boolean;
  gpsCaptureFrequency: number;
  gpsCaptureRequired: boolean;
  createdAt: string;
  descripcion: string | null;
  fechaInicio: string | null;
  superficieHa: number | null;
  ubicacionLat: number | null;
  ubicacionLng: number | null;
  objetivoArboles: number | null;
};

export type PlantacionConStats = Plantacion & {
  arboles: number;
  parcelas: number;
  usuarios: number;
};

/** Campos del formulario de edición: null si la 024 no está aplicada. */
function camposFormulario(fila: FilaPlantacion) {
  return {
    descripcion: fila.descripcion ?? null,
    fechaInicio: fila.fecha_inicio ?? null,
    superficieHa: fila.superficie_ha ?? null,
    ubicacionLat: fila.ubicacion_lat ?? null,
    ubicacionLng: fila.ubicacion_lng ?? null,
    objetivoArboles: fila.objetivo_arboles ?? null,
  };
}

/** Árboles de la plantación: trees → groups (join interno por plantation_id). */
async function contarArboles(plantationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('trees')
    .select('id, groups!inner(plantation_id)', { count: 'exact', head: true })
    .eq('groups.plantation_id', plantationId);
  return contarOLanzar(count, error);
}

/** Parcelas activas (excluye soft-deleted). */
async function contarParcelas(plantationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('parcelas')
    .select('id', { count: 'exact', head: true })
    .eq('plantation_id', plantationId)
    .is('deleted_at', null);
  return contarOLanzar(count, error);
}

/** Usuarios asignados a la plantación. */
async function contarUsuarios(plantationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('plantation_users')
    .select('user_id', { count: 'exact', head: true })
    .eq('plantation_id', plantationId);
  return contarOLanzar(count, error);
}

function mapearPlantacion(fila: FilaPlantacion): Plantacion {
  return {
    id: fila.id,
    lugar: fila.lugar,
    periodo: fila.periodo,
    estado: fila.estado,
    visibleInApp: fila.visible_in_app ?? true,
    gpsCaptureFrequency: fila.gps_capture_frequency ?? GPS_CAPTURE_FREQUENCY_DEFAULT,
    gpsCaptureRequired: fila.gps_capture_required ?? GPS_CAPTURE_REQUIRED_DEFAULT,
    createdAt: fila.created_at,
    ...camposFormulario(fila),
  };
}

async function conStats(fila: FilaPlantacion): Promise<PlantacionConStats> {
  const [arboles, parcelas, usuarios] = await Promise.all([
    contarArboles(fila.id),
    contarParcelas(fila.id),
    contarUsuarios(fila.id),
  ]);
  return { ...mapearPlantacion(fila), arboles, parcelas, usuarios };
}

/**
 * Lista plantaciones ordenadas por lugar con sus contadores.
 * Hace 3 counts por plantación (N+1): aceptable porque una organización
 * maneja pocas plantaciones y los counts head son baratos.
 */
export async function listarPlantaciones(): Promise<PlantacionConStats[]> {
  const { data, error } = await supabase
    .from('plantations')
    .select('*')
    .order('lugar', { ascending: true });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaPlantacion[];
  return Promise.all(filas.map(conStats));
}

/** Carga una plantación por id; null si no existe (o la RLS no la deja ver). */
export async function obtenerPlantacion(id: string): Promise<Plantacion | null> {
  const { data, error } = await supabase
    .from('plantations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapearPlantacion(data as FilaPlantacion) : null;
}

/**
 * Id de la plantación 'activa' con el registro de árbol MÁS RECIENTE (la última
 * temporada en la que se cargaron árboles), o null si ninguna activa tiene
 * árboles. Define la "Temporada activa" del sidebar.
 */
export async function obtenerTemporadaActivaId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('trees')
    .select('created_at, groups!inner(plantation_id, plantations!inner(estado))')
    .eq('groups.plantations.estado', ESTADO_PLANTACION.activa)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  // El embed many-to-one llega como objeto en runtime (el cliente lo tipa array).
  const fila = ((data ?? []) as unknown as Array<{ groups: { plantation_id: string } | null }>)[0];
  return fila?.groups?.plantation_id ?? null;
}
