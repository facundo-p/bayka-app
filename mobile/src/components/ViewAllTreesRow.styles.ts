import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const viewAllTreesRowStyles = StyleSheet.create({
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.plantationBg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  viewAllRowPressed: {
    opacity: 0.7,
  },
  viewAllText: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: fonts.semiBold,
    color: colors.plantation,
  },
  viewAllTextDisabled: {
    color: colors.textLight,
  },
});
