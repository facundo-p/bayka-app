/**
 * Pendientes varados (#638): qué rechazo del server deja lo pendiente sin poder subir
 * hasta que algo cambie allá, y el registro de lo que pasó en una corrida del sync.
 *
 * Cada paso del push anota por plantación sus rechazos y lo que el server aceptó. Al
 * terminar la corrida, un rechazo permanente guarda el motivo; sin ninguno, una subida
 * aceptada o un pull que la muestra escribible lo limpia. Cada corrida reintenta todo
 * lo pendiente, así que lo que sigue varado vuelve a anotar su motivo.
 */
import { MOTIVO_VARADO, MOTIVOS_DEL_ESTADO, PRIORIDAD_DE_MOTIVOS, type MotivoVarado } from '../../constants/motivoVarado';
import { SYNC_ERROR, type SyncErrorCode } from './types';
import { esArchivada } from '../../constants/estados';
import { plantacionEsEditable, type EstadoDeEdicionDePlantacion } from '../../utils/permisosDeEdicion';
import { getPlantationEstadoDeEdicion } from '../../queries/estadoDeEdicionQueries';
import { getMotivosSinPendientes } from '../../queries/pendientesVaradosQueries';
import { RECHAZO_CONFIGURACION } from '../ReemplazoConfiguracionService';
import { guardarMotivoVarado, limpiarMotivoVarado } from '../../repositories/PendientesVaradosRepository';
import { syncLog } from '../../utils/syncLogger';
import { notifyDataChanged } from '../../database/liveQuery';

/**
 * `PLANTACION_INEXISTENTE` no está: la eliminada la marca el pull con el estado remoto,
 * y en un alta es la carrera de un intento anterior, que se reintenta.
 */
const MOTIVO_POR_CODIGO: Record<string, MotivoVarado> = {
  [SYNC_ERROR.PLANTACION_FINALIZADA]: MOTIVO_VARADO.finalizada,
  [SYNC_ERROR.PLANTACION_ARCHIVADA]: MOTIVO_VARADO.archivada,
  [SYNC_ERROR.PERMISSION]: MOTIVO_VARADO.sinPermiso,
  [SYNC_ERROR.SIN_PERMISO_CREAR]: MOTIVO_VARADO.sinPermiso,
  // Mismo código en `editar_plantacion` y en los RPC de especies y técnicos.
  [RECHAZO_CONFIGURACION.sinPermiso]: MOTIVO_VARADO.sinPermiso,
};

/** Por qué la plantación no admite escrituras, con la misma prioridad que `motivo_no_escribible` del server. */
export function motivoDeBloqueo(plantacion: EstadoDeEdicionDePlantacion | null): SyncErrorCode | null {
  if (plantacion == null) return null;
  if (esArchivada(plantacion)) return SYNC_ERROR.PLANTACION_ARCHIVADA;
  if (!plantacionEsEditable(plantacion)) return SYNC_ERROR.PLANTACION_FINALIZADA;
  return null;
}

/** Motivo de un rechazo que no se arregla reintentando; null si es transitorio (red, timeout, conflicto). */
export function motivoVarado(codigo: string | null | undefined): MotivoVarado | null {
  return (codigo && MOTIVO_POR_CODIGO[codigo]) || null;
}

type Registro = {
  motivos: Map<string, MotivoVarado>;
  subidas: Set<string>;
  conAcceso: Set<string>;
  /** Participó la sync global, que reintenta lo pendiente de todas las plantaciones. */
  todas: boolean;
  /** Plantaciones que alguna tarea reintentó enteras (la sync de una); un pull suelto no reintenta ninguna. */
  reintentadas: Set<string>;
  /** Alguna tarea se cortó: lo que faltaba no se reintentó. */
  cortado: boolean;
  /** Tareas corriendo con este registro: se aplica cuando termina la última. */
  participantes: number;
};

const nuevoRegistro = (): Registro =>
  ({
    motivos: new Map(), subidas: new Set(), conAcceso: new Set(),
    todas: false, reintentadas: new Set(), cortado: false, participantes: 0,
  });

/** Qué plantaciones reintenta enteras una tarea: todas (sync global), algunas (sync de una) o ninguna (pull suelto). */
export type Reintentadas = { todas: true } | { ids: readonly string[] };
export const REINTENTA_TODAS: Reintentadas = { todas: true };
export const NO_REINTENTA: Reintentadas = { ids: [] };

/** Solo con todo lo pendiente de la plantación reintentado vale limpiar un motivo que no depende del estado. */
const seReintentoEntera = (r: Registro, plantacionId: string) =>
  !r.cortado && (r.todas || r.reintentadas.has(plantacionId));

