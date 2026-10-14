import { StyleSheet } from '@react-pdf/renderer';
import { COLOR_PDF, MEDIDA_PDF } from '../plantilla/tokens';

/** El recuadro de una foto o un mapa que falta; el tamaño lo pone cada documento. */
export const recuadroVacio = {
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: MEDIDA_PDF.borde,
  borderStyle: 'dashed',
  borderColor: COLOR_PDF.linea,
  backgroundColor: COLOR_PDF.papelHundido,
} as const;

/** Solo color: valen igual a cualquier tamaño de letra. */
export const partesArbolStyles = StyleSheet.create({
  sinIdentificar: { color: COLOR_PDF.ambarTexto },
  apagado: { color: COLOR_PDF.apagado },
});
