import { StyleSheet } from 'react-native';
import { spacing, touchTarget } from '../theme';

// ✕ del visor: ícono 28 + padding md a cada lado = 44.
const ANCHO_CERRAR = touchTarget.min;

export const photoViewerAccionesStyles = StyleSheet.create({
  barra: {
    position: 'absolute',
    right: spacing.xxl + ANCHO_CERRAR,
    zIndex: 10,
    flexDirection: 'row',
  },
  boton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
