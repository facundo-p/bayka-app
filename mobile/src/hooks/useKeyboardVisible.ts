import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Altura del teclado del SO (0 cuando está cerrado).
 *
 * Se usa para empujar el contenido hacia arriba de forma determinística
 * (paddingBottom = altura) en vez de `KeyboardAvoidingView`, que con la New
 * Architecture (Fabric) deja una franja residual al cerrarse porque no restaura
 * su altura. Como esto vuelve a 0 en `keyboardDidHide`, el layout se restaura
 * siempre. Issue #73/#74 (feedback PR #83).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Devuelve `true` mientras el teclado del SO está visible. Se usa para no sumar
 * el inset inferior (safe-area de la nav bar) al footer cuando el teclado está
 * abierto: el teclado ya cubre esa zona. Issue #74/#73.
 */
export function useKeyboardVisible(): boolean {
  return useKeyboardHeight() > 0;
}
