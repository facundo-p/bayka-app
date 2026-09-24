import { db } from '../database/client';
import { plantations } from '../database/schema';
import { eq } from 'drizzle-orm';
import { plantacionEsEditable, type EstadoDeEdicionDePlantacion } from '../utils/permisosDeEdicion';

/** Estado, archivado y eliminación en el server: lo que decide los permisos de edición. Null si no está local. */
export async function getPlantationEstadoDeEdicion(
  plantacionId: string,
): Promise<EstadoDeEdicionDePlantacion | null> {
  const rows = await db
    .select({
      estado: plantations.estado,
      archivadaEn: plantations.archivadaEn,
      eliminadaEnServidorEn: plantations.eliminadaEnServidorEn,
    })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  return rows[0] ?? null;
}

/** Una plantación que no está local no es editable. */
export async function plantacionEditablePorId(plantacionId: string): Promise<boolean> {
  const estado = await getPlantationEstadoDeEdicion(plantacionId);
  return estado != null && plantacionEsEditable(estado);
}
