import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const plantationFormModalStyles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  switchLabels: {
    flex: 1,
  },
  switchLabel: {
    fontSize: fontSize.md,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  switchHelper: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.dangerText,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
