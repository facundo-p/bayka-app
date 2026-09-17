import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const nnResolutionScreenStyles = StyleSheet.create({
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['5xl'] },
  emptyText: { fontSize: fontSize.xl, color: colors.textSecondary, marginBottom: spacing['4xl'], textAlign: 'center', fontFamily: fonts.regular },
  backButton: { backgroundColor: colors.primary, paddingHorizontal: spacing['4xl'], paddingVertical: spacing.xl, borderRadius: borderRadius.lg },
  backButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.lg },
  photo: { height: 260, backgroundColor: colors.border },
  scrollArea: { flex: 1 },
  scrollContent: { paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  loader: { marginVertical: spacing['4xl'] },
  fixedBottom: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  guardarButton: { backgroundColor: colors.primary, paddingVertical: spacing.xxl, borderRadius: borderRadius.lg, alignItems: 'center' },
  guardarButtonDisabled: { opacity: 0.5 },
  guardarButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.xl },
  conflictBanner: {
    backgroundColor: colors.dangerBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    padding: spacing.xxl,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  conflictTitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
    color: colors.danger,
  },
  conflictBody: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  conflictActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  conflictAcceptText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  conflictKeepText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  readOnlyLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
