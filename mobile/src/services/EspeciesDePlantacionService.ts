/**
 * Guardar las especies de una plantación (#635): se aplica en el teléfono siempre,
 * y con conexión sube en el momento. Sin red, sin sesión del servidor o si el server
 * no responde, queda pendiente para el próximo sync.
 */
import NetInfo from '@react-native-community/netinfo';
import { notifyDataChanged } from '../database/liveQuery';
import { syncLog } from '../utils/syncLogger';
import { errorDeRechazo } from './ReemplazoConfiguracionService';
import { esRechazoDePlantacion, subirCambiosDeEspecies, type SubidaDeEspecies } from './sync/cambiosDeEspecies';
import { ensureServerSession } from './sync/sessionGuard';
import {
  deshacerGuardado,
  getCambiosPendientes,
  getEspeciesPorId,
  guardarCambiosDeEspecies,
  type CambiosDeEspecies,
  type EspecieConNombre,
} from '../repositories/CambiosDeEspeciesRepository';
import { sinCambios } from '../utils/altasYBajas';

async function subirSiHayConexion(plantacionId: string): Promise<SubidaDeEspecies | null> {
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return null;
  try {
    await ensureServerSession();
    return await subirCambiosDeEspecies(plantacionId);
  } catch (e: any) {
    syncLog.error('Upload species changes failed, queda pendiente:', plantacionId, e?.message ?? e);
    return null;
  }
}

/**
 * Devuelve las especies que se quisieron quitar y el server mantuvo porque ya tienen
 * árboles: quedan habilitadas de nuevo. Si la plantación no admite el cambio, deshace
 * este guardado (lo pendiente de antes sigue pendiente) y lanza el motivo.
 */
export async function guardarEspeciesDePlantacion(
  plantacionId: string,
  cambios: CambiosDeEspecies,
): Promise<EspecieConNombre[]> {
  if (sinCambios(cambios)) return [];
  const previos = await getCambiosPendientes(plantacionId);
  const pendingSync = await guardarCambiosDeEspecies(plantacionId, cambios);
  notifyDataChanged();
  if (pendingSync) return [];
  const subida = await subirSiHayConexion(plantacionId);
  if (!subida) return [];
  if (esRechazoDePlantacion(subida)) {
    await deshacerGuardado(plantacionId, cambios, previos);
    notifyDataChanged();
    throw errorDeRechazo(subida.rechazo);
  }
  if (subida.conArboles.length > 0) notifyDataChanged();
  return getEspeciesPorId(subida.conArboles);
}
