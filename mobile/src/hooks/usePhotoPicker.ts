import { useCallback } from 'react';
import type { ConfirmModalButton } from '../components/ConfirmModal';
import { usePhotoCaptureFlow } from '../components/PhotoCropProvider';

type ShowFn = (config: {
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
}) => void;

/**
 * Photo picker: elige cámara (in-app) o galería y delega en el flujo de captura
 * (#172) que incluye recorte opcional + reintentar. Devuelve la URI final o null.
 * Las firmas `launchCameraRaw`/`launchGalleryRaw` ya no se inyectan: el origen
 * lo resuelve `requestPhoto(source)`.
 */
export function usePhotoPicker(show: ShowFn) {
  const { requestPhoto } = usePhotoCaptureFlow();

  const pickPhoto = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      show({
        icon: 'camera-outline' as any,
        title: 'Agregar foto',
        message: 'Como queres agregar la foto?',
        buttons: [
          { label: 'Camara', icon: 'camera-outline' as any, onPress: () => { requestPhoto('camera').then(resolve); }, style: 'primary' },
          { label: 'Galeria', icon: 'images-outline' as any, onPress: () => { requestPhoto('gallery').then(resolve); }, style: 'primary' },
          { label: 'Cancelar', onPress: () => { resolve(null); }, style: 'cancel' },
        ],
      });
    });
  }, [show, requestPhoto]);

  return { pickPhoto };
}
