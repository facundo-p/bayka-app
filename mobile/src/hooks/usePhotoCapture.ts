import { usePhotoPicker } from './usePhotoPicker';
import { launchCamera, launchGallery } from '../services/PhotoService';
import type { ConfirmModalButton } from '../components/ConfirmModal';

type ShowFn = (config: {
  icon?: string;
  iconColor?: string;
  title: string;
  message: string;
  buttons: ConfirmModalButton[];
}) => void;

/**
 * Wraps usePhotoPicker + PhotoService into a single hook.
 * Screens use this instead of importing PhotoService directly.
 */
export function usePhotoCapture(show: ShowFn) {
  return usePhotoPicker(show, launchCamera, launchGallery);
}
