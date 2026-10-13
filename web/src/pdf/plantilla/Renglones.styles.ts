import { StyleSheet } from '@react-pdf/renderer';
import { CORTAR_TEXTO_LARGO } from './textoLargo';
import { UN_RENGLON } from './tokens';

/**
 * Cortado, el renglón no pasa de uno aunque la medida erre. Entero, va sin
 * tope: si la medida erra, textkit suma un renglón en vez de perder texto.
 */
export const renglonesStyles = StyleSheet.create({
  renglon: CORTAR_TEXTO_LARGO ? UN_RENGLON : {},
});
