/** Marco cuadrado con lo de afuera oscurecido: el del visor de la cámara y el del recorte (#831). */
import { View, type GestureResponderHandlers } from 'react-native';
import { maskRects, rectToLayout, type Rect, type Size } from '../utils/cropGeometry';
import { cropMaskStyles as styles } from './CropMask.styles';

interface Props {
  box: Rect;
  stage: Size;
  /** Sin handlers el marco no captura toques. */
  frameHandlers?: GestureResponderHandlers;
}

export default function CropMask({ box, stage, frameHandlers }: Props) {
  return (
    <>
      {maskRects(box, stage).map((rect, i) => (
        <View key={i} pointerEvents="none" style={[styles.dim, rectToLayout(rect)]} />
      ))}
      <View
        testID="crop-frame"
        pointerEvents={frameHandlers ? 'auto' : 'none'}
        {...frameHandlers}
        style={[styles.frame, rectToLayout(box)]}
      />
    </>
  );
}
