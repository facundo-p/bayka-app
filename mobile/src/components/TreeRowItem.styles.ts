import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const treeRowItemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  pos: { fontSize: fontSize.base, fontFamily: fonts.bold, color: colors.textMedium, width: 26, textAlign: 'center' },
  name: { fontSize: fontSize.md, fontFamily: fonts.semiBold, color: colors.plantation, flex: 1 },
  nameNN: { color: colors.secondary },
  code: { fontSize: fontSize.sm, color: colors.textSecondary, fontFamily: fonts.monospace, minWidth: 40 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: { padding: spacing.xs },
  gpsPin: { padding: spacing.xs },
  syncDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.photoUnsyncDot,
  },
});
