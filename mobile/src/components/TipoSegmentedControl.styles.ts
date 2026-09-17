// Estilos de TipoSegmentedControl.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

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
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  segmentLabelActive: {
    color: colors.white,
  },
});
