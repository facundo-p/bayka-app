import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const cameraCaptureStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.overlayDark },
  camera: { flex: 1, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing['4xl'], backgroundColor: colors.overlayDark },
  permText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.regular, textAlign: 'center' },
  permBtn: { backgroundColor: colors.plantation, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: borderRadius.lg },
  permBtnText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  cancelLink: { color: colors.white, fontSize: fontSize.sm, fontFamily: fonts.medium, opacity: 0.85, marginTop: spacing.md },
  closeBtn: { position: 'absolute', right: spacing.xxl, padding: spacing.md, zIndex: 10 },
  shutterBar: { alignItems: 'center', paddingTop: spacing.xl },
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 4, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.white },
});
