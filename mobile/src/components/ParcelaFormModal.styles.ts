/**
 * Styles for ParcelaFormModal — solo lo específico de Parcela (#89).
 * El chrome (header/footer/scroll) vive en EntityFormModal /
 * KeyboardAwareFormBody / FormActions. Tokens from theme.ts (CLAUDE.md §8).
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const parcelaFormModalStyles = StyleSheet.create({
  descripcionLabel: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.textMedium,
    marginBottom: spacing.sm,
  },
  descripcionInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.button,
    paddingVertical: spacing.xl,
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  descripcionCounter: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
  descripcionCounterWarn: {
    color: colors.dangerLight,
    fontFamily: fonts.semiBold,
  },
  descripcionWrap: {
    marginBottom: spacing.xxxl,
  },
  deleteBtn: {
    marginTop: spacing.xxl,
    paddingVertical: spacing.button,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.lg,
  },
});
