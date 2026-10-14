import { StyleSheet } from 'react-native';
import { colors, fontSize, borderRadius, spacing, fonts, touchTarget } from '../theme';

export const settingsScreenStyles = StyleSheet.create({
  innerContainer: {
    flexGrow: 1,
    padding: spacing['4xl'],
    gap: spacing['4xl'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    padding: spacing['4xl'],
    width: '100%',
    maxWidth: 360,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  /** Rótulo del grupo de ajustes; la conexión queda fuera porque es estado. */
  grupoTitulo: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.md,
  },
  sectionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  /** Rótulo con descripción debajo: se achica para dejarle lugar al switch. */
  sectionTextWrap: {
    flex: 1,
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  hint: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  liberarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  liberarButtonDisabled: {
    opacity: 0.5,
  },
  liberarButtonText: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  gpsDiagnostic: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  gpsDisabledHint: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  enableButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: spacing.xxl,
  },
  statusText: {
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
  },
});
