import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

/** Alto de la lista: unas cinco opciones; el resto se ve scrolleando. */
const ALTO_LISTA = touchTarget.min * 6;

export const selectorDeEspecieStyles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  input: {
    flex: 1,
    minHeight: touchTarget.min,
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  lista: { maxHeight: ALTO_LISTA },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  opcionPresionada: { backgroundColor: colors.surfacePressed },
  opcionActual: { backgroundColor: colors.plantationBg },
  opcionTexto: { flex: 1 },
  nombre: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.textPrimary },
  cientifico: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.textSecondary, fontStyle: 'italic' },
  actual: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actualTexto: { fontSize: fontSize.sm, fontFamily: fonts.semiBold, color: colors.plantationDark },
  vacio: {
    padding: spacing.xl,
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  cancelar: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget.min,
  },
  cancelarTexto: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.textSecondary },
});
