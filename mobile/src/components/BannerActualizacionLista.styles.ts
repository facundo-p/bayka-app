import { StyleSheet } from 'react-native';
import { borderRadius, colors, fonts, fontSize, lineHeight, spacing } from '../theme';

export const bannerActualizacionListaStyles = StyleSheet.create({
  franja: {
    backgroundColor: colors.infoBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.info,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  texto: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
  },
  boton: {
    backgroundColor: colors.info,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  botonDeshabilitado: {
    backgroundColor: colors.primaryBgMuted,
  },
  botonTexto: {
    color: colors.surface,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.sm,
  },
  descartar: {
    paddingHorizontal: spacing.xs,
  },
  descartarTexto: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
  },
});
