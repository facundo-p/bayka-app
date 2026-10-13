import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

export const AVISO_PUNTO_GPS_ICON_SIZE = 18;

export const avisoPuntoGpsStyles = StyleSheet.create({
  container: {
    position: 'absolute', left: spacing.xxl, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    minHeight: touchTarget.min, paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full, backgroundColor: colors.overlay,
  },
  text: { color: colors.white, fontSize: fontSize.sm, fontFamily: fonts.semiBold },
});
