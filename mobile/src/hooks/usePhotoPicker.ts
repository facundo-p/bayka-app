import { useState, useCallback } from 'react';
import type { ConfirmModalButton } from '../components/ConfirmModal';

type ShowFn = (config: {
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
}) => void;

type LaunchFn = () => Promise<string | null>;

/**
 * Hook that provides a photo picker using ConfirmModal instead of Alert.alert.
 * Returns a pickPhoto function that shows the custom modal.
 */
export function usePhotoPicker(show: ShowFn, launchCamera: LaunchFn, launchGallery: LaunchFn) {
  const [resolver, setResolver] = useState<((value: string | null) => void) | null>(null);

  const pickPhoto = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      show({
        icon: 'camera-outline' as any,
        title: 'Agregar foto',
        message: 'Como queres agregar la foto?',
        buttons: [
          {
            label: 'Camara',
            icon: 'camera-outline' as any,
            onPress: () => { launchCamera().then(resolve); },
            style: 'primary',
          },
          {
            label: 'Galeria',
            icon: 'images-outline' as any,
            onPress: () => { launchGallery().then(resolve); },
            style: 'primary',
          },
          {
            label: 'Cancelar',
            onPress: () => { resolve(null); },
            style: 'cancel',
          },
        ],
      });
    });
  }, [show, launchCamera, launchGallery]);

  return { pickPhoto };
}
