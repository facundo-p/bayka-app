// Estilos de TexturedBackground.
import { StyleSheet } from 'react-native';
import { colors } from '../theme';

export const texturedBackgroundStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.textureOverlay,
  },
});
