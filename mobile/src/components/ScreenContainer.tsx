/**
 * ScreenContainer — consistent flex container wrapper for all screens.
 *
 * No paddingBottom: all screens live inside the Tabs navigator, whose tab
 * bar already handles the bottom safe-area inset.
 */
import { View, ViewStyle } from 'react-native';
import TexturedBackground from './TexturedBackground';
import { screenContainerStyles as styles } from './ScreenContainer.styles';

type Props = {
  children: React.ReactNode;
  /** Render with the leaf-texture background (default: false) */
  withTexture?: boolean;
  /** Extra styles applied to the container (e.g. backgroundColor) */
  style?: ViewStyle;
};

export default function ScreenContainer({ children, withTexture = false, style }: Props) {
  const content = (
    <View style={[styles.container, withTexture && styles.transparent, style]}>
      {children}
    </View>
  );

  if (withTexture) {
    return <TexturedBackground>{content}</TexturedBackground>;
  }

  return content;
}

