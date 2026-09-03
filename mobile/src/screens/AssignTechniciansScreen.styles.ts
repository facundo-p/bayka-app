// Estilos de AssignTechniciansScreen.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const assignTechniciansScreenStyles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl, backgroundColor: colors.background },
  loadingText: { fontSize: fontSize.base, color: colors.textMuted, fontFamily: fonts.regular },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl, padding: spacing['4xl'], backgroundColor: colors.background },
  errorTitle: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.text },
  errorText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center', lineHeight: 20, fontFamily: fonts.regular },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing['4xl'], marginTop: spacing.md },
  retryButtonText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  listContent: { padding: spacing.xxl, paddingBottom: spacing.xxl },
  listHeader: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.xxl, fontFamily: fonts.medium },
  emptyContainer: { alignItems: 'center', gap: spacing.xl, paddingTop: spacing['5xl'] },
  emptyText: { fontSize: fontSize.base, color: colors.textMuted, textAlign: 'center', fontFamily: fonts.regular },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xl },
  rowAssigned: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryBgLight },
  rowInfo: { flex: 1, gap: spacing.xs },
  rowName: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.text },
  rowNameMuted: { color: colors.textMuted },
  rowRole: { fontSize: fontSize.sm, color: colors.textMuted, fontFamily: fonts.regular },
  footer: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, gap: spacing.sm },
  saveButtonText: { color: colors.white, fontSize: fontSize.lg, fontFamily: fonts.semiBold },
});