/** Compartido entre tareas solapadas (un pull-to-refresh durante una sync). */
let enCurso: Registro | null = null;

function masPrioritario(a: MotivoVarado | undefined, b: MotivoVarado): MotivoVarado {
  if (!a) return b;
  return PRIORIDAD_DE_MOTIVOS.indexOf(a) <= PRIORIDAD_DE_MOTIVOS.indexOf(b) ? a : b;
}

const estaVacio = (r: Registro) =>
  r.motivos.size + r.subidas.size + r.conAcceso.size + r.reintentadas.size === 0 && !r.todas;

/** Después de la corrida, que ya notificó: sin esto la tarjeta no se entera del motivo. */
async function aplicar(r: Registro): Promise<void> {
  if (estaVacio(r)) return;
  await escribir(r);
  notifyDataChanged();
}

async function escribir(r: Registro): Promise<void> {
  for (const [id, motivo] of r.motivos) await guardarMotivoVarado(id, motivo);
  for (const id of r.subidas) if (!r.motivos.has(id)) await limpiarMotivoVarado(id);
  for (const id of r.conAcceso) {
    if (r.motivos.has(id) || r.subidas.has(id)) continue;
    await alinearConElEstado(id, seReintentoEntera(r, id));
  }
  // Un motivo sin nada pendiente (se subió o se borró por otra vía) no debe reaparecer con el próximo cambio.
  if (r.cortado || (!r.todas && r.reintentadas.size === 0)) return;
  for (const id of await getMotivosSinPendientes()) {
    if (seReintentoEntera(r, id)) await limpiarMotivoVarado(id);
  }
}

/**
 * Con acceso confirmado, el estado que trajo el pull decide: cerrada, lo pendiente no sube
 * (aunque ningún paso lo haya intentado, como una foto); abierta, el motivo ya no vale.
 * Suelto no se reintentó lo demás: solo se limpia lo que depende del estado.
 */
async function alinearConElEstado(plantacionId: string, reintentada: boolean): Promise<void> {
  const delEstado = motivoVarado(motivoDeBloqueo(await getPlantationEstadoDeEdicion(plantacionId)));
  if (delEstado) await guardarMotivoVarado(plantacionId, delEstado);
  else await limpiarMotivoVarado(plantacionId, reintentada ? undefined : MOTIVOS_DEL_ESTADO);
}

/**
 * Fuera de un registro no se anota nada: un push suelto (el alta inmediata) no sabe si la
 * sesión era válida, y un 42501 de una sesión anónima no es "sin permiso". La próxima
 * sync lo reintenta y lo registra.
 */
function anotar(fn: (r: Registro) => void): void {
  if (enCurso) fn(enCurso);
}

/** Un rechazo del server a lo que subía la plantación. Uno transitorio no anota nada. */
export async function anotarRechazo(plantacionId: string, codigo: string | null | undefined): Promise<void> {
  const motivo = motivoVarado(codigo);
  if (!motivo) return;
  anotar((r) => r.motivos.set(plantacionId, masPrioritario(r.motivos.get(plantacionId), motivo)));
}

/**
 * El server aceptó algo que solo acepta si la plantación es escribible y el usuario
 * tiene permiso. Los técnicos no cuentan: se asignan también en una finalizada.
 */
export async function anotarSubida(plantacionId: string): Promise<void> {
  anotar((r) => r.subidas.add(plantacionId));
}

/** El server confirmó que existe y el usuario tiene acceso: al final manda el estado que trajo el pull. */
export async function anotarPullConAcceso(plantacionId: string): Promise<void> {
  anotar((r) => r.conAcceso.add(plantacionId));
}

/**
 * Corre `tarea` con un registro que se aplica cuando terminan todas las tareas que lo
 * comparten. `reintenta`: de qué plantaciones la tarea reintenta todo lo pendiente.
 */
export async function conRegistroDeVarados<T>(tarea: () => Promise<T>, reintenta: Reintentadas): Promise<T> {
  const registro = enCurso ?? (enCurso = nuevoRegistro());
  registro.participantes++;
  if ('todas' in reintenta) registro.todas = true;
  else reintenta.ids.forEach((id) => registro.reintentadas.add(id));
  try {
    return await tarea();
  } catch (e) {
    registro.cortado = true;
    throw e;
  } finally {
    if (--registro.participantes === 0) {
      enCurso = null;
      // Lo anotado es cierto aunque la corrida se haya cortado: se aplica igual.
      try {
        await aplicar(registro);
      } catch (e) {
        syncLog.error('No se pudo guardar el motivo de pendientes varados:', e);
      }
    }
  }
}
