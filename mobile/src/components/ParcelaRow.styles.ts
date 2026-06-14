/**
 * Styles for ParcelaRow — centralized tokens from theme.ts (CLAUDE.md §8).
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const parcelaRowStyles = StyleSheet.create({
  rowStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: 44,
    gap: spacing.md,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    backgroundColor: 'transparent',
    minHeight: 44,
    gap: spacing.md,
  },
  rowPressed: {
    opacity: 0.7,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xs,
  },
  headingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nombre: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semiBold,
    color: colors.textHeading,
    flexShrink: 1,
  },
  codigoChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.plantationBg,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.plantationBorder,
  },
  codigoText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.monospace,
    color: colors.plantationDark,
  },
  statsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  nnBadge: {
    backgroundColor: colors.secondaryYellowLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.secondaryYellowMedium,
  },
  nnBadgeText: {
    color: colors.secondaryYellowDark,
    fontSize: fontSize.xs,
    fontFamily: fonts.bold,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
