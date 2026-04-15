import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plantationBg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  viewAllText: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fonts.semiBold,
    color: colors.plantation,
  },
  gridScroll: {
    flex: 1,
  },
  gridContent: {
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  loader: {
    marginTop: spacing['6xl'],
  },
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
  configButton: {
    paddingVertical: spacing.button,
    paddingHorizontal: spacing.button,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
