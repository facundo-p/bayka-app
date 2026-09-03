import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const parcelasScreenStyles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: {
    padding: spacing.xxl,
    paddingBottom: spacing['6xl'],
    gap: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    gap: spacing.xxl,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.plantationBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.textHeading,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    marginTop: spacing.xxl,
    backgroundColor: colors.primary,
    paddingVertical: spacing.button,
    paddingHorizontal: spacing['5xl'],
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  emptyCtaText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
  },
});
