/**
 * ScreenContainer — consistent container wrapper for all screens.
 *
 * All screens in this app live inside the Tabs navigator, whose tab bar
 * already handles the bottom safe-area inset. This component therefore
 * does NOT add paddingBottom — it only provides a consistent flex container
 * and optionally the textured background used on dashboard-style screens.
 */
import { View, ViewStyle, StyleSheet } from 'react-native';
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
  const content = (
    <View style={[styles.container, style]}>
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
