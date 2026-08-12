import { StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fonts, borderRadius } from '../theme';

export const adminBottomSheetStyles = StyleSheet.create({
  outerWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xxl,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderMuted,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing['4xl'],
    right: spacing.xxl,
    padding: spacing.md,
    zIndex: 1,
  },
  header: {
    marginBottom: spacing.xxl,
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textHeading,
  },
  headerSubtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondaryBg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xxl,
  },
  pendingBadgeText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    flex: 1,
    fontFamily: fonts.regular,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  discardBtnText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontFamily: fonts.regular,
  },
  actionList: {
    gap: spacing.xxl,
  },
  actionItem: {
    height: 48,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionItemDisabled: {
    opacity: 0.4,
  },
  actionItemText: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  helperText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    fontFamily: fonts.regular,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
  },
  lockedText: {
    color: colors.stateFinalizada,
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
  },
});
