import type { ConfirmModalButton } from '../components/ConfirmModal';
import { colors } from '../theme';

type ShowFn = (config: {
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
}) => void;

/**
 * Info dialog (single OK button). `onDismiss`, si viene, corre recién cuando el usuario
 * cierra el diálogo (tap en "Entendido") — para encadenar un paso siguiente sin abrirlo
 * en el mismo tick que este diálogo (dos modales nativos a la vez, #656).
 */
export function showInfoDialog(
  show: ShowFn,
  title: string,
  message: string,
  icon?: string,
  iconColor?: string,
  onDismiss?: () => void,
) {
  show({
    icon: icon as any,
    iconColor,
    title,
    message,
    buttons: [
      { label: 'Entendido', onPress: () => { onDismiss?.(); }, style: 'primary' },
    ],
  });
}

/** Confirm dialog (Cancel + Action). */
export function showConfirmDialog(
  show: ShowFn,
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void | Promise<void>,
  options?: { icon?: string; iconColor?: string; style?: 'primary' | 'danger' },
) {
  show({
    icon: options?.icon as any,
    iconColor: options?.iconColor,
    title,
    message,
    buttons: [
      { label: 'Cancelar', onPress: () => {}, style: 'cancel' },
      {
        label: confirmLabel,
        onPress: () => { onConfirm(); },
        style: options?.style ?? 'primary',
      },
    ],
  });
}

/** Double confirm dialog (Cancel + Confirm → second confirmation). */
export function showDoubleConfirmDialog(
  show: ShowFn,
  title: string,
  message: string,
  confirmLabel: string,
  finalMessage: string,
  onConfirm: () => void | Promise<void>,
) {
  show({
    icon: 'warning-outline' as any,
    iconColor: colors.danger,
    title,
    message,
    buttons: [
      { label: 'Cancelar', onPress: () => {}, style: 'cancel' },
      {
        label: confirmLabel,
        onPress: () => {
          show({
            icon: 'alert-circle-outline' as any,
            iconColor: colors.danger,
            title: '¿Estás seguro?',
            message: finalMessage,
            buttons: [
              { label: 'No, cancelar', onPress: () => {}, style: 'cancel' },
              {
                label: 'Sí, eliminar',
                onPress: () => { onConfirm(); },
                style: 'danger',
                icon: 'trash-outline' as any,
              },
            ],
          });
        },
        style: 'danger',
      },
    ],
  });
}

/** Options dialog (Cancel + multiple options). */
export function showOptionsDialog(
  show: ShowFn,
  title: string,
  message: string,
  options: { label: string; onPress: () => void; icon?: string }[],
) {
  show({
    icon: 'options-outline' as any,
    title,
    message,
    buttons: [
      ...options.map((opt) => ({
        label: opt.label,
        onPress: opt.onPress,
        style: 'primary' as const,
        icon: opt.icon as any,
      })),
      { label: 'Cancelar', onPress: () => {}, style: 'cancel' as const },
    ],
  });
}
