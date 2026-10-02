import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

export const avisoDeConflictoDeEspecieStyles = StyleSheet.create({
  conflicto: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.conflictoBorder,
    backgroundColor: colors.conflictoBg,
  },
  conflictoTexto: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.conflictoText },
  conflictoAcciones: { gap: spacing.md },
  conflictoBoton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.conflictoBorder,
    backgroundColor: colors.surface,
  },
  conflictoBotonTexto: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.conflictoText },
});
