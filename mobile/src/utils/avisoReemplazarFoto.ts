import type { ShowFn } from './alertHelpers';
import type { ConfirmModalButton } from '../components/ConfirmModal';
import { NO_SE_PUEDE_DESHACER } from './avisoQuitarFoto';

export const TITULO_REEMPLAZAR_FOTO = 'Reemplazar la foto';

/** `subId`: el ID del árbol que ve el usuario. */
export type FotoAReemplazar = { subId: string; fotoSynced: boolean };

/** Sin dato de sync se asume subida: el texto no afirma que se pierda algo que quizás está en Bayka. */
export function fotoAReemplazar(arbol: { subId: string; fotoSynced?: boolean | null }): FotoAReemplazar {
  return { subId: arbol.subId, fotoSynced: arbol.fotoSynced ?? true };
}

/** Sin `onVerActual` el aviso no lo ofrece: es para cuando la foto ya está a la vista. */
export type AccionesReemplazarFoto = { onVerActual?: () => void; onConfirm: () => void };

/**
 * Una foto subida sigue en Bayka hasta sincronizar: quitar la nueva antes vuelve
 * a ella (#816). Una sin subir se pierde.
 */
export function textoReemplazarFoto(subId: string, fotoSynced: boolean): string {
  return fotoSynced
    ? `${subId} ya tiene foto. La nueva la reemplaza para todos al sincronizar; hasta entonces, quitar la nueva vuelve a esta.`
    : `${subId} tiene una foto sin sincronizar. La nueva la reemplaza. ${NO_SE_PUEDE_DESHACER}`;
}

/** Confirmación previa a reemplazar la foto de un árbol; cancelar la deja como está. */
export function confirmarReemplazarFoto(show: ShowFn, foto: FotoAReemplazar, { onVerActual, onConfirm }: AccionesReemplazarFoto) {
  const verActual: ConfirmModalButton[] = onVerActual
    ? [{ label: 'Ver actual', onPress: onVerActual, style: 'primary', icon: 'eye-outline' }]
    : [];
  show({
    icon: 'camera-outline',
    title: TITULO_REEMPLAZAR_FOTO,
    message: textoReemplazarFoto(foto.subId, foto.fotoSynced),
    buttons: [
      { label: 'Cancelar', onPress: () => {}, style: 'cancel' },
      ...verActual,
      { label: 'Reemplazar', onPress: onConfirm, style: 'primary' },
    ],
  });
}

/**
 * Reemplazo desde el visor, con la foto a la vista: no ofrece «Ver actual». Si el visor se
 * abrió desde «Ver actual» de un aviso (`reemplazoConfirmado`), no vuelve a preguntar.
 */
export function confirmarReemplazoEnVisor(
  show: ShowFn,
  foto: FotoAReemplazar,
  reemplazoConfirmado: boolean | undefined,
  onConfirm: () => void,
) {
  if (reemplazoConfirmado) onConfirm();
  else confirmarReemplazarFoto(show, foto, { onConfirm });
}
