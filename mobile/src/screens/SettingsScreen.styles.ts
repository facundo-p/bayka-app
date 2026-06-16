import { StyleSheet } from 'react-native';
import { colors, fontSize, borderRadius, spacing, fonts } from '../theme';

export const settingsScreenStyles = StyleSheet.create({
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
    width: '100%',
    maxWidth: 360,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
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
