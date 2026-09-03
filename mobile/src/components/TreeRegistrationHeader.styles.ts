// Estilos de TreeRegistrationHeader.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const treeRegistrationHeaderStyles = StyleSheet.create({
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginLeft: spacing.md,
  },
  count: {
    color: colors.plantationCountFaded,
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
  },
  nnBadge: {
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.lg,
  },
  nnText: {
    color: colors.secondary,
    fontSize: fontSize.xs,
    fontFamily: fonts.bold,
  },
});
