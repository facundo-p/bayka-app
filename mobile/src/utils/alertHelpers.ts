import type { ConfirmModalButton } from '../components/ConfirmModal';

type ShowFn = (config: {
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
}) => void;

/**
 * Info dialog (single OK button)
 */
export function showInfoDialog(
  show: ShowFn,
  title: string,
  message: string,
  icon?: string,
  iconColor?: string,
) {
  show({
    icon: icon as any,
    iconColor,
    title,
    message,
    buttons: [
      { label: 'Entendido', onPress: () => {}, style: 'primary' },
    ],
  });
}

/**
 * Confirm dialog (Cancel + Action)
 */
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

/**
 * Double confirm dialog (Cancel + Confirm → second confirmation)
 */
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
    iconColor: '#c62828',
    title,
    message,
    buttons: [
      { label: 'Cancelar', onPress: () => {}, style: 'cancel' },
      {
        label: confirmLabel,
        onPress: () => {
          // Show second confirmation
          show({
            icon: 'alert-circle-outline' as any,
            iconColor: '#c62828',
            title: 'Estas seguro?',
            message: finalMessage,
            buttons: [
              { label: 'No, cancelar', onPress: () => {}, style: 'cancel' },
              {
                label: 'Si, eliminar',
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

/**
 * Options dialog (Cancel + multiple options)
 */
export function showOptionsDialog(
  show: ShowFn,
  title: string,
  message: string,
  options: Array<{ label: string; onPress: () => void; icon?: string }>,
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
