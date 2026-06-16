import { StyleSheet } from 'react-native';
import { colors, fontSize, fonts, spacing, borderRadius } from '../theme';

export const gpsSignalIndicatorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.round,
  },
  label: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
});
