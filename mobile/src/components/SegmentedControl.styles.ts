// Estilos de SegmentedControl.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

export const segmentedControlStyles = StyleSheet.create({
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
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
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: colors.white,
  },
});
