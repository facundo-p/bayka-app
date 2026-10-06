import { showConfirmDialog, type ShowFn } from './alertHelpers';
import { colors } from '../theme';

export const TITULO_QUITAR_FOTO = 'Quitar la foto';

export const NO_SE_PUEDE_DESHACER = 'No se puede deshacer.';

/**
 * Qué se pierde al quitar. fotoSynced=false no prueba que el server no la tenga: reemplazar
 * una foto ya subida también lo deja en false, así que ese texto no afirma que sea solo local.
 */
export function textoQuitarFoto(fotoSynced: boolean): string {
  return fotoSynced
    ? `Se va a quitar de Bayka y de los demás celulares en la próxima sincronización. ${NO_SE_PUEDE_DESHACER}`
    : `Se va a quitar de este celular. Si la foto ya se había subido a Bayka, también se quita de Bayka y de los demás celulares en la próxima sincronización. ${NO_SE_PUEDE_DESHACER}`;
}

/** Confirmación previa a quitar la foto de un árbol; cancelar la deja como está. */
export function confirmarQuitarFoto(show: ShowFn, fotoSynced: boolean, onConfirm: () => void | Promise<void>) {
  showConfirmDialog(show, TITULO_QUITAR_FOTO, textoQuitarFoto(fotoSynced), 'Quitar', onConfirm,
    { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' });
}
