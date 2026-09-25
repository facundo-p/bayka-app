import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, iconSizes } from '../theme';

const RADIO = iconSizes.action;
const RADIO_PUNTO = spacing.md;

export const tarjetaDeConflictoStyles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.conflictoBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  titulo: {
    fontSize: fontSize.xl,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  opcion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    minHeight: 44,
  },
  opcionElegida: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxs,
  },
  radioElegido: {
    borderColor: colors.primary,
  },
  radioPunto: {
    width: RADIO_PUNTO,
    height: RADIO_PUNTO,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  opcionTexto: {
    flex: 1,
    gap: spacing.xxs,
  },
  origen: {
    fontSize: fontSize.xs,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  valor: {
    fontSize: fontSize.base,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  anterior: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
