/**
 * TexturedBackground — wraps children with the leaf texture background + overlay.
 * Single source of truth for the texture pattern used across screens.
 */
import { StyleSheet } from 'react-native';
import { ImageBackground, View } from 'react-native';

const cardTexture = require('../../assets/images/card-texture-default.jpg');

const OVERLAY_COLOR = 'rgba(250,250,249,0.9)';

type Props = {
  children: React.ReactNode;
};

export default function TexturedBackground({ children }: Props) {
  return (
    <ImageBackground source={cardTexture} style={styles.container} resizeMode="cover">
      <View style={styles.overlay} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_COLOR,
  },
});
