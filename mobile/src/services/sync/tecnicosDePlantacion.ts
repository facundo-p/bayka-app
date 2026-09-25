/**
 * Sube las asignaciones de técnicos por `aplicar_cambios_tecnicos` (#636). Es
 * idempotente: reintentar lo mismo no cambia nada, así que un corte a mitad de
 * camino solo se reintenta.
 */
import { supabase } from '../../supabase/client';
import { syncLog } from '../../utils/syncLogger';
import { relanzarSiEsCancelacion } from './cancelacion';
import type { SyncPlantationResult } from './types';
import {
  getAltasPendientes,
  getNombresDeTecnicos,
  getPlantacionesConAltasDeTecnicos,
  confirmarAltasAceptadas,
  registrarAltasSubidas,
} from '../../repositories/TecnicosDePlantacionRepository';

export const RPC_APLICAR_CAMBIOS_TECNICOS = 'aplicar_cambios_tecnicos';

/** Por qué `aplicar_cambios_tecnicos` no asigna a un usuario: contrato con 059. */
export const RECHAZO_DE_TECNICO = {
  otraOrganizacion: 'USUARIO_DE_OTRA_ORGANIZACION',
  noEsTecnico: 'NO_ES_TECNICO',
  inactivo: 'TECNICO_INACTIVO',
} as const;

type RechazoDeTecnico = (typeof RECHAZO_DE_TECNICO)[keyof typeof RECHAZO_DE_TECNICO];
type Rechazado = { user_id: string; error: RechazoDeTecnico };
type RespuestaDeTecnicos = { success: boolean; error?: string; rechazados?: Rechazado[] } | null;

/** La plantación no admitió el cambio (nada se aplicó), o los nombres de los técnicos que el server no asignó. */
export type SubidaDeTecnicos = { rechazo: string } | { noAsignados: string[] };

export const esRechazoDePlantacion = (s: SubidaDeTecnicos): s is { rechazo: string } => 'rechazo' in s;

const SIN_ESPERA = { sinNadieQueAvise: () => false, alResponder: () => {} };

/** Lanza ante un error de red o del server. */
async function aplicarCambiosEnServidor(plantacionId: string, altas: string[], bajas: string[]): Promise<RespuestaDeTecnicos> {
  const { data, error } = await supabase.rpc(RPC_APLICAR_CAMBIOS_TECNICOS, {
    p_plantacion: plantacionId,
    p_altas: altas,
    p_bajas: bajas,
  });
  if (error) throw error;
  return data as RespuestaDeTecnicos;
}

/**
 * Sube las altas pendientes de la plantación junto con `bajas` (solo online). Lo
 * aceptado deja de estar pendiente; lo rechazado se quita del teléfono. Null si no
 * había nada que mandar.
 *
 * `sinNadieQueAvise`: la respuesta llegó cuando ya nadie puede mostrarla (la pantalla
 * se cerró). Entonces solo se confirma lo aceptado; lo rechazado queda pendiente y el
 * próximo sync lo reenvía, lo descarta y lo lista en el resumen. `alResponder` avisa
 * que llegó la respuesta, antes de decidir.
 */
export async function subirCambiosDeTecnicos(
  plantacionId: string,
  bajas: string[] = [],
  espera: { sinNadieQueAvise: () => boolean; alResponder: () => void } = SIN_ESPERA,
): Promise<SubidaDeTecnicos | null> {
  const enviadas = await getAltasPendientes(plantacionId);
  if (enviadas.length === 0 && bajas.length === 0) return null;
  const respuesta = await aplicarCambiosEnServidor(plantacionId, enviadas, bajas);
  espera.alResponder();
  if (!respuesta?.success) return { rechazo: respuesta?.error ?? '' };
  const rechazados = (respuesta.rechazados ?? []).map((r) => r.user_id);
  if (espera.sinNadieQueAvise()) {
    await confirmarAltasAceptadas(plantacionId, enviadas, rechazados);
    return { noAsignados: [] };
  }
  const noAsignados = await getNombresDeTecnicos(plantacionId, rechazados);
  await registrarAltasSubidas(plantacionId, enviadas, rechazados);
  return { noAsignados };
}

async function subirDeUnaPlantacion(p: { id: string; lugar: string }): Promise<SyncPlantationResult | null> {
  try {
    const subida = await subirCambiosDeTecnicos(p.id);
    if (!subida) return null;
    // Archivada o sin permiso: queda pendiente, igual que una edición rechazada.
    if (esRechazoDePlantacion(subida)) {
      syncLog.error('Upload technician assignments rejected:', p.id, subida.rechazo);
      return null;
    }
    if (subida.noAsignados.length === 0) return null;
    return { success: true, plantacionId: p.id, nombre: p.lugar, tecnicosNoAsignados: subida.noAsignados };
  } catch (e: any) {
    relanzarSiEsCancelacion(e);
    syncLog.error('Upload technician assignments failed:', p.id, e?.message ?? e);
    return null;
  }
}

/**
 * Pre-step del sync, después de plantaciones y especies y antes de parcelas y grupos.
 * Solo devuelve las plantaciones con técnicos que el server no asignó, para el aviso
 * del resumen; lo que falla se reintenta en el próximo sync.
 */
export async function uploadPendingTechnicianAssignments(): Promise<SyncPlantationResult[]> {
  const resultados: SyncPlantationResult[] = [];
  for (const p of await getPlantacionesConAltasDeTecnicos()) {
    const resultado = await subirDeUnaPlantacion(p);
    if (resultado) resultados.push(resultado);
  }
  return resultados;
}
