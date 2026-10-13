/**
 * Quién elimina la foto de un árbol desde la web (#903), con el motivo que
 * muestra el botón deshabilitado. Puro: se testea sin renderizar.
 */
import { esArchivada, type Plantacion } from '../../queries/plantationQueries';
import { ROL, type Perfil } from '../../repositories/profileRepository';

const ROLES_QUE_ELIMINAN_FOTOS: ReadonlyArray<Perfil['rol']> = [ROL.ADMIN, ROL.SUPERADMIN];

export const MOTIVO_NO_ELIMINA_FOTO = {
  sinPermiso: 'Tu usuario no tiene permisos para eliminar fotos.',
  cargando: 'Cargando la plantación…',
  archivada: 'La plantación está archivada: desarchivala para eliminar la foto.',
} as const;

/**
 * Espeja la RPC: admin o superadmin, en una plantación no archivada; una
 * finalizada también (#903). null si puede.
 */
export function motivoParaNoEliminarFoto(
  perfil: Pick<Perfil, 'rol' | 'activo'> | null,
  plantacion: Pick<Plantacion, 'archivadaEn'> | null | undefined,
): string | null {
  if (!perfil?.activo || !ROLES_QUE_ELIMINAN_FOTOS.includes(perfil.rol)) {
    return MOTIVO_NO_ELIMINA_FOTO.sinPermiso;
  }
  if (!plantacion) return MOTIVO_NO_ELIMINA_FOTO.cargando;
  if (esArchivada(plantacion)) return MOTIVO_NO_ELIMINA_FOTO.archivada;
  return null;
}

export const descripcionEliminarFoto = (idArbol: string) =>
  `Se elimina la foto del árbol ${idArbol} para todos: deja de verse en la web, ` +
  'en los celulares al sincronizar y en los PDF.';
