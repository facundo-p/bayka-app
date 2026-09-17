/** Plantación tal como la manejan el listado y las acciones de admin. */
export type Plantation = {
  id: string;
  lugar: string;
  periodo: string;
  estado: string;
  createdAt: string;
  pendingSync?: boolean;  // true for offline-created, not yet uploaded
  pendingEdit?: boolean;  // true for offline-edited lugar/periodo, not yet uploaded
  gpsCaptureFrequency?: number;
  gpsCaptureRequired?: boolean;
  /** Null = no archivada (#477). */
  archivadaEn: string | null;
};
