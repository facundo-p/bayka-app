// Estilos de CatalogPlantationCard.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const catalogPlantationCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  checkboxArea: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxEmpty: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderMuted,
  },
  content: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textHeading,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.md,
    columnGap: spacing.xxl,
    rowGap: spacing.xs,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  estadoChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  estadoText: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
  },
  deleteButton: {
    padding: spacing.sm,
  },
});
