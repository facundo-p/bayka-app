/**
 * ScreenContainer — consistent bottom safe area wrapper for all screens.
 *
 * Handles the system navigation bar / home indicator inset so individual
 * screens don't need to worry about it. Optionally renders with the
 * textured background used on dashboard-style screens.
 */
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TexturedBackground from './TexturedBackground';
import { colors } from '../theme';

type Props = {
  children: React.ReactNode;
  /** Render with the leaf-texture background (default: false) */
  withTexture?: boolean;
  /** Extra styles applied to the container (e.g. backgroundColor) */
  style?: ViewStyle;
};

export default function ScreenContainer({ children, withTexture = false, style }: Props) {
  const insets = useSafeAreaInsets();

  const content = (
    <View style={[styles.container, { paddingBottom: insets.bottom }, style]}>
      {children}
    </View>
  );

  if (withTexture) {
    return <TexturedBackground>{content}</TexturedBackground>;
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
