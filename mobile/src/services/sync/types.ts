import { PG_ERROR } from '../../supabase/postgresErrorCodes';

/**
 * Códigos de error de sync (grupo + parcela). DUPLICATE_CODE/NAME: unique violation (23505) en
 * pushService, vía error.code + parsing de error.details (nunca substring de message).
 * GENERIC_CONFLICT: 23505 pero details no matchea los constraints esperados. PARCELA_PENDING:
 * grupo no subido porque su parcela sigue pending_sync (orden FK). PERMISSION: RLS (42501).
 * NETWORK/UNKNOWN: legacy.
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
  DUPLICATE_CODE: 'El codigo ya existe en el servidor. Renombra el codigo e intenta de nuevo.',
  DUPLICATE_NAME: 'El nombre ya existe en el servidor. Renombra e intenta de nuevo.',
  GENERIC_CONFLICT: 'El servidor rechazo la operacion por un conflicto. Intenta de nuevo o contacta soporte.',
  PARCELA_PENDING: 'No se pudo sincronizar el grupo porque su parcela aun esta pendiente. Resolve el problema de la parcela primero.',
  PERMISSION: 'El servidor rechazo la operacion por permisos. No estas habilitado para sincronizar esta plantacion; contacta a un administrador.',
  NETWORK: 'Error de conexion. Verifica tu internet e intenta de nuevo.',
  UNKNOWN: 'Error inesperado. Intenta de nuevo.',
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
  if (error?.code === PG_ERROR.INSUFFICIENT_PRIVILEGE) return { error: 'PERMISSION', detail };
  const msg = String(error?.message ?? '').toLowerCase();
  if (!error?.code && (msg.includes('fetch') || msg.includes('network'))) {
    return { error: 'NETWORK', detail };
  }
  return { error: 'UNKNOWN', detail };
}
