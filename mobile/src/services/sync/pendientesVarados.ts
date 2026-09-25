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
  /** Una corrida del sync reintenta todo; un paso suelto (pull-to-refresh) no. */
  completo: boolean;
};

const nuevoRegistro = (completo: boolean): Registro =>
  ({ motivos: new Map(), subidas: new Set(), conAcceso: new Set(), completo });

let enCurso: Registro | null = null;

function masPrioritario(a: MotivoVarado | undefined, b: MotivoVarado): MotivoVarado {
  if (!a) return b;
  return PRIORIDAD_DE_MOTIVOS.indexOf(a) <= PRIORIDAD_DE_MOTIVOS.indexOf(b) ? a : b;
}

const estaVacio = (r: Registro) => r.motivos.size + r.subidas.size + r.conAcceso.size === 0;

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
    await alinearConElEstado(id, r.completo);
  }
}

/**
 * Con acceso confirmado, el estado que trajo el pull decide: cerrada, lo pendiente no sube
 * (aunque ningún paso lo haya intentado, como una foto); abierta, el motivo ya no vale.
 * Suelto no se reintentó lo demás: solo se limpia lo que depende del estado.
 */
async function alinearConElEstado(plantacionId: string, completo: boolean): Promise<void> {
  const delEstado = motivoVarado(motivoDeBloqueo(await getPlantationEstadoDeEdicion(plantacionId)));
  if (delEstado) await guardarMotivoVarado(plantacionId, delEstado);
  else await limpiarMotivoVarado(plantacionId, completo ? undefined : MOTIVOS_DEL_ESTADO);
}

async function anotar(fn: (r: Registro) => void): Promise<void> {
  if (enCurso) {
    fn(enCurso);
    return;
  }
  const suelto = nuevoRegistro(false);
  fn(suelto);
  await aplicar(suelto);
}

/** Un rechazo del server a lo que subía la plantación. Uno transitorio no anota nada. */
export async function anotarRechazo(plantacionId: string, codigo: string | null | undefined): Promise<void> {
  const motivo = motivoVarado(codigo);
  if (!motivo) return;
  await anotar((r) => r.motivos.set(plantacionId, masPrioritario(r.motivos.get(plantacionId), motivo)));
}

/**
 * El server aceptó algo que solo acepta si la plantación es escribible y el usuario
 * tiene permiso. Los técnicos no cuentan: se asignan también en una finalizada.
 */
export async function anotarSubida(plantacionId: string): Promise<void> {
  await anotar((r) => r.subidas.add(plantacionId));
}

/** El server confirmó que existe y el usuario tiene acceso: al final manda el estado que trajo el pull. */
export async function anotarPullConAcceso(plantacionId: string): Promise<void> {
  await anotar((r) => r.conAcceso.add(plantacionId));
}

/**
 * Corre `tarea` con un registro que se aplica al final. `completo`: la tarea reintenta todo
 * lo pendiente (la corrida del sync); un pull suelto no. Anidada, se suma a la que está en curso.
 */
export async function conRegistroDeVarados<T>(tarea: () => Promise<T>, completo = true): Promise<T> {
  if (enCurso) return tarea();
  const registro = nuevoRegistro(completo);
  enCurso = registro;
  try {
    return await tarea();
  } catch (e) {
    // Cortada: lo que faltaba no se reintentó.
    registro.completo = false;
    throw e;
  } finally {
    enCurso = null;
    // Lo anotado es cierto aunque la corrida se haya cortado: se aplica igual.
    try {
      await aplicar(registro);
    } catch (e) {
      syncLog.error('No se pudo guardar el motivo de pendientes varados:', e);
    }
  }
}
