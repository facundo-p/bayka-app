// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncErrorCode = 'DUPLICATE_CODE' | 'NETWORK' | 'UNKNOWN';

export interface PhotoSyncProgress {
  total: number;
  completed: number;
}

export type SyncSubGroupResult =
  | { success: true; subgroupId: string; nombre: string }
  | { success: false; subgroupId: string; nombre: string; error: SyncErrorCode };

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

export interface DownloadProgress {
  total: number;
  completed: number;
  currentName: string;
}

export type DownloadResult = {
  success: boolean;
  id: string;
  nombre: string;
};

// ─── Error messages (Spanish) ─────────────────────────────────────────────────

const ERROR_MESSAGES: Record<SyncErrorCode, string> = {
  DUPLICATE_CODE: 'El codigo de subgrupo ya existe en el servidor. Renombra el codigo e intenta de nuevo.',
  NETWORK: 'Error de conexion. Verifica tu internet e intenta de nuevo.',
  UNKNOWN: 'Error inesperado. Intenta de nuevo.',
};

export function getErrorMessage(code: SyncErrorCode): string {
  return ERROR_MESSAGES[code];
}
