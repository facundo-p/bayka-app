/**
 * Styles for DownloadProgressModal — centralized tokens from theme.ts.
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const downloadProgressModalStyles = StyleSheet.create({
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
  },
  plantationCounter: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    textAlign: 'center',
  },
  currentName: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  phaseBlock: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  phaseCounter: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  barTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
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
