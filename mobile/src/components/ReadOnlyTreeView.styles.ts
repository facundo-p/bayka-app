import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const readOnlyTreeViewStyles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.plantationBg,
  },
  reactivateButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl, paddingVertical: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.plantation,
  },
  reactivateText: { color: colors.plantation, fontFamily: fonts.semiBold, fontSize: fontSize.base },
  listContent: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['6xl'], fontSize: fontSize.lg },
});
