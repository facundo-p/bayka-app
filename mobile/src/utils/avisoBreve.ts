import { Alert, Platform, ToastAndroid } from 'react-native';

/** Aviso que no bloquea y se ve sobre modales (un diálogo propio no puede abrirse sobre el visor). */
export function avisoBreve(mensaje: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(mensaje, ToastAndroid.LONG);
  else Alert.alert(mensaje);
}
