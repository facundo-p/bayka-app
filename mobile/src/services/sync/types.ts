import { PG_ERROR } from '../../supabase/postgresErrorCodes';
import { esTimeout } from '../../supabase/fetchConTimeout';

/**
 * Códigos de error de sync (grupo + parcela). En el push de grupos DUPLICATE_CODE,
 * DUPLICATE_NAME y PERMISSION cruzan el contrato del RPC `sync_subgroup` — llegan en `data.error` (#67),
 * no los inventa el cliente; renombrar el valor rompe la clasificación.
 */
export const SYNC_ERROR = {
  /** unique violation (23505) sobre el código, vía error.details (nunca substring de message). */
  DUPLICATE_CODE: 'DUPLICATE_CODE',
  /** unique violation (23505) sobre el nombre. */
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  /** 23505 pero details no matchea los constraints esperados. */
  GENERIC_CONFLICT: 'GENERIC_CONFLICT',
  /** foreign key violation (23503): la fila padre no está en el server (p.ej. la plantación de una parcela). */
  REFERENCIA_INEXISTENTE: 'REFERENCIA_INEXISTENTE',
  /** Grupo no subido porque su parcela sigue pending_sync (orden FK). */
  PARCELA_PENDING: 'PARCELA_PENDING',
  /** RLS rechazó la operación (42501). */
  PERMISSION: 'PERMISSION',
  /** La plantación está finalizada y es inmutable (#469); distinto de PERMISSION, que es no ser miembro. */
  PLANTACION_FINALIZADA: 'PLANTACION_FINALIZADA',
  /** La plantación está archivada (#477); tiene prioridad sobre finalizada en el server. */
  PLANTACION_ARCHIVADA: 'PLANTACION_ARCHIVADA',
  /** Legacy: falla de red sin código de postgres. */
  NETWORK: 'NETWORK',
  /** La request no respondió dentro del timeout (#451). Distinto de NETWORK: hay señal, el que no contesta es el server. */
  TIMEOUT: 'TIMEOUT',
  /** Legacy: todo lo demás, con code/message crudo en `detail`. */
  UNKNOWN: 'UNKNOWN',
} as const;

export type SyncErrorCode = (typeof SYNC_ERROR)[keyof typeof SYNC_ERROR];

export interface PhotoSyncProgress {
  total: number;
  completed: number;
  /**
   * Bytes efectivamente transferidos en esta fase. El cálculo de KB/s vive en la
   * UI, no acá: el servicio solo acumula (#450).
   */
  bytes?: number;
  /** Momento en que arrancó la fase, en ms. Con `bytes` alcanza para el promedio. */
  desde?: number;
}

/** Sentido de la transferencia de fotos; `useSync` lo mapea al estado del modal. */
export const PHOTO_PHASE = {
  uploading: 'uploading',
  downloading: 'downloading',
} as const;

export type PhotoPhase = (typeof PHOTO_PHASE)[keyof typeof PHOTO_PHASE];

export type SyncGroupResult =
  | { success: true; groupId: string; nombre: string }
  | { success: false; groupId: string; nombre: string; error: SyncErrorCode; parcelaId?: string | null; detail?: string };

export type SyncParcelaResult =
  | { success: true; parcelaId: string; nombre: string }
  | { success: false; parcelaId: string; nombre: string; error: SyncErrorCode; detail?: string };

/** Result of pushing an offline-created plantation row to the server. */
export type SyncPlantationResult =
  /**
   * `duplicada`: el server ya tenía otra con el mismo lugar y periodo (#633).
   * `cambiosPorResolver`: campos de la edición que chocaron con la web (#634).
   */
  | { success: true; plantacionId: string; nombre: string; duplicada?: boolean; cambiosPorResolver?: number }
  | { success: false; plantacionId: string; nombre: string; error: SyncErrorCode; detail?: string };

export interface SyncProgress {
  total: number;
  completed: number;
  currentName: string;
}

export interface GlobalSyncProgress {
  plantationName: string;
  plantationDone: number;
  plantationTotal: number;
  subgroupProgress?: SyncProgress;
  /** Fase del pull en curso; el sync global la reenvía igual que la descarga de catálogo. */
  phaseProgress?: DownloadPhaseProgress;
  /** Fotos de la plantación en curso, con su fase para distinguir subida de bajada. */
  photoProgress?: PhotoSyncProgress;
  photoPhase?: PhotoPhase;
}

export const PULL_ESTADO = {
  ok: 'ok',
  /**
   * El server ya no reconoce la membresía del usuario en la plantación (revocada).
   * Sin distinguirlo, las policies por membresía devuelven `{ data: [], error: null }`
   * en cada paso y el pull lo lee como "el server está vacío".
   */
  sinAcceso: 'sin-acceso',
  /** La plantación fue eliminada en el server (#478): la copia local queda solo para consulta. */
  eliminada: 'eliminada',
} as const;

