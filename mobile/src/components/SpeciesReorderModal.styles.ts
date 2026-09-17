// Estilos de SpeciesReorderModal.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const speciesReorderModalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing['4xl'], paddingBottom: spacing.lg, gap: spacing.xs },
  title: { fontSize: fontSize.xxl, fontFamily: fonts.heading, color: colors.text },
  hint: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic', fontFamily: fonts.regular },
  footer: {
    flexDirection: 'row', gap: spacing.xl, padding: spacing.xxl,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { color: colors.textMuted, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.xl, borderRadius: borderRadius.lg,
    backgroundColor: colors.plantationHeaderBg, gap: spacing.sm,
  },
  saveText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
});
