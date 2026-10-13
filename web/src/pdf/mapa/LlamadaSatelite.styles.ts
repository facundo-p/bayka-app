import { StyleSheet } from '@react-pdf/renderer';
import { COLOR_PDF, MEDIDA_PDF, TAMANO_TEXTO } from '../plantilla/tokens';

/** Absoluta y con interlineado justo, en el aire bajo el mapa: no suma alto. */
export const llamadaSateliteStyles = StyleSheet.create({
  llamada: {
    position: 'absolute',
    right: 0,
    lineHeight: MEDIDA_PDF.interlineadoLlamada,
    fontSize: TAMANO_TEXTO.llamada,
    color: COLOR_PDF.tenue,
    textAlign: 'right',
  },
});
