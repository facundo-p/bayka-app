// Estilos de FilterCards.
import { StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius, fonts } from '../theme';

export const filterCardsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  count: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
  },
  label: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
});
