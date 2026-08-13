import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const syncConfirmModalStyles = StyleSheet.create({
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
  },
  pendingInfo: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  checkboxContainer: {
    width: '100%',
    paddingVertical: spacing.md,
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.md,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  confirmBtnPressed: {
    opacity: 0.8,
  },
  confirmBtnText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  cancelBtn: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnPressed: {
    opacity: 0.8,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
});
