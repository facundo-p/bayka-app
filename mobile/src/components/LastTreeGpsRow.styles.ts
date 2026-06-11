import { StyleSheet } from 'react-native';
import { colors, fontSize, fonts, spacing, borderRadius } from '../theme';

export const lastTreeGpsRowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  accuracyText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  noPointText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.plantation,
  },
  buttonText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.plantation,
  },
});
