// Estilos de ConfigureSpeciesScreen.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const configureSpeciesScreenStyles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl, backgroundColor: colors.background },
  loadingText: { fontSize: fontSize.base, color: colors.textMuted, fontFamily: fonts.regular },
  listContent: { padding: spacing.xxl, paddingBottom: spacing.xxl },
  listHeaderContainer: { marginBottom: spacing.xxl, gap: spacing.xl },
  listHeader: { fontSize: fontSize.sm, color: colors.textMuted, fontFamily: fonts.medium },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  selectAllText: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.text },
  checkbox: {
    width: 22, height: 22, borderRadius: borderRadius.sm, borderWidth: 2,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xl,
  },
  rowEnabled: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryBgLight },
  rowName: { flex: 1, fontSize: fontSize.base, color: colors.text, fontFamily: fonts.regular },
  rowNameDisabled: { color: colors.textMuted },
  rowCode: { fontSize: fontSize.sm, color: colors.textMuted, fontFamily: fonts.monospace },
  rowCodeBold: { fontFamily: fonts.bold, color: colors.text },
  footer: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, gap: spacing.sm },
  saveButtonText: { color: colors.white, fontSize: fontSize.lg, fontFamily: fonts.semiBold },
});
