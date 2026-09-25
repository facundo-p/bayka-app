/**
 * Styles for PendientesVaradosAviso: mismos tokens que el chip "Cambios por resolver".
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const pendientesVaradosAvisoStyles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.conflictoBg,
    borderWidth: 1,
    borderColor: colors.conflictoBorder,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  icono: {
    marginTop: spacing.xxs,
  },
  textos: {
    flex: 1,
    gap: spacing.xs,
  },
  titulo: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
    color: colors.conflictoText,
  },
  motivo: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.conflictoText,
  },
  descartar: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.conflictoText,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  descartarPresionado: {
    opacity: 0.6,
  },
  descartarTexto: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
    color: colors.conflictoText,
  },
});
