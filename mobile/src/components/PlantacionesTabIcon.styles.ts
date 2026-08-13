import { StyleSheet } from 'react-native';
import { colors, fontSize, fonts } from '../theme';

export const plantacionesTabIconStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.secondary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: fontSize.xxs,
    fontFamily: fonts.bold,
  },
});
