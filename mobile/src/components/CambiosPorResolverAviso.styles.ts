import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const cambiosPorResolverAvisoStyles = StyleSheet.create({
  aviso: {
    alignSelf: 'stretch',
    backgroundColor: colors.conflictoBg,
    borderWidth: 1,
    borderColor: colors.conflictoBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texto: { flex: 1, gap: spacing.xxs },
  nombre: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.conflictoText },
  detalle: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.conflictoText },
  boton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  botonTexto: { color: colors.white, fontFamily: fonts.semiBold, fontSize: fontSize.md },
});
