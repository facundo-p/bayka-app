import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const resolverCambiosScreenStyles = StyleSheet.create({
  lista: { flex: 1 },
  listaContenido: { padding: spacing.xxl, gap: spacing.xl },
  nota: {
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  seccion: { gap: spacing.lg },
  encabezado: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.md },
  seccionTitulo: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.textHeading },
  seccionSub: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.textSecondary },
  error: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.danger,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
  },
  pie: {
    flexDirection: 'row',
    gap: spacing.xl,
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['5xl'], gap: spacing['4xl'] },
  vacioTexto: { fontSize: fontSize.xl, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },
  volver: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  volverTexto: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.lg },
});
