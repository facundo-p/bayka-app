import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const modalHeaderStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.plantationHeaderBg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  headerTitle: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.white,
    flex: 1,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
