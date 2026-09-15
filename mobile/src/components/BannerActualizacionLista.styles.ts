import { StyleSheet } from 'react-native';
import { borderRadius, colors, fonts, fontSize, lineHeight, spacing } from '../theme';

export const bannerActualizacionListaStyles = StyleSheet.create({
  // El paddingBottom (inset de la barra de navegación) lo aplica el componente.
  franja: {
    backgroundColor: colors.infoBg,
    borderTopWidth: 1,
    borderTopColor: colors.info,
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
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
    minHeight: 44, // usable con guantes
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
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    minHeight: 44,
  },
  descartarTexto: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
  },
});
