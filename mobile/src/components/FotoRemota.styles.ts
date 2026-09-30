import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

export const fotoRemotaStyles = StyleSheet.create({
  contenedor: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  /** Sobre el fondo negro del visor. */
  contenedorOscuro: {
    borderColor: colors.textSecondary,
    backgroundColor: 'transparent',
  },
  texto: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  textoOscuro: {
    color: colors.white,
  },
  error: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.danger,
    textAlign: 'center',
  },
  errorOscuro: {
    color: colors.dangerLight,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
  },
  botonTexto: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
});
