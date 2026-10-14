import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const TAMANO_ICONO_OPCION = 22;

export const treeConfigModalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { flex: 1 },
  // Con la sección de la botonera y la letra de Android grande, la hoja puede no entrar: scrollea.
  card: {
    backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.round,
    borderTopRightRadius: borderRadius.round, maxHeight: '90%',
  },
  content: { padding: spacing['4xl'], gap: spacing.lg },
  title: { fontSize: fontSize.xxl, fontFamily: fonts.heading, color: colors.text, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xxl,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
  },
  optionInfo: { flex: 1, gap: spacing.xs },
  optionLabel: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.text },
  optionDesc: { fontSize: fontSize.sm, color: colors.textMuted },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.xl, marginTop: spacing.sm },
  cancelText: { fontSize: fontSize.base, color: colors.textMuted, fontFamily: fonts.medium },
});
