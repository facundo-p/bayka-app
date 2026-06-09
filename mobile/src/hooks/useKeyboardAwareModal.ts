import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ViewStyle } from 'react-native';
import { useKeyboardOverlap } from './useKeyboardOverlap';
import { spacing } from '../theme';

interface KeyboardAwareModalStyles {
  /** Aplicar al contenedor scrollable: lo eleva por encima del teclado. */
  bodyPadding: Pick<ViewStyle, 'paddingBottom'>;
  /**
   * Aplicar al footer de acciones. Con el teclado abierto deja solo el aire de
   * diseño; con el teclado cerrado además reserva la nav bar para no pisarla.
   */
  footerPadding: Pick<ViewStyle, 'paddingBottom'>;
  keyboardVisible: boolean;
}

/**
 * Avoidance de teclado para modales full-screen con footer de acciones
 * (ParcelaFormModal, AdminModalWrapper, AdminPlantationModals…). Encapsula la
 * geometría correcta (ver [[useKeyboardOverlap]]) + la reserva de nav bar, para
 * no repetir el cálculo en cada modal. Reusar este hook, no copiar los estilos.
 */
export function useKeyboardAwareModal(): KeyboardAwareModalStyles {
  const insets = useSafeAreaInsets();
  const overlap = useKeyboardOverlap();
  const keyboardVisible = overlap > 0;
  return {
    bodyPadding: { paddingBottom: overlap },
    footerPadding: { paddingBottom: keyboardVisible ? spacing.xxl : spacing.xxl + insets.bottom },
    keyboardVisible,
  };
}
