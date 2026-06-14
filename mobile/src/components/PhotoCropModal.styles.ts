import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const HANDLE_SIZE = 28;

export const photoCropModalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.overlayDark },
  stage: { flex: 1 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.white,
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE * 2,
    height: HANDLE_SIZE * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.plantation,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    backgroundColor: colors.overlayDark,
    gap: spacing.md,
  },
  hint: { flex: 1, color: colors.white, fontSize: fontSize.xs, fontFamily: fonts.regular, textAlign: 'center', opacity: 0.85 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.md },
  cancelText: { color: colors.white, fontSize: fontSize.sm, fontFamily: fonts.medium },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.plantation,
  },
  saveText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
});
