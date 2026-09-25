/** Lo que la tarjeta necesita para avisar de pendientes varados (#638). */
import { db } from '../database/client';
import { plantations } from '../database/schema';
import { eq, isNotNull, or } from 'drizzle-orm';
import type { MotivoVarado } from '../constants/motivoVarado';
import { getResumenDePendientes } from './catalogQueries';
import { countPendingTreePhotos } from './pendingSyncQueries';
import { limpiarMotivoVarado } from '../repositories/PendientesVaradosRepository';
import {
  descartarLaSaca,
  motivoDeVarado,
  totalDeCambios,
  varadosDelResumen,
  type ResumenDeDescarte,
} from '../utils/avisoPendientesVarados';

export type PendientesVarados = { motivo: MotivoVarado; resumen: ResumenDeDescarte };

const columnasDeVarado = {
  id: plantations.id,
  lugar: plantations.lugar,
  motivoVarado: plantations.motivoVarado,
  eliminadaEnServidorEn: plantations.eliminadaEnServidorEn,
  pendingEdit: plantations.pendingEdit,
  pendingSync: plantations.pendingSync,
  lugarServer: plantations.lugarServer,
};

type FilaDeVarado = Pick<typeof plantations.$inferSelect, keyof typeof columnasDeVarado>;

/** Lo que se pierde al descartar: todo si la plantación sale del dispositivo; si no, solo lo que no sube. */
async function resumenDeDescarte(fila: FilaDeVarado): Promise<ResumenDeDescarte> {
  const [fotos] = await countPendingTreePhotos({ plantacionId: fila.id });
  const completo: ResumenDeDescarte = {
    ...(await getResumenDePendientes(fila.id)),
    fotos: fotos?.cnt ?? 0,
    edicion: fila.pendingEdit,
    alta: fila.pendingSync,
    // `subirFilaDeAlta` deja el snapshot recién cuando el insert subió.
    altaEnServidor: fila.pendingSync && fila.lugarServer != null,
  };
  return descartarLaSaca(fila) ? completo : varadosDelResumen(completo, fila.motivoVarado);
}

/**
 * Por plantación, las que tienen un motivo y algo que no pudo subir. Un motivo sin nada
 * pendiente (se subió o se borró por otra vía) se limpia: no debe reaparecer con el próximo cambio.
 */
export async function getPendientesVarados(): Promise<Map<string, PendientesVarados>> {
  const filas = await db.select(columnasDeVarado).from(plantations)
    .where(or(isNotNull(plantations.motivoVarado), isNotNull(plantations.eliminadaEnServidorEn)));
  const varados = new Map<string, PendientesVarados>();
  for (const fila of filas) {
    const motivo = motivoDeVarado(fila);
    const resumen = await resumenDeDescarte(fila);
    if (motivo && totalDeCambios(resumen) > 0) varados.set(fila.id, { motivo, resumen });
    else if (fila.motivoVarado) await limpiarMotivoVarado(fila.id);
  }
  return varados;
}

export type DescarteDePlantacion = { lugar: string; resumen: ResumenDeDescarte; seVa: boolean; motivo: MotivoVarado | null };

/** Lo que dice la confirmación de "Descartar". `seVa`: la plantación sale del dispositivo. Null si no está. */
export async function getDescarteDePlantacion(plantacionId: string): Promise<DescarteDePlantacion | null> {
  const [fila] = await db.select(columnasDeVarado).from(plantations).where(eq(plantations.id, plantacionId));
  if (!fila) return null;
  return { lugar: fila.lugar, resumen: await resumenDeDescarte(fila), seVa: descartarLaSaca(fila), motivo: motivoDeVarado(fila) };
}
