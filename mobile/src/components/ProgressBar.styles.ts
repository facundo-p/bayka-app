import { StyleSheet } from 'react-native';
import { borderRadius, colors } from '../theme';

export const progressBarStyles = StyleSheet.create({
  track: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});
