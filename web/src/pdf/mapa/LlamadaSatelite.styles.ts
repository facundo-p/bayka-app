import { StyleSheet } from '@react-pdf/renderer';
import { COLOR_PDF, TAMANO_TEXTO } from '../plantilla/tokens';

export const llamadaSateliteStyles = StyleSheet.create({
  llamada: { fontSize: TAMANO_TEXTO.llamada, color: COLOR_PDF.tenue, textAlign: 'right' },
});
