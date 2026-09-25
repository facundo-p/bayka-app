/**
 * Guardar los técnicos de una plantación (#636). Asignar se aplica en el teléfono
 * siempre y con conexión sube en el momento; sin red, o si el server no responde,
 * queda pendiente para el próximo sync. Quitar a alguien que ya está en el server
 * requiere conexión; quitar un alta que todavía no subió solo la descarta.
 */
import NetInfo from '@react-native-community/netinfo';
import { notifyDataChanged } from '../database/liveQuery';
import { syncLog } from '../utils/syncLogger';
import { errorDeRechazo } from './ReemplazoConfiguracionService';
import { esRechazoDePlantacion, subirCambiosDeTecnicos, type SubidaDeTecnicos } from './sync/tecnicosDePlantacion';
import { pullTecnicosDeOrganizacion } from './sync/catalogoDeTecnicos';
import {
  admiteSubirTecnicos,
  getAltasPendientes,
  getNombresDeTecnicos,
  guardarAltasDeTecnicos,
  quitarTecnicosLocal,
} from '../repositories/TecnicosDePlantacionRepository';
import { sinCambios, type AltasYBajas } from '../utils/altasYBajas';
import { AYUDA_QUITAR_SIN_CONEXION } from '../utils/tecnicosDePlantacion';

export class QuitarSinConexionError extends Error {
  constructor() {
    super(`${AYUDA_QUITAR_SIN_CONEXION}. Los cambios no se guardaron.`);
    this.name = 'QuitarSinConexionError';
  }
}

const hayConexion = async () => (await NetInfo.fetch()).isConnected !== false;

/** Con señal trae los técnicos del server; si no, o si falla, queda el caché del último sync. */
export async function refrescarTecnicosDeOrganizacion(): Promise<void> {
  if (!(await hayConexion())) return;
  try {
    await pullTecnicosDeOrganizacion();
  } catch (e: any) {
    syncLog.error('Pull technicians failed, se usa el caché:', e?.message ?? e);
  }
}

/** El rechazo de la plantación deshace en el teléfono las altas que no subieron y lanza el motivo. */
async function resolverSubida(plantacionId: string, subida: SubidaDeTecnicos | null): Promise<string[]> {
  if (!subida) return [];
  if (esRechazoDePlantacion(subida)) {
    await quitarTecnicosLocal(plantacionId, subida.enviadas);
    notifyDataChanged();
    throw errorDeRechazo(subida.rechazo);
  }
  if (subida.noAsignados.length > 0) notifyDataChanged();
  return getNombresDeTecnicos(subida.noAsignados);
}

async function subirAltasSiSePuede(plantacionId: string): Promise<SubidaDeTecnicos | null> {
  if (!(await admiteSubirTecnicos(plantacionId)) || !(await hayConexion())) return null;
  try {
    return await subirCambiosDeTecnicos(plantacionId);
  } catch (e: any) {
    syncLog.error('Upload technician assignments failed, queda pendiente:', plantacionId, e?.message ?? e);
    return null;
  }
}

/** Las bajas del server van con las altas pendientes en un solo RPC; sin respuesta, lanza. */
async function subirConBajas(plantacionId: string, bajas: string[]): Promise<SubidaDeTecnicos | null> {
  const subida = await subirCambiosDeTecnicos(plantacionId, bajas);
  if (subida && !esRechazoDePlantacion(subida)) await quitarTecnicosLocal(plantacionId, bajas);
  return subida;
}

/**
 * Devuelve los nombres de los técnicos que el server no asignó (dados de baja o de otra
 * organización): ya se quitaron del teléfono. Si la plantación no admite el cambio, lo
 * deshace y lanza el motivo.
 */
export async function guardarTecnicosDePlantacion(plantacionId: string, cambios: AltasYBajas): Promise<string[]> {
  if (sinCambios(cambios)) return [];
  const pendientes = new Set(await getAltasPendientes(plantacionId));
  const bajasDelServidor = cambios.bajas.filter((id) => !pendientes.has(id));
  if (bajasDelServidor.length > 0 && !(await hayConexion())) throw new QuitarSinConexionError();
  await guardarAltasDeTecnicos(plantacionId, cambios.altas);
  await quitarTecnicosLocal(plantacionId, cambios.bajas.filter((id) => pendientes.has(id)));
  notifyDataChanged();
  const subida = bajasDelServidor.length > 0
    ? await subirConBajas(plantacionId, bajasDelServidor)
    : await subirAltasSiSePuede(plantacionId);
  return resolverSubida(plantacionId, subida);
}
