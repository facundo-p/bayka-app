// Estilos de PerfilScreen.
import { StyleSheet } from 'react-native';
import { colors, fontSize, borderRadius, spacing, fonts } from '../theme';

export const perfilScreenStyles = StyleSheet.create({
  innerContainer: {
    flex: 1,
    padding: spacing['4xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    padding: spacing['4xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatarText: {
    color: colors.white,
    fontSize: fontSize.heading,
    fontFamily: fonts.bold,
  },
  name: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginBottom: spacing.xxl,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginBottom: spacing.xxl,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.md,
  },
  profileLabel: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  profileValue: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
  },
  profileValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoutLink: {
    marginTop: spacing['5xl'],
    padding: spacing.xl,
  },
  logoutLinkText: {
    color: colors.danger,
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
  },
});
