import { StyleSheet } from '@react-pdf/renderer';
import { COLOR_PDF, TAMANO_TEXTO } from '../plantilla/tokens';

export const atribucionSateliteStyles = StyleSheet.create({
  texto: { fontSize: TAMANO_TEXTO.atribucion, color: COLOR_PDF.tenue, textAlign: 'right' },
});
