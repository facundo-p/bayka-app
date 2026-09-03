// Estilos de TreeListModal.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const treeListModalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xxl, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: fontSize.xxl, fontFamily: fonts.heading, color: colors.text },
  listContent: { padding: spacing.xl, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['6xl'], fontSize: fontSize.lg, fontFamily: fonts.regular },
});
