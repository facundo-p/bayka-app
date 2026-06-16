import { usePhotoPicker } from './usePhotoPicker';
import type { ConfirmModalButton } from '../components/ConfirmModal';

type ShowFn = (config: {
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
}) => void;

/**
 * Punto de entrada de captura de foto para las pantallas: muestra el selector
 * (cámara in-app / galería) y devuelve la URI final tras el recorte (#172).
 */
export function usePhotoCapture(show: ShowFn) {
  return usePhotoPicker(show);
}
