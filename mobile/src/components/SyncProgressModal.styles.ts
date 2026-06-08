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
  failureSection: {
    width: '100%',
    gap: spacing.sm,
  },
  failureTitle: {
    fontSize: fontSize.base,
    color: colors.secondary,
    fontFamily: fonts.semiBold,
  },
  failureItem: {
    backgroundColor: colors.dangerBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  failureName: {
    fontSize: fontSize.base,
    color: colors.text,
    fontFamily: fonts.semiBold,
  },
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
