/**
 * Sube las altas y bajas de especies por `aplicar_cambios_especies` (#635). Es
 * idempotente: reintentar lo mismo no cambia nada, así que un corte a mitad de
 * camino solo se reintenta.
 */
import { supabase } from '../../supabase/client';
import { syncLog } from '../../utils/syncLogger';
import { relanzarSiEsCancelacion } from './cancelacion';
import type { SyncPlantationResult } from './types';
import { CAMBIO_DE_ESPECIE } from '../../constants/cambioDeEspecie';
import { RECHAZO_CONFIGURACION } from '../ReemplazoConfiguracionService';
import {
  comoAltasYBajas,
  getCambiosPendientes,
  getEspeciesPorId,
  getPlantacionesConCambiosDeEspecies,
  registrarRespuesta,
  type CambioPendiente,
  type CambiosDeEspecies,
} from '../../repositories/CambiosDeEspeciesRepository';

export const RPC_APLICAR_CAMBIOS_ESPECIES = 'aplicar_cambios_especies';

type Rechazada = { species_id: string; error: string };
export type RespuestaDeCambios = { success: boolean; error?: string; rechazadas?: Rechazada[] } | null;

/** La plantación no admitió el cambio (nada se aplicó), o los ids de las bajas que el server rechazó por tener árboles. */
export type SubidaDeEspecies = { rechazo: string; enviados: CambioPendiente[] } | { conArboles: string[] };

export const esRechazoDePlantacion = (s: SubidaDeEspecies): s is { rechazo: string; enviados: CambioPendiente[] } =>
  'rechazo' in s;

/** Lanza ante un error de red o del server. */
export async function aplicarCambiosEnServidor(plantacionId: string, { altas, bajas }: CambiosDeEspecies): Promise<RespuestaDeCambios> {
  const { data, error } = await supabase.rpc(RPC_APLICAR_CAMBIOS_ESPECIES, {
    p_plantacion: plantacionId,
    p_altas: altas,
    p_bajas: bajas,
  });
  if (error) throw error;
  return data as RespuestaDeCambios;
}

/** Una baja rechazada vuelve como baja; un alta de una especie que el server no tiene, como alta. */
export function cambiosRechazados(rechazadas: Rechazada[]): CambioPendiente[] {
  return rechazadas.map((r) => ({
    especieId: r.species_id,
    tipo: r.error === RECHAZO_CONFIGURACION.especieConArboles ? CAMBIO_DE_ESPECIE.baja : CAMBIO_DE_ESPECIE.alta,
  }));
}

/** Sube lo pendiente de la plantación. Null si no había nada. */
export async function subirCambiosDeEspecies(plantacionId: string): Promise<SubidaDeEspecies | null> {
  const enviados = await getCambiosPendientes(plantacionId);
  if (enviados.length === 0) return null;
  const respuesta = await aplicarCambiosEnServidor(plantacionId, comoAltasYBajas(enviados));
  if (!respuesta?.success) return { rechazo: respuesta?.error ?? '', enviados };
  const rechazados = cambiosRechazados(respuesta.rechazadas ?? []);
  await registrarRespuesta(plantacionId, enviados, rechazados);
  const conArboles = rechazados.filter((c) => c.tipo === CAMBIO_DE_ESPECIE.baja).map((c) => c.especieId);
  return { conArboles };
}

async function subirDeUnaPlantacion(p: { id: string; lugar: string }): Promise<SyncPlantationResult | null> {
  try {
    const subida = await subirCambiosDeEspecies(p.id);
    if (!subida) return null;
    // Finalizada, archivada o sin permiso: queda pendiente, igual que una edición rechazada.
    if (esRechazoDePlantacion(subida)) {
      syncLog.error('Upload species changes rejected:', p.id, subida.rechazo);
      return null;
    }
    if (subida.conArboles.length === 0) return null;
    return { success: true, plantacionId: p.id, nombre: p.lugar, especiesConArboles: (await getEspeciesPorId(subida.conArboles)).map((e) => e.nombre) };
  } catch (e: any) {
    relanzarSiEsCancelacion(e);
    syncLog.error('Upload species changes failed:', p.id, e?.message ?? e);
    return null;
  }
}

/**
 * Pre-step del sync. Solo devuelve las plantaciones con una baja rechazada por
 * árboles, para el aviso del resumen; lo que falla se reintenta en el próximo sync.
 */
export async function uploadPendingSpeciesChanges(): Promise<SyncPlantationResult[]> {
  const resultados: SyncPlantationResult[] = [];
  for (const p of await getPlantacionesConCambiosDeEspecies()) {
    const resultado = await subirDeUnaPlantacion(p);
    if (resultado) resultados.push(resultado);
  }
  return resultados;
}
