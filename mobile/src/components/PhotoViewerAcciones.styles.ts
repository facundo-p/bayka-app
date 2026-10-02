import { StyleSheet } from 'react-native';
import { spacing, touchTarget } from '../theme';
import { ANCHO_CERRAR } from './PhotoViewer.styles';

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
