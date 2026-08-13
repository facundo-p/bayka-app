import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const plantationConfigCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  editIconBtn: {
    padding: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textFaint,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  actionBtnSecondary: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  actionBtnSecondaryText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  actionBtnDanger: {
    backgroundColor: colors.danger,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnDangerText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  infoNoteText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    fontFamily: fonts.regular,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
  },
  lockedText: {
    color: colors.stateFinalizada,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  pendingSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.stateFinalizada,
    borderRadius: borderRadius.full,
  },
  pendingSyncText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontFamily: fonts.semiBold,
  },
});
