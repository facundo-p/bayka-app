import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const syncProgressModalStyles = StyleSheet.create({
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
  },
  progressText: {
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
  },
  currentName: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  plantationProgress: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  successText: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textAlign: 'center',
  },
  // Usado por los mensajes de fallo de fotos (la lista de errores de
  // parcelas/grupos vive en FailureList).
  failureMessage: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.danger,
  },
  dismissButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['4xl'],
    marginTop: spacing.sm,
  },
  dismissText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
  },
});
