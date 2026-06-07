import { StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fonts } from '../theme';

export const spinnerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
});
