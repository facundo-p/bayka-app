import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const campoFechaStyles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  valor: {
    flex: 1,
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  placeholder: {
    color: colors.textLight,
  },
});
