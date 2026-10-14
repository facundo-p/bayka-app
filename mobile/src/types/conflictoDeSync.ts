/** Un conflicto de sincronización tal como lo muestra y resuelve "Resolver cambios" (#804). */
import type { conflictosDeSync } from '../database/schema';
import type { CampoEnConflicto, ErrorDeConflicto, FallaAlResolver } from '../constants/conflictoDeSync';
import type { ErrorDeDuplicado, ErrorDeEdicion } from '../constants/errorDeEdicion';

export type ConflictoDeSync = typeof conflictosDeSync.$inferSelect;

/** Por qué no se puede conservar lo del teléfono. */
export type MotivoSinConservar = ErrorDeConflicto | ErrorDeEdicion | ErrorDeDuplicado;

export interface ArbolEnConflicto {
  id: string;
  subId: string;
  posicion: number;
  especieId: string | null;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  gpsCapturedAt: string | null;
  fotoUrl: string | null;
}

export interface GrupoEnConflicto {
  id: string;
  parcelaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
}

export interface EspecieEnConflicto {
  nombre: string;
  codigo: string;
}

/** Un conflicto con lo que hay hoy: `arbol` es null en los de grupo o si el árbol se borró. */
export interface ConflictoParaResolver {
  conflicto: ConflictoDeSync;
  arbol: ArbolEnConflicto | null;
  grupo: GrupoEnConflicto | null;
  /** En los de especie: la propia y la del servidor, si están en el catálogo. */
  especies: { mia: EspecieEnConflicto | null; servidor: EspecieEnConflicto | null };
  /** Null si se puede conservar lo del teléfono. */
  motivo: MotivoSinConservar | null;
}

/** Lo que trae la base, antes de saber si lo propio se puede conservar. */
export type ConflictoEnContexto = Omit<ConflictoParaResolver, 'motivo'>;

/** Lo que se aplica al guardar un conflicto: conservar lo propio o quedarse con lo del servidor. */
export interface EleccionDeConflicto {
  entidadId: string;
  campo: CampoEnConflicto;
  /** La versión que vio el usuario: si el servidor la reemplazó, la elección no se aplica. */
  detectadoEn: string;
  conservar: boolean;
}

/** Una elección que no se aplicó: el conflicto sigue pendiente. */
export interface FallaDeConflicto {
  entidadId: string;
  campo: CampoEnConflicto;
  falla: FallaAlResolver;
}
