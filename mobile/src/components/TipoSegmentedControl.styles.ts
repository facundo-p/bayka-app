// Estilos de TipoSegmentedControl.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const tipoSegmentedControlStyles = StyleSheet.create({
  field: {
    marginBottom: spacing.xxxl,
  },
  label: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.textMedium,
    marginBottom: spacing.sm,
  },
});
