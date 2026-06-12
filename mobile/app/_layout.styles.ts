import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing } from '../src/theme';

export const rootLayoutStyles = StyleSheet.create({
  // Pantalla de error (fondo claro): no comparte fondo con el loading.
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing['4xl'],
  },
  // Pantalla de carga: mismo fondo que el splash nativo (colors.primary =
  // #0A3760) para que la transición splash → loading no parpadee.
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: spacing['4xl'],
  },
  loadingLogo: {
    width: 160,
    height: 160,
    marginBottom: spacing.xxl,
    resizeMode: 'contain',
  },
  loadingText: {
    fontSize: fontSize.xl,
    color: colors.white,
  },
  errorTitle: {
    fontSize: fontSize.xxl,
    color: colors.dangerText,
    marginBottom: spacing.md,
  },
  errorBody: {
    fontSize: fontSize.lg,
    color: colors.textMedium,
    marginBottom: spacing.xxl,
  },
  errorDetail: {
    fontSize: fontSize.sm,
    color: colors.textPlaceholder,
    textAlign: 'center',
  },
});
