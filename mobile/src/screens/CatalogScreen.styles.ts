/**
 * Styles for CatalogScreen — centralized tokens from theme.ts.
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const catalogScreenStyles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  retryText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    gap: spacing.xl,
    paddingBottom: spacing['5xl'],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  photosToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  photosToggleLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  selectionText: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  downloadButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  downloadButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
});
