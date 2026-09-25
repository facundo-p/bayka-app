/** Lo que la tarjeta necesita para avisar de pendientes varados (#638). */
import { db } from '../database/client';
import { plantations } from '../database/schema';
import { eq, isNotNull, or } from 'drizzle-orm';
import type { MotivoVarado } from '../constants/motivoVarado';
import { getResumenDePendientes } from './catalogQueries';
import { descartarLaSaca, motivoDeVarado, totalDeCambios, type ResumenDeDescarte } from '../utils/avisoPendientesVarados';

export type PendientesVarados = { motivo: MotivoVarado; resumen: ResumenDeDescarte };

type FilaParaDescarte = { pendingEdit: boolean; pendingSync: boolean };

async function resumenDeDescarte(plantacionId: string, fila: FilaParaDescarte): Promise<ResumenDeDescarte> {
  return { ...(await getResumenDePendientes(plantacionId)), edicion: fila.pendingEdit, alta: fila.pendingSync };
}

const columnasDeVarado = {
  id: plantations.id,
  lugar: plantations.lugar,
  motivoVarado: plantations.motivoVarado,
  eliminadaEnServidorEn: plantations.eliminadaEnServidorEn,
  pendingEdit: plantations.pendingEdit,
  pendingSync: plantations.pendingSync,
};

/** Por plantación, las que tienen un motivo y algo que no pudo subir. */
export async function getPendientesVarados(): Promise<Map<string, PendientesVarados>> {
  const filas = await db.select(columnasDeVarado).from(plantations)
    .where(or(isNotNull(plantations.motivoVarado), isNotNull(plantations.eliminadaEnServidorEn)));
  const varados = new Map<string, PendientesVarados>();
  for (const fila of filas) {
    const motivo = motivoDeVarado(fila);
    const resumen = await resumenDeDescarte(fila.id, fila);
    if (motivo && totalDeCambios(resumen) > 0) varados.set(fila.id, { motivo, resumen });
  }
  return varados;
}

export type DescarteDePlantacion = { lugar: string; resumen: ResumenDeDescarte; seVa: boolean };

/** Lo que dice la confirmación de "Descartar". `seVa`: la plantación sale del dispositivo. Null si no está. */
export async function getDescarteDePlantacion(plantacionId: string): Promise<DescarteDePlantacion | null> {
  const [fila] = await db.select(columnasDeVarado).from(plantations).where(eq(plantations.id, plantacionId));
  if (!fila) return null;
  return {
    lugar: fila.lugar,
    resumen: await resumenDeDescarte(plantacionId, fila),
    seVa: descartarLaSaca(fila),
  };
}
