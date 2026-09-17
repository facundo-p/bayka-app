/**
 * Archivar/desarchivar una plantación (#477): quién puede, qué acción toca y qué
 * dice la confirmación. Puro: se testea sin renderizar.
 */
import { esArchivada, type Plantacion } from '../../queries/plantationQueries';
import { archivarPlantacion, desarchivarPlantacion } from '../../repositories/plantationRepository';
import { ROL, type Perfil } from '../../repositories/profileRepository';

export const ACCION_ARCHIVADO = {
  archivar: 'archivar',
  desarchivar: 'desarchivar',
} as const;

export type AccionArchivado = (typeof ACCION_ARCHIVADO)[keyof typeof ACCION_ARCHIVADO];

/** Por qué la edición está deshabilitada en una archivada (visible en title). */
export const MOTIVO_ARCHIVADA = 'Plantación archivada: desarchivala para editarla';

const ROLES_QUE_ARCHIVAN: ReadonlyArray<Perfil['rol']> = [ROL.ADMIN, ROL.SUPERADMIN];

/** Espeja el guard del RPC; el server rechaza igual si se fuerza. */
export function puedeArchivar(perfil: Pick<Perfil, 'rol' | 'activo'> | null): boolean {
  return perfil !== null && perfil.activo && ROLES_QUE_ARCHIVAN.includes(perfil.rol);
}

export function accionDeArchivado(plantacion: Pick<Plantacion, 'archivadaEn'>): AccionArchivado {
  return esArchivada(plantacion) ? ACCION_ARCHIVADO.desarchivar : ACCION_ARCHIVADO.archivar;
}

/** null = se puede editar; texto = por qué no. */
export function motivoEdicion(plantacion: Pick<Plantacion, 'archivadaEn'>): string | null {
  return esArchivada(plantacion) ? MOTIVO_ARCHIVADA : null;
}

export interface ConfirmacionArchivado {
  etiquetaMenu: string;
  titulo: (lugar: string) => string;
  descripcion: (lugar: string) => string;
  etiqueta: string;
  destructiva?: boolean;
  servicio: (plantationId: string) => Promise<void>;
}

function copyArchivar(lugar: string): string {
  return (
    `${lugar} deja de aparecer en los listados de la web y en la app, y queda en solo lectura: ` +
    'nadie puede editarla ni cargarle datos. ' +
    'Si algún celular tiene datos sin subir, no los va a poder subir hasta que se desarchive; ' +
    'mientras tanto quedan guardados en el celular. Se puede desarchivar en cualquier momento.'
  );
}

function copyDesarchivar(lugar: string): string {
  return (
    `${lugar} vuelve a aparecer en los listados y en la app, y se puede editar de nuevo. ` +
    'Los celulares con datos pendientes los suben en su próxima sincronización. ' +
    'Su estado (activa o finalizada) no cambia.'
  );
}

export const CONFIRMACION_ARCHIVADO: Record<AccionArchivado, ConfirmacionArchivado> = {
  [ACCION_ARCHIVADO.archivar]: {
    etiquetaMenu: 'Archivar plantación',
    titulo: (lugar) => `Archivar ${lugar}`,
    descripcion: copyArchivar,
    etiqueta: 'Archivar',
    destructiva: true,
    servicio: archivarPlantacion,
  },
  [ACCION_ARCHIVADO.desarchivar]: {
    etiquetaMenu: 'Desarchivar plantación',
    titulo: (lugar) => `Desarchivar ${lugar}`,
    descripcion: copyDesarchivar,
    etiqueta: 'Desarchivar',
    servicio: desarchivarPlantacion,
  },
};
