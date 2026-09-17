/**
 * TexturedBackground — wraps children with the leaf texture background + overlay.
 * Single source of truth for the texture pattern used across screens.
 */
import { ViewStyle } from 'react-native';
import { ImageBackground, View } from 'react-native';
import { texturedBackgroundStyles as styles } from './TexturedBackground.styles';

const cardTexture = require('../../assets/images/card-texture-default.jpg');

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function TexturedBackground({ children, style }: Props) {
  return (
    <ImageBackground source={cardTexture} style={[styles.container, style]} resizeMode="cover">
      <View style={styles.overlay} />
      {children}
    </ImageBackground>
  );
}
