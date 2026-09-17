import { StyleSheet } from 'react-native';
import { colors, fontSize, fonts, spacing, borderRadius } from '../theme';

/** Entran "Sin señal" y "± 99 m" sin que el pill cambie de ancho. */
const COMPACT_MIN_WIDTH = 80;

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
  compact: {
    minWidth: COMPACT_MIN_WIDTH,
    justifyContent: 'center',
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
