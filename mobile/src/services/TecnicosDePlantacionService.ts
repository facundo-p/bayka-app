/**
 * Guardar los técnicos de una plantación (#636). Asignar se aplica en el teléfono
 * siempre y con conexión sube en el momento; sin red, o si el server no responde,
 * queda pendiente para el próximo sync. Quitar a alguien que ya está en el server
 * requiere conexión; quitar un alta que todavía no subió solo la descarta.
 */
import { notifyDataChanged } from '../database/liveQuery';
import { syncLog } from '../utils/syncLogger';
import { errorDeRechazo } from './ReemplazoConfiguracionService';
import { hayConexion } from './conexion';
import { esRechazoDePlantacion, subirCambiosDeTecnicos, type SubidaDeTecnicos } from './sync/tecnicosDePlantacion';
import { pullTecnicosDeOrganizacion } from './sync/catalogoDeTecnicos';
import {
  admiteSubirTecnicos,
  getAltasPendientes,
  guardarAltasDeTecnicos,
  quitarTecnicosLocal,
} from '../repositories/TecnicosDePlantacionRepository';
import { sinCambios, type AltasYBajas } from '../utils/altasYBajas';
import { AYUDA_QUITAR_SIN_CONEXION } from '../utils/tecnicosDePlantacion';

/**
 * Cuánto espera la pantalla la subida de las altas antes de cerrarse. Con señal débil
 * el RPC puede tardar el timeout entero: la subida sigue en segundo plano, y lo que
 * responda se aplica igual, aunque el aviso de un rechazado ya no se muestre.
 */
export const ESPERA_DE_SUBIDA_MS = 4000;

export class QuitarSinConexionError extends Error {
  constructor() {
    super(`${AYUDA_QUITAR_SIN_CONEXION}. Los cambios no se guardaron.`);
    this.name = 'QuitarSinConexionError';
  }
}

/** Con señal trae los técnicos del server; si no, o si falla, queda el caché del último sync. */
export async function refrescarTecnicosDeOrganizacion(): Promise<void> {
  if (!(await hayConexion())) return;
  try {
    await pullTecnicosDeOrganizacion();
  } catch (e: any) {
    syncLog.error('Pull technicians failed, se usa el caché:', e?.message ?? e);
  }
}

/**
 * El rechazo de la plantación deshace en el teléfono las altas de este guardado y lanza
 * el motivo; las que ya estaban pendientes siguen pendientes, como en el sync.
 */
async function resolverSubida(plantacionId: string, subida: SubidaDeTecnicos | null, altas: string[]): Promise<string[]> {
  if (!subida) return [];
  if (esRechazoDePlantacion(subida)) {
    await quitarTecnicosLocal(plantacionId, altas);
    notifyDataChanged();
    throw errorDeRechazo(subida.rechazo);
  }
  if (subida.noAsignados.length > 0) notifyDataChanged();
  return subida.noAsignados;
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

/** Lo que responda antes del tope; después, sigue en segundo plano y devuelve vacío. */
async function esperarHasta(enCurso: Promise<string[]>, ms: number): Promise<string[]> {
  let tope: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<null>((resolve) => { tope = setTimeout(() => resolve(null), ms); });
  const primero = await Promise.race([enCurso, vencido]).finally(() => clearTimeout(tope));
  if (primero !== null) return primero;
  enCurso.catch((e) => syncLog.error('Upload technician assignments rejected en segundo plano:', e?.message ?? e));
  return [];
}

/**
 * Aplica en el teléfono y sube. Devuelve los nombres de los técnicos que el server no
 * asignó (ya se quitaron del teléfono). Si la plantación no admite el cambio, deshace
 * este guardado y lanza el motivo.
 */
export async function guardarTecnicosDePlantacion(plantacionId: string, cambios: AltasYBajas): Promise<string[]> {
  if (sinCambios(cambios)) return [];
  const pendientes = new Set(await getAltasPendientes(plantacionId));
  const bajasDelServidor = cambios.bajas.filter((id) => !pendientes.has(id));
  if (bajasDelServidor.length > 0 && !(await hayConexion())) throw new QuitarSinConexionError();
  await guardarAltasDeTecnicos(plantacionId, cambios.altas);
  // Si la subida de esa alta llegó al server pero se perdió la respuesta, el próximo
  // pull la vuelve a traer: sacarla del server es quitar, y eso requiere conexión.
  await quitarTecnicosLocal(plantacionId, cambios.bajas.filter((id) => pendientes.has(id)));
  notifyDataChanged();
  if (bajasDelServidor.length > 0) {
    return resolverSubida(plantacionId, await subirConBajas(plantacionId, bajasDelServidor), cambios.altas);
  }
  const enCurso = subirAltasSiSePuede(plantacionId).then((s) => resolverSubida(plantacionId, s, cambios.altas));
  return esperarHasta(enCurso, ESPERA_DE_SUBIDA_MS);
}
