/**
 * Guardar las especies de una plantación (#635): se aplica en el teléfono siempre,
 * y con conexión sube en el momento. Sin red, o si el server no responde, queda
 * pendiente para el próximo sync.
 */
import NetInfo from '@react-native-community/netinfo';
import { notifyDataChanged } from '../database/liveQuery';
import { syncLog } from '../utils/syncLogger';
import { errorDeRechazo } from './ReemplazoConfiguracionService';
import { esRechazoDePlantacion, subirCambiosDeEspecies, type SubidaDeEspecies } from './sync/cambiosDeEspecies';
import {
  getNombresDeEspecies,
  guardarCambiosDeEspecies,
  registrarRespuesta,
  type CambiosDeEspecies,
} from '../repositories/CambiosDeEspeciesRepository';
import { sinCambios } from '../utils/altasYBajas';

async function subirSiHayConexion(plantacionId: string): Promise<SubidaDeEspecies | null> {
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return null;
  try {
    return await subirCambiosDeEspecies(plantacionId);
  } catch (e: any) {
    syncLog.error('Upload species changes failed, queda pendiente:', plantacionId, e?.message ?? e);
    return null;
  }
}

/**
 * Devuelve los nombres de las especies que se quisieron quitar y el server mantuvo
 * porque ya tienen árboles: quedan habilitadas de nuevo. Si la plantación no admite
 * el cambio, lo deshace y lanza el motivo.
 */
export async function guardarEspeciesDePlantacion(
  plantacionId: string,
  cambios: CambiosDeEspecies,
  pendingSync: boolean,
): Promise<string[]> {
  if (sinCambios(cambios)) return [];
  await guardarCambiosDeEspecies(plantacionId, cambios, !pendingSync);
  notifyDataChanged();
  if (pendingSync) return [];
  const subida = await subirSiHayConexion(plantacionId);
  if (!subida) return [];
  if (esRechazoDePlantacion(subida)) {
    await registrarRespuesta(plantacionId, subida.enviados, subida.enviados);
    notifyDataChanged();
    throw errorDeRechazo(subida.rechazo);
  }
  if (subida.conArboles.length > 0) notifyDataChanged();
  return getNombresDeEspecies(subida.conArboles);
}
