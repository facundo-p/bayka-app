/**
 * Styles for ParcelaFormModal — full-screen modal (D-17-01).
 * Tokens from theme.ts (CLAUDE.md §8).
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const parcelaFormModalStyles = StyleSheet.create({
  flex: { flex: 1 },
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.plantationHeaderBg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  headerTitle: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.white,
    flex: 1,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.xxxl,
    paddingBottom: spacing['6xl'],
  },
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
  footer: {
    flexDirection: 'row',
    gap: spacing.xl,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.button,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.lg,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: spacing.button,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  submitBtnDisabled: {
    backgroundColor: colors.primaryFaded,
  },
  submitText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
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
