import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const speciesReorderListStyles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  dragRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
  },
  dragRowActive: {
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBgLight,
  },
  dragRowButton: {
    width: 40,
    height: 32,
    backgroundColor: colors.primaryBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragRowCode: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  dragRowName: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  dragRowOrder: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
  },
});
