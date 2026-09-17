import { StyleSheet } from 'react-native';
import { colors } from '../theme';

export const screenContainerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
});
