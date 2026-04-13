import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  configButton: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  finalizarButton: {
    paddingVertical: 14,
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
  reactivateBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.plantationBg,
    alignItems: 'flex-start' as const,
  },
  reactivateButton: {
    flexDirection: 'row',
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.plantation,
  },
  reactivateText: {
    color: colors.plantation,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.base,
  },
  inlineListContent: {
    padding: spacing.xl,
    gap: spacing.sm,
    paddingBottom: spacing['6xl'],
  },
  inlineEmptyText: {
    textAlign: 'center' as const,
    color: colors.textMuted,
    marginTop: spacing['6xl'],
    fontSize: fontSize.lg,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center' as const,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  treeRowPos: {
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
    color: colors.textMedium,
    width: 26,
    textAlign: 'center' as const,
  },
  treeRowName: {
    fontSize: fontSize.md,
    fontFamily: fonts.semiBold,
    color: colors.plantation,
    flex: 1,
  },
  treeRowNameNN: {
    color: colors.secondary,
  },
  treeRowCode: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: fonts.monospace,
    minWidth: 40,
  },
  treeRowActions: {
    flexDirection: 'row',
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  treeRowBtn: {
    padding: spacing.xs,
  },
});
