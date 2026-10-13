/**
 * Qué hacen los PDF con un texto del usuario que no entra en el ancho de su
 * caja, como el nombre de una parcela:
 * - `false`: sale entero, partido por palabra en los renglones que haga falta,
 *   y la fila o la tarjeta crece.
 * - `true`: se corta en un renglón con «…», y el alto no cambia.
 */
export const CORTAR_TEXTO_LARGO = false;
