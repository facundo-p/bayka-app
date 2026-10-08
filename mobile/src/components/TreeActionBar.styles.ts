import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const treeActionBarStyles = StyleSheet.create({
  actionBar: {
    flexDirection: 'row',
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    paddingVertical: spacing.button,
    paddingHorizontal: spacing.button,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  /** Engranaje y cámara de la barra: mismo tamaño y estilo. */
  iconButton: {
    paddingVertical: spacing.button,
    paddingHorizontal: spacing.button,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  spacer: {
    flex: 1,
  },
  finalizarButton: {
    paddingVertical: spacing.button,
    paddingHorizontal: spacing['4xl'],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.plantationHeaderBg,
    alignItems: 'center' as const,
  },
  finalizarButtonText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
