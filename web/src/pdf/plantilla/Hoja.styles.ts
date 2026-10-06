import { StyleSheet } from '@react-pdf/renderer';
import { COLOR_PDF, FUENTE_PDF, MEDIDA_HOJA, PESO_FUENTE, TAMANO_TEXTO } from './tokens';

const { margenSuperior, margenInferior, margenLateral } = MEDIDA_HOJA;

/**
 * Encabezado y pie van fijos y absolutos: el margen de la página les reserva el
 * lugar en todas las hojas. Sin `lineHeight` en la página: heredado, se vuelve
 * absoluto, y además react-pdf deja de dibujar el número de página.
 */
export const hojaStyles = StyleSheet.create({
  pagina: {
    paddingTop: margenSuperior + MEDIDA_HOJA.reservaEncabezado,
    paddingBottom: margenInferior + MEDIDA_HOJA.reservaPie,
    paddingHorizontal: margenLateral,
    backgroundColor: COLOR_PDF.papel,
    color: COLOR_PDF.cuerpo,
    fontFamily: FUENTE_PDF.cuerpo,
    fontSize: TAMANO_TEXTO.dato,
  },
  encabezado: {
    position: 'absolute',
    top: margenSuperior,
    left: margenLateral,
    right: margenLateral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: MEDIDA_HOJA.aireFilete,
    borderBottomWidth: MEDIDA_HOJA.fileteEncabezado,
    borderBottomColor: COLOR_PDF.oliva,
  },
  logo: { height: MEDIDA_HOJA.altoLogo },
  plantacion: { alignItems: 'flex-end', maxWidth: '70%' },
  titulo: {
    fontFamily: FUENTE_PDF.titulo,
    fontWeight: PESO_FUENTE.bold,
    fontSize: TAMANO_TEXTO.encabezado,
    color: COLOR_PDF.navy,
    lineHeight: 1.2,
  },
  detalle: { fontSize: TAMANO_TEXTO.pieMarca, color: COLOR_PDF.apagado },
  pie: {
    position: 'absolute',
    bottom: margenInferior,
    left: margenLateral,
    right: margenLateral,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: MEDIDA_HOJA.airePie,
    borderTopWidth: MEDIDA_HOJA.filetePie,
    borderTopColor: COLOR_PDF.linea,
    fontSize: TAMANO_TEXTO.pie,
    color: COLOR_PDF.tenue,
  },
  pieMarca: {
    fontFamily: FUENTE_PDF.titulo,
    fontWeight: PESO_FUENTE.bold,
    fontSize: TAMANO_TEXTO.pieMarca,
    color: COLOR_PDF.navy,
  },
});
