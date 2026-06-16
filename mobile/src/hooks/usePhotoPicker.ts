import { useCallback } from 'react';
import type { ConfirmModalButton } from '../components/ConfirmModal';
import type { RawPhoto } from '../services/PhotoService';
import { usePhotoCrop } from '../components/PhotoCropProvider';

type ShowFn = (config: {
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
}) => void;

type LaunchRawFn = () => Promise<RawPhoto | null>;

/**
 * Photo picker: elige cámara/galería (ConfirmModal) y luego pasa por el paso de
 * recorte opcional (#167) antes de resolver con la URI final. Devuelve null si
 * se cancela en cualquier punto.
 */
export function usePhotoPicker(show: ShowFn, launchCameraRaw: LaunchRawFn, launchGalleryRaw: LaunchRawFn) {
  const { requestCrop } = usePhotoCrop();

  const pickPhoto = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const pick = async (launch: LaunchRawFn) => {
        const raw = await launch();
        if (!raw) { resolve(null); return; }
        resolve(await requestCrop(raw));
      };
      show({
        icon: 'camera-outline' as any,
        title: 'Agregar foto',
        message: 'Como queres agregar la foto?',
        buttons: [
          { label: 'Camara', icon: 'camera-outline' as any, onPress: () => { void pick(launchCameraRaw); }, style: 'primary' },
          { label: 'Galeria', icon: 'images-outline' as any, onPress: () => { void pick(launchGalleryRaw); }, style: 'primary' },
          { label: 'Cancelar', onPress: () => { resolve(null); }, style: 'cancel' },
        ],
      });
    });
  }, [show, launchCameraRaw, launchGalleryRaw, requestCrop]);

  return { pickPhoto };
}
