import type { ConflictoDeCampo } from '../utils/conflictosDeEdicion';

/** Plantación tal como la manejan el listado y las acciones de admin. */
export type Plantation = {
  id: string;
  lugar: string;
  periodo: string;
  estado: string;
  createdAt: string;
  pendingSync?: boolean;  // true for offline-created, not yet uploaded
  pendingEdit?: boolean;  // true for offline-edited data, not yet uploaded
  gpsCaptureFrequency?: number;
  gpsCaptureRequired?: boolean;
  photoCaptureAllTrees?: boolean;
  visibleInApp?: boolean;
  descripcion?: string | null;
  /** YYYY-MM-DD. */
  fechaInicio?: string | null;
  objetivoArboles?: number | null;
  /** Null = no archivada (#477). */
  archivadaEn: string | null;
  /** Null = existe en el server (#478). */
  eliminadaEnServidorEn: string | null;
  /** Campos que chocaron con la web, por resolver (#634). */
  conflictosDeEdicion?: ConflictoDeCampo[] | null;
};
