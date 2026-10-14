import { StyleSheet, Dimensions } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** ✕ del visor: tamaño del ícono y ancho de su área táctil (ícono + padding a cada lado). */
export const TAMANO_ICONO_CERRAR = 28;
export const ANCHO_CERRAR = TAMANO_ICONO_CERRAR + spacing.md * 2;

export const photoViewerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: spacing.xxl,
    zIndex: 10,
    padding: spacing.md,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  fotoRemota: {
    width: SCREEN_WIDTH - spacing['4xl'] * 2,
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingTop: spacing.xl,
  },
  actionBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  actionText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
});
