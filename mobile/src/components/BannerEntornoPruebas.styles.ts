import { StyleSheet } from 'react-native';
import { colors, fontSize, fonts, spacing } from '../theme';

export const bannerEntornoPruebasStyles = StyleSheet.create({
  // El paddingTop (inset de la status bar) lo aplica el componente.
  franja: {
    backgroundColor: colors.entornoPruebasBg,
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  texto: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.xs,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
});
