import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const grupoDeAvisoStyles = StyleSheet.create({
  item: {
    alignSelf: 'stretch',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  titulo: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  nombre: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  explicacion: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
