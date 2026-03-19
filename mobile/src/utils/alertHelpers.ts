import { Alert } from 'react-native';

export function showConfirmDialog(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void | Promise<void>,
) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function showDoubleConfirmDialog(
  title: string,
  message: string,
  confirmLabel: string,
  finalMessage: string,
  onConfirm: () => void | Promise<void>,
) {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: confirmLabel,
      style: 'destructive',
      onPress: () => {
        Alert.alert('Estas seguro?', finalMessage, [
          { text: 'No, cancelar', style: 'cancel' },
          { text: 'Si, eliminar', style: 'destructive', onPress: onConfirm },
        ]);
      },
    },
  ]);
}
