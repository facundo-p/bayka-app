import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const avisoPlantacionDuplicadaStyles = StyleSheet.create({
  caja: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: -spacing.xl,
    marginBottom: spacing.xxxl,
    gap: spacing.xxs,
  },
  titulo: {
    fontSize: fontSize.md,
    fontFamily: fonts.semiBold,
    color: colors.warningText,
  },
  texto: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.warningText,
  },
});
