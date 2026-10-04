import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

export const seccionEspecieStyles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.plantation,
    backgroundColor: colors.surface,
  },
  botonTexto: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.plantation },
  // Grisado pero tocable: el toque explica que hay que reabrir el grupo.
  botonGrisado: { borderColor: colors.disabled },
  botonTextoGrisado: { color: colors.textDisabled },
});
