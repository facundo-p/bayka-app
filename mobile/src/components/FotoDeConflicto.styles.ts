import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

/** Cuadrada como las fotos (#831). */
const MINIATURA_LADO = 120;

export const fotoDeConflictoStyles = StyleSheet.create({
  miniatura: {
    width: MINIATURA_LADO,
    height: MINIATURA_LADO,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  marcador: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderMuted,
  },
  marcadorTexto: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
