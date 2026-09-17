import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const loginScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['5xl'],
    paddingVertical: spacing['6xl'],
  },
  logoImage: {
    width: 180,
    height: 80,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSubtle,
    marginBottom: spacing['5xl'],
  },
  input: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xxl,
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginBottom: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
  },
  passwordWrapper: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xxl,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.xxl,
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  eyeButton: {
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
    marginBottom: spacing.xl,
    alignSelf: 'flex-start',
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontFamily: fonts.semiBold,
  },
  fullWidth: {
    width: '100%',
  },
  logoGroup: {
    alignItems: 'center',
  },
  accountsSection: {
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing['4xl'],
    marginBottom: spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    paddingHorizontal: spacing.xl,
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  accountChip: {
    backgroundColor: colors.surfacePressed,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountChipActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  accountChipText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.regular,
    color: colors.textMedium,
  },
  accountChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
});
