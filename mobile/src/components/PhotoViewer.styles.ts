import { StyleSheet, Dimensions } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const photoViewerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: spacing.xxl,
    zIndex: 10,
    padding: spacing.md,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingBottom: spacing['6xl'],
    paddingTop: spacing.xl,
  },
  actionBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  actionText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
});