export type PullEstado = (typeof PULL_ESTADO)[keyof typeof PULL_ESTADO];

/** Resultado del pull. Los callers preguntan con `esSinAcceso`, no por el `estado`. */
export type PullResult = { estado: PullEstado };

export const PULL_OK: PullResult = { estado: PULL_ESTADO.ok };
export const PULL_SIN_ACCESO: PullResult = { estado: PULL_ESTADO.sinAcceso };

export const PULL_ELIMINADA: PullResult = { estado: PULL_ESTADO.eliminada };

/** La membresía fue revocada: la copia local queda solo para consulta (#317). */
export const esSinAcceso = (resultado: PullResult): boolean =>
  resultado.estado === PULL_ESTADO.sinAcceso;

/** La plantación ya no existe en el server (#478). */
export const esEliminada = (resultado: PullResult): boolean =>
  resultado.estado === PULL_ESTADO.eliminada;

/** No hay nada que bajar ni subir: ni pull de datos, ni push, ni fotos. */
export const esPullSinDatos = (resultado: PullResult): boolean =>
  esSinAcceso(resultado) || esEliminada(resultado);

/**
 * Valores de `estado` del RPC `estado_remoto_plantaciones` (#478). Contrato con el
 * server: `sin_acceso` va con guion bajo, a diferencia de `PULL_ESTADO.sinAcceso`.
 */
export const ESTADO_REMOTO = {
  ok: 'ok',
  archivada: 'archivada',
  eliminada: 'eliminada',
  sinAcceso: 'sin_acceso',
} as const;

export type EstadoRemoto = (typeof ESTADO_REMOTO)[keyof typeof ESTADO_REMOTO];

export const RPC_ESTADO_REMOTO_PLANTACIONES = 'estado_remoto_plantaciones';

/** Existe en el server y el usuario es miembro: lo único que desmarca una eliminada. */
export const existeConAcceso = (estado: string | null | undefined): boolean =>
  estado === ESTADO_REMOTO.ok || estado === ESTADO_REMOTO.archivada;

/**
 * Estado remoto → resultado del pull. Un valor desconocido (server más nuevo) o
 * ausente asume acceso, igual que un error de red: solo se corta ante evidencia.
 */
export function pullDesdeEstadoRemoto(estado: string | null | undefined): PullResult {
  if (estado === ESTADO_REMOTO.eliminada) return PULL_ELIMINADA;
  if (estado === ESTADO_REMOTO.sinAcceso) return PULL_SIN_ACCESO;
  return PULL_OK;
}

export const DOWNLOAD_PHASE = {
  /** Catálogo global; corre una sola vez al arrancar el batch. */
  species: 'species',
  parcelas: 'parcelas',
  groups: 'groups',
  usuarios: 'usuarios',
  especiesPlantacion: 'especies_plantacion',
  arboles: 'arboles',
  /** Opcional, solo si includePhotos=true. */
  fotos: 'fotos',
  /** Cleanup y notify posteriores al loop. */
  finalizando: 'finalizando',
} as const;

export type DownloadPhase = (typeof DOWNLOAD_PHASE)[keyof typeof DOWNLOAD_PHASE];

/** Máquina de estados de una corrida de sync: la fija `useSync`, la leen los modales. */
export const SYNC_STATE = {
  idle: 'idle',
  pulling: 'pulling',
  pushing: 'pushing',
  uploadingPhotos: 'uploading-photos',
  downloadingPhotos: 'downloading-photos',
  done: 'done',
} as const;

export type SyncState = (typeof SYNC_STATE)[keyof typeof SYNC_STATE];

/** Máquina de estados de una descarga de plantaciones (`useCatalog` + su modal). */
export const DOWNLOAD_STATE = {
  idle: 'idle',
  downloading: 'downloading',
  done: 'done',
} as const;

export type DownloadState = (typeof DOWNLOAD_STATE)[keyof typeof DOWNLOAD_STATE];

export interface DownloadPhaseProgress {
  phase: DownloadPhase;
  phaseDone: number;
  phaseTotal: number;
  /**
   * `true` mientras se bajan las páginas de esa tabla: ahí todavía no se conoce el
   * total, así que `phaseDone` son filas descargadas y `phaseTotal` es 0. Sin esto
   * la parte de red —la lenta con mala señal— no muestra nada.
   */
  descargando?: boolean;
}

