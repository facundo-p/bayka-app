import { PG_ERROR } from '../../supabase/postgresErrorCodes';

/**
 * Códigos de error de sync (grupo + parcela). En el push de grupos DUPLICATE_CODE y
 * PERMISSION cruzan el contrato del RPC `sync_subgroup` — llegan en `data.error` (#67),
 * no los inventa el cliente; renombrar el valor rompe la clasificación.
 */
export const SYNC_ERROR = {
  /** unique violation (23505) sobre el código, vía error.details (nunca substring de message). */
  DUPLICATE_CODE: 'DUPLICATE_CODE',
  /** unique violation (23505) sobre el nombre. */
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  /** 23505 pero details no matchea los constraints esperados. */
  GENERIC_CONFLICT: 'GENERIC_CONFLICT',
  /** Grupo no subido porque su parcela sigue pending_sync (orden FK). */
  PARCELA_PENDING: 'PARCELA_PENDING',
  /** RLS rechazó la operación (42501). */
  PERMISSION: 'PERMISSION',
  /** Legacy: falla de red sin código de postgres. */
  NETWORK: 'NETWORK',
  /** Legacy: todo lo demás, con code/message crudo en `detail`. */
  UNKNOWN: 'UNKNOWN',
} as const;

export type SyncErrorCode = (typeof SYNC_ERROR)[keyof typeof SYNC_ERROR];

export interface PhotoSyncProgress {
  total: number;
  completed: number;
}

export type SyncGroupResult =
  | { success: true; groupId: string; nombre: string }
  | { success: false; groupId: string; nombre: string; error: SyncErrorCode; parcelaId?: string | null; detail?: string };

export type SyncParcelaResult =
  | { success: true; parcelaId: string; nombre: string }
  | { success: false; parcelaId: string; nombre: string; error: SyncErrorCode; detail?: string };

/** Result of pushing an offline-created plantation row to the server. */
export type SyncPlantationResult =
  | { success: true; plantacionId: string; nombre: string }
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
}

export const PULL_ESTADO = {
  ok: 'ok',
  /**
   * El server ya no reconoce la membresía del usuario en la plantación (revocada).
   * Sin distinguirlo, las policies por membresía devuelven `{ data: [], error: null }`
   * en cada paso y el pull lo lee como "el server está vacío".
   */
  sinAcceso: 'sin-acceso',
} as const;

export type PullEstado = (typeof PULL_ESTADO)[keyof typeof PULL_ESTADO];

/** Resultado del pull. Los callers preguntan con `esSinAcceso`, no por el `estado`. */
export type PullResult = { estado: PullEstado };

export const PULL_OK: PullResult = { estado: PULL_ESTADO.ok };
export const PULL_SIN_ACCESO: PullResult = { estado: PULL_ESTADO.sinAcceso };

/** La membresía fue revocada: la copia local queda solo para consulta (#317). */
export const esSinAcceso = (resultado: PullResult): boolean =>
  resultado.estado === PULL_ESTADO.sinAcceso;

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
  [SYNC_ERROR.DUPLICATE_CODE]: 'El codigo ya existe en el servidor. Renombra el codigo e intenta de nuevo.',
  [SYNC_ERROR.DUPLICATE_NAME]: 'El nombre ya existe en el servidor. Renombra e intenta de nuevo.',
  [SYNC_ERROR.GENERIC_CONFLICT]: 'El servidor rechazo la operacion por un conflicto. Intenta de nuevo o contacta soporte.',
  [SYNC_ERROR.PARCELA_PENDING]: 'No se pudo sincronizar el grupo porque su parcela aun esta pendiente. Resolve el problema de la parcela primero.',
  [SYNC_ERROR.PERMISSION]: 'El servidor rechazo la operacion por permisos. No estas habilitado para sincronizar esta plantacion; contacta a un administrador.',
  [SYNC_ERROR.NETWORK]: 'Error de conexion. Verifica tu internet e intenta de nuevo.',
  [SYNC_ERROR.UNKNOWN]: 'Error inesperado. Intenta de nuevo.',
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
 * plantación: 42501 (RLS) → PERMISSION; fetch/network sin código postgres → NETWORK; resto →
 * UNKNOWN (con code/message crudo en `detail`).
 */
export function classifyServerError(error: { code?: string; message?: string }): { error: SyncErrorCode; detail: string } {
  const detail = rawErrorDetail(error);
  if (error?.code === PG_ERROR.INSUFFICIENT_PRIVILEGE) return { error: SYNC_ERROR.PERMISSION, detail };
  const msg = String(error?.message ?? '').toLowerCase();
  if (!error?.code && (msg.includes('fetch') || msg.includes('network'))) {
    return { error: SYNC_ERROR.NETWORK, detail };
  }
  return { error: SYNC_ERROR.UNKNOWN, detail };
}
