/**
 * Caché de los técnicos activos de la organización (#636), para que el admin pueda
 * asignarlos sin conexión. Solo lo baja un admin: es el único que asigna, y la RLS
 * de `profiles` ya lo acota a su organización.
 */
import { supabase } from '../../supabase/client';
import { readCachedRole } from '../../supabase/auth';
import { esRolAdmin } from '../../types/domain';
import { ROL } from '../../constants/roles';
import { reemplazarTecnicosDeOrganizacion } from '../../repositories/TecnicosDePlantacionRepository';

/** Lanza ante un error de red o del server: el caché anterior queda como estaba. */
export async function pullTecnicosDeOrganizacion(): Promise<void> {
  if (!esRolAdmin(await readCachedRole())) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, organizacion_id')
    .eq('rol', ROL.tecnico)
    // Un técnico dado de baja no puede loguearse: no se ofrece asignarlo.
    .eq('activo', true);
  if (error) throw error;
  await reemplazarTecnicosDeOrganizacion((data ?? []).map((t: any) => ({
    id: t.id,
    organizacionId: t.organizacion_id,
    nombre: t.nombre ?? '',
  })));
}
