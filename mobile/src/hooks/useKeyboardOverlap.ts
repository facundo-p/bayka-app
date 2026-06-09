import { useEffect, useState } from 'react';
import { Dimensions, Keyboard } from 'react-native';

/**
 * Cuánto cubre el teclado desde el borde inferior de la pantalla, en dp
 * (0 cuando está cerrado).
 *
 * NO usamos `endCoordinates.height`: en edge-to-edge (Android, Expo SDK 54+) el
 * teclado se dibuja por encima de la nav bar, pero `height` excluye ese inset
 * inferior, así que sub-reporta y los controles quedan parcialmente tapados.
 * `endCoordinates.screenY` (borde superior del teclado) sí es exacto, así que la
 * cobertura real es `alto_de_ventana − screenY` — ambos medidos por dispositivo,
 * sin constantes. Vuelve a 0 en `keyboardDidHide`, por lo que el layout se
 * restaura siempre (sin franja residual). Dentro de un `Modal` (ventana Dialog
 * en Android) este listener JS es el único que reporta el teclado: el inset IME
 * nativo (reanimated) no atraviesa el Dialog y la ventana no se redimensiona.
 */
export function useKeyboardOverlap(): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const windowHeight = Dimensions.get('window').height;
      setOverlap(Math.max(0, windowHeight - e.endCoordinates.screenY));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return overlap;
}
