// Estilos de ConfirmModal.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const confirmModalStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing['5xl'],
    maxWidth: 340,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['4xl'],
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl + 2,
    borderRadius: borderRadius.lg,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonCancel: {
    backgroundColor: colors.background,
  },
  buttonText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  buttonTextCancel: {
    color: colors.textMuted,
  },
});
