import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

export const CAMERA_ICON_SIZE = { close: 28, gallery: 26, permGallery: 20 } as const;

export const cameraCaptureStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.overlayDark },
  // flex-end: la barra del obturador (único hijo en flujo) va abajo; el botón
  // de cerrar es absoluto arriba. Con space-between quedaba arriba.
  camera: { flex: 1, justifyContent: 'flex-end' },
  frameOverlay: StyleSheet.absoluteFillObject,
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing['4xl'], backgroundColor: colors.overlayDark },
  permText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.regular, textAlign: 'center' },
  permBtn: {
    minHeight: touchTarget.min, justifyContent: 'center',
    backgroundColor: colors.plantation, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: borderRadius.lg,
  },
  permGalleryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: touchTarget.min, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.white,
  },
  permBtnText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  cancelLinkBtn: { minHeight: touchTarget.min, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  cancelLink: { color: colors.white, fontSize: fontSize.sm, fontFamily: fonts.medium, opacity: 0.85 },
  closeBtn: { position: 'absolute', right: spacing.xxl, padding: spacing.md, zIndex: 10 },
  skipBtn: {
    position: 'absolute', right: spacing.xxl, zIndex: 10,
    minHeight: touchTarget.min, justifyContent: 'center',
    paddingHorizontal: spacing.xxl, borderRadius: borderRadius.full, backgroundColor: colors.overlay,
  },
  skipBtnText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  shutterBar: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.xxl },
  // Los dos lados ocupan lo mismo: así el obturador queda centrado.
  shutterSide: { flex: 1, alignItems: 'flex-start' },
  galleryBtn: {
    alignItems: 'center', justifyContent: 'center', gap: spacing.xxs,
    minWidth: touchTarget.min, minHeight: touchTarget.min, padding: spacing.md,
  },
  galleryBtnText: { color: colors.white, fontSize: fontSize.sm, fontFamily: fonts.medium },
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 4, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.white },
});
