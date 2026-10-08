import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

const MINIATURA_ANCHO = 132;
const MINIATURA_ALTO = 96;

export const fotoDeConflictoStyles = StyleSheet.create({
  miniatura: {
    width: MINIATURA_ANCHO,
    height: MINIATURA_ALTO,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  sinConexion: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderMuted,
  },
  sinConexionTexto: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  remota: {
    alignSelf: 'stretch',
    padding: spacing.xl,
  },
});
