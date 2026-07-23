import { supabase } from '../lib/supabase';
import {
  GPS_CAPTURE_FREQUENCY_DEFAULT,
  GPS_CAPTURE_REQUIRED_DEFAULT,
} from '../lib/gpsDefaults';

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
    objetivoArboles: fila.objetivo_arboles ?? null,
  };
}

/** Fila del RPC stats_plantaciones (migración 027). */
type FilaStats = {
  plantation_id: string;
  arboles: number;
  parcelas: number;
  usuarios: number;
};

const SIN_STATS = { arboles: 0, parcelas: 0, usuarios: 0 };

/** Contadores de todas las plantaciones en una sola query agregada: los
 *  counts head por plantación (3×N simultáneos) saturaban el pooler (503). */
async function statsPorPlantacion(): Promise<Map<string, FilaStats>> {
  const { data, error } = await supabase.rpc('stats_plantaciones');
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaStats[];
  return new Map(filas.map((fila) => [fila.plantation_id, fila]));
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

function conStats(fila: FilaPlantacion, stats: Map<string, FilaStats>): PlantacionConStats {
  const { arboles, parcelas, usuarios } = stats.get(fila.id) ?? SIN_STATS;
  return { ...mapearPlantacion(fila), arboles, parcelas, usuarios };
}

/** Lista plantaciones ordenadas por lugar con sus contadores (2 requests). */
export async function listarPlantaciones(): Promise<PlantacionConStats[]> {
  const [{ data, error }, stats] = await Promise.all([
    supabase.from('plantations').select('*').order('lugar', { ascending: true }),
    statsPorPlantacion(),
  ]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaPlantacion[]).map((fila) => conStats(fila, stats));
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
