import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

export const conflictosDelGrupoAvisoStyles = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.conflictoBg,
    borderWidth: 1,
    borderColor: colors.conflictoBorder,
    borderRadius: borderRadius.md,
  },
  texto: { flex: 1, fontSize: fontSize.md, fontFamily: fonts.regular, color: colors.conflictoText },
  boton: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  botonTexto: { color: colors.white, fontFamily: fonts.semiBold, fontSize: fontSize.md },
});
