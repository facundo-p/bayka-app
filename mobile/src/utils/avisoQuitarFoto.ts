import { showConfirmDialog, type ShowFn } from './alertHelpers';
import { fotoSinSubir } from './photoUri';
import { colors } from '../theme';
import type { ResultadoDeQuitarFoto } from '../repositories/TreeRepository';

export const TITULO_QUITAR_FOTO = 'Quitar la foto del árbol';

export const TEXTO_QUITAR_FOTO = 'Se quita para todos los que vean este árbol.';

export const NO_SE_PUEDE_DESHACER = 'No se puede deshacer.';

type FotoAQuitar = { fotoUrl: string | null | undefined; fotoSynced?: boolean | null };

/** `confirmado`: la persona ya aceptó quitarla para todos. */
export type QuitarFoto = (confirmado: boolean) => Promise<ResultadoDeQuitarFoto>;

function preguntar(show: ShowFn, quitar: QuitarFoto) {
  showConfirmDialog(show, TITULO_QUITAR_FOTO, TEXTO_QUITAR_FOTO, 'Quitar', () => { void quitar(true); },
    { icon: 'trash-outline', iconColor: colors.danger, style: 'danger' });
}

/**
 * Quitar una foto ya subida pide confirmación: se quita para todos. Una sin subir
 * se deshace sin preguntar y el árbol vuelve a la de la última sincronización
 * (#816). Si mientras tanto se subió, el repositorio no la quita y se pregunta.
 */
export function confirmarQuitarFoto(show: ShowFn, foto: FotoAQuitar, quitar: QuitarFoto) {
  if (!fotoSinSubir(foto)) {
    preguntar(show, quitar);
    return;
  }
  void quitar(false).then((resultado) => {
    if (resultado.requiereConfirmacion) preguntar(show, quitar);
  });
}
