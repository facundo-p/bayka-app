import { showConfirmDialog, type ShowFn } from './alertHelpers';
import { colors } from '../theme';

export const TITULO_QUITAR_FOTO = 'Quitar la foto';

const NO_SE_PUEDE_DESHACER = 'No se puede deshacer.';

/** Qué se pierde al quitar: una foto ya subida se propaga a Bayka y a los demás celulares. */
export function textoQuitarFoto(fotoSynced: boolean): string {
  return fotoSynced
    ? `Se va a quitar de Bayka y de los demás celulares en la próxima sincronización. ${NO_SE_PUEDE_DESHACER}`
    : `Se va a quitar solo de este celular. Todavía no se había subido a Bayka. ${NO_SE_PUEDE_DESHACER}`;
}

/** Confirmación previa a quitar la foto de un árbol; cancelar la deja como está. */
export function confirmarQuitarFoto(show: ShowFn, fotoSynced: boolean, onConfirm: () => void | Promise<void>) {
  showConfirmDialog(show, TITULO_QUITAR_FOTO, textoQuitarFoto(fotoSynced), 'Quitar', onConfirm,
    { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' });
}
