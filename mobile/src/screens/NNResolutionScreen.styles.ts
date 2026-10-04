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
  readOnlyLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
