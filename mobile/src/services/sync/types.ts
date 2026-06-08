// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Sync error codes (todas las flows: grupo + parcela).
 *
 * Contrato:
 *  - DUPLICATE_CODE: server rechazó parcela por unique (plantation_id, codigo).
 *    Detectado en pushService.classifyParcelaRpcResult vía error.code === '23505'
 *    + parsing de error.details. NUNCA substring de error.message.
 *  - DUPLICATE_NAME: server rechazó parcela por unique (plantation_id, nombre).
 *    Idem.
 *  - GENERIC_CONFLICT: server rechazó con 23505 pero details no encaja con los
 *    constraints esperados (fallback ante drift de versiones).
 *  - PARCELA_PENDING: grupo no se subió porque su parcela está aún pending_sync
 *    (D-16-16, atomicidad — orden FK).
 *  - PERMISSION: el server rechazó por RLS (postgres 42501). Típicamente el
 *    usuario no está habilitado para escribir en esa plantación.
 *  - NETWORK, UNKNOWN: legacy.
 */
export type SyncErrorCode =
  | 'DUPLICATE_CODE'
  | 'DUPLICATE_NAME'
  | 'GENERIC_CONFLICT'
  | 'PARCELA_PENDING'
  | 'PERMISSION'
  | 'NETWORK'
  | 'UNKNOWN';

export interface PhotoSyncProgress {
  total: number;
  completed: number;
}

export type SyncGroupResult =
  | { success: true; groupId: string; nombre: string }
  | { success: false; groupId: string; nombre: string; error: SyncErrorCode; parcelaId?: string | null };

export type SyncParcelaResult =
  | { success: true; parcelaId: string; nombre: string }
  | { success: false; parcelaId: string; nombre: string; error: SyncErrorCode };

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

export type DownloadPhase =
  | 'species'      // global catalog (runs once at batch start)
  | 'parcelas'
  | 'groups'
  | 'usuarios'
  | 'especies_plantacion'
  | 'arboles'
  | 'fotos'        // optional, only if includePhotos=true
  | 'finalizando'; // post-loop cleanup / notify

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
  // Legacy fields preserved for backwards-compat with callers that read them
  // as a plantation-level counter (modal title etc).
  total: number;
  completed: number;
}

export type DownloadResult = {
  success: boolean;
  id: string;
  nombre: string;
};

// ─── Error messages (Spanish) ─────────────────────────────────────────────────

const ERROR_MESSAGES: Record<SyncErrorCode, string> = {
  DUPLICATE_CODE: 'El codigo de parcela ya existe en el servidor. Renombra el codigo e intenta de nuevo.',
  DUPLICATE_NAME: 'El nombre de parcela ya existe en el servidor. Renombra la parcela e intenta de nuevo.',
  GENERIC_CONFLICT: 'El servidor rechazo la operacion por un conflicto. Intenta de nuevo o contacta soporte.',
  PARCELA_PENDING: 'No se pudo sincronizar el grupo porque su parcela aun esta pendiente. Resolve el problema de la parcela primero.',
  PERMISSION: 'El servidor rechazo la operacion por permisos. No estas habilitado para sincronizar esta plantacion; contacta a un administrador.',
  NETWORK: 'Error de conexion. Verifica tu internet e intenta de nuevo.',
  UNKNOWN: 'Error inesperado. Intenta de nuevo.',
};

export function getErrorMessage(code: SyncErrorCode): string {
  return ERROR_MESSAGES[code];
}
