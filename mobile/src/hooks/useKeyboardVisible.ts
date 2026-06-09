import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Devuelve `true` mientras el teclado del SO está visible.
 *
 * Se usa para no sumar el inset inferior (safe-area de la nav bar) al footer
 * cuando el teclado está abierto: el teclado ya cubre esa zona, así que el inset
 * sólo crearía una franja de espacio sobrante encima del teclado. Issue #74/#73.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
