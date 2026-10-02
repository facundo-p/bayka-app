import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const ordenArbolesToggleStyles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.primaryBorder,
    backgroundColor: colors.surface,
  },
  label: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: fontSize.base },
});
