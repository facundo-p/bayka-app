import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const plantationFormModalStyles = StyleSheet.create({
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.dangerText,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
