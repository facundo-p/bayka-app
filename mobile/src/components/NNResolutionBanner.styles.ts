import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const nnResolutionBannerStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  bannerPressed: { opacity: 0.8 },
  text: { flex: 1, fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.secondary },
});