export interface DownloadProgress {
  /** 1-based index of the plantation currently being downloaded. */
  plantationIndex: number;
  /** Total plantations in this batch. */
  plantationTotal: number;
  /** Name of the plantation currently being downloaded (`currentName` legacy alias). */
  currentName: string;
  /** Per-phase progress within the current plantation. Null while between phases. */
  phase: DownloadPhaseProgress | null;
  // Legacy: mantenidos para callers que los leen como contador a nivel de plantación (modal title, etc).
  total: number;
  completed: number;
}

export type DownloadResult = {
  success: boolean;
  id: string;
  nombre: string;
};

const ERROR_MESSAGES: Record<SyncErrorCode, string> = {
  // DUPLICATE_CODE/NAME los devuelve el RPC tanto para parcelas como grupos; mensaje neutral para
  // no nombrar la entidad equivocada (unicidad de grupo es por parcela, no por plantación, #65).
  [SYNC_ERROR.DUPLICATE_CODE]: 'El código ya existe en el servidor. Renombrá el código e intentá de nuevo.',
  [SYNC_ERROR.DUPLICATE_NAME]: 'El nombre ya existe en el servidor. Renombrá e intentá de nuevo.',
  [SYNC_ERROR.GENERIC_CONFLICT]: 'El servidor rechazó la operación por un conflicto. Intentá de nuevo o contactá a soporte.',
  [SYNC_ERROR.REFERENCIA_INEXISTENTE]: 'Falta en el servidor un dato del que depende (por ejemplo, su plantación o parcela). Sincronizá de nuevo; si persiste, puede que se haya eliminado: contactá a un administrador.',
  [SYNC_ERROR.PARCELA_PENDING]: 'No se pudo sincronizar el grupo porque su parcela aún está pendiente. Resolvé el problema de la parcela primero.',
  [SYNC_ERROR.PERMISSION]: 'El servidor rechazó la operación por permisos. No estás habilitado para sincronizar esta plantación; contactá a un administrador.',
  // El dato NO se pierde: queda en el device y se sube si la plantación se reabre o desarchiva.
  [SYNC_ERROR.PLANTACION_FINALIZADA]: 'La plantación fue finalizada y ya no acepta cambios. Lo que cargaste sigue guardado en el dispositivo; pedile a un administrador que la reabra para poder subirlo.',
  [SYNC_ERROR.PLANTACION_ARCHIVADA]: 'La plantación fue archivada y no acepta cambios. Lo que cargaste sigue guardado en el dispositivo; pedile a un administrador que la desarchive para poder subirlo.',
  [SYNC_ERROR.NETWORK]: 'Error de conexión. Verificá tu internet e intentá de nuevo.',
  [SYNC_ERROR.TIMEOUT]: 'El servidor no respondió a tiempo. Puede ser la señal: intentá de nuevo con mejor cobertura.',
  [SYNC_ERROR.UNKNOWN]: 'Error inesperado. Intentá de nuevo.',
};

export function getErrorMessage(code: SyncErrorCode): string {
  return ERROR_MESSAGES[code];
}

/** Raw "code: message" del error, para mostrar la causa real en errores opacos. */
export function rawErrorDetail(error: { code?: string; message?: string } | null | undefined): string {
  return `${error?.code ?? 'sin-codigo'}: ${error?.message ?? ''}`.trim();
}

/**
 * Clasifica errores de push que NO son conflicto de unicidad (23505); compartido por parcela y
 * plantación: timeout → TIMEOUT; 42501 (RLS) → PERMISSION; 23503 (FK) → REFERENCIA_INEXISTENTE;
 * fetch/network sin código postgres → NETWORK; resto → UNKNOWN (con code/message crudo en `detail`).
 */
export function classifyServerError(error: { code?: string; message?: string }): { error: SyncErrorCode; detail: string } {
  const detail = rawErrorDetail(error);
  // Antes que nada: un timeout llega sin código de postgres y caería en NETWORK,
  // indistinguible de "no hay señal", que es un problema distinto para el técnico.
  if (esTimeout(error)) return { error: SYNC_ERROR.TIMEOUT, detail };
  if (error?.code === PG_ERROR.INSUFFICIENT_PRIVILEGE) return { error: SYNC_ERROR.PERMISSION, detail };
  if (error?.code === PG_ERROR.FOREIGN_KEY_VIOLATION) return { error: SYNC_ERROR.REFERENCIA_INEXISTENTE, detail };
  const msg = String(error?.message ?? '').toLowerCase();
  if (!error?.code && (msg.includes('fetch') || msg.includes('network'))) {
    return { error: SYNC_ERROR.NETWORK, detail };
  }
  return { error: SYNC_ERROR.UNKNOWN, detail };
}
