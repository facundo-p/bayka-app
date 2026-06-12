import { supabase } from '../lib/supabase';

export type EstadoPlantacion = 'activa' | 'finalizada';

/** Fila cruda de `plantations`. `visible_in_app` llega con la migración 024,
 *  que puede no estar aplicada todavía: se tolera su ausencia. */
type FilaPlantacion = {
  id: string;
  lugar: string;
  periodo: string;
  estado: EstadoPlantacion;
  created_at: string;
  visible_in_app?: boolean | null;
};

export type PlantacionConStats = {
  id: string;
  lugar: string;
  periodo: string;
  estado: EstadoPlantacion;
  visibleInApp: boolean;
  createdAt: string;
  arboles: number;
  parcelas: number;
  usuarios: number;
};

function contarOLanzar(count: number | null, error: { message: string } | null): number {
  if (error) throw new Error(error.message);
  return count ?? 0;
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

async function conStats(fila: FilaPlantacion): Promise<PlantacionConStats> {
  const [arboles, parcelas, usuarios] = await Promise.all([
    contarArboles(fila.id),
    contarParcelas(fila.id),
    contarUsuarios(fila.id),
  ]);
  return {
    id: fila.id,
    lugar: fila.lugar,
    periodo: fila.periodo,
    estado: fila.estado,
    visibleInApp: fila.visible_in_app ?? true,
    createdAt: fila.created_at,
    arboles,
    parcelas,
    usuarios,
  };
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
