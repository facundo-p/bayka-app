import { Dimensions, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHIP_GAP = 6;
const CHIP_PADDING = 8;
export const CHIP_WIDTH = (SCREEN_WIDTH - CHIP_PADDING * 2 - CHIP_GAP * 2) / 3;

export const lastThreeTreesStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: fonts.medium,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.recentBg,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.recentBorder,
    gap: spacing.sm,
    width: CHIP_WIDTH,
  },
  chipEmpty: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  chipLast: {
    backgroundColor: colors.recentBgActive,
    borderColor: colors.recentText,
    borderWidth: 2,
  },
  chipText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semiBold,
    color: colors.recentText,
  },
  chipTextLast: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
  },
  undoButton: {
    padding: spacing.xs,
  },
});
