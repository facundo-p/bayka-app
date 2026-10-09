import { showConfirmDialog, type ShowFn } from './alertHelpers';
import { fotoSinSubir } from './photoUri';
import { colors } from '../theme';

export const TITULO_QUITAR_FOTO = 'Quitar la foto del árbol';

export const TEXTO_QUITAR_FOTO = 'Se quita para todos los que vean este árbol.';

export const NO_SE_PUEDE_DESHACER = 'No se puede deshacer.';

type FotoAQuitar = { fotoUrl: string | null | undefined; fotoSynced?: boolean | null };

/**
 * Quitar una foto ya subida pide confirmación: se quita para todos. Una sin subir
 * se deshace sin preguntar y el árbol vuelve a la de la última sincronización (#816).
 */
export function confirmarQuitarFoto(show: ShowFn, foto: FotoAQuitar, onConfirm: () => void | Promise<void>) {
  if (fotoSinSubir(foto)) {
    void onConfirm();
    return;
  }
  showConfirmDialog(show, TITULO_QUITAR_FOTO, TEXTO_QUITAR_FOTO, 'Quitar', onConfirm,
    { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' });
}
