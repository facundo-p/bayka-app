import { StyleSheet } from '@react-pdf/renderer';
import {
  CAJA_TARJETA,
  COLOR_PDF,
  FUENTE_PDF,
  LADO_FOTO_TARJETA,
  MEDIDA_REPORTE as M,
  PESO_FUENTE,
  TAMANO_TEXTO,
} from '../plantilla/tokens';

/** Un renglón de alto fijo: lo que no entra termina en «…» y no empuja la hoja. */
const renglon = { maxLines: 1, textOverflow: 'ellipsis' } as const;

/**
 * Va junto al `fontSize`: react-pdf multiplica el interlineado por el tamaño del
 * mismo estilo, y sin él usa 18 pt y el renglón no entra en su caja.
 */
const interlineado = { lineHeight: M.interlineado } as const;

const rotulo = {
  ...interlineado,
  fontSize: TAMANO_TEXTO.etiqueta,
  color: COLOR_PDF.apagado,
  textTransform: 'uppercase',
  letterSpacing: M.espaciadoMayusculas,
} as const;

const recuadroFoto = {
  width: LADO_FOTO_TARJETA,
  height: LADO_FOTO_TARJETA,
  borderRadius: M.radioFoto,
} as const;

const celda = { ...renglon, flexBasis: 0, paddingHorizontal: M.rellenoCelda } as const;

const columna = (peso: number) => ({ ...celda, flexGrow: peso });

export const reporteStyles = StyleSheet.create({
  grilla: { rowGap: M.separacion },
  filaTarjetas: { flexDirection: 'row', columnGap: M.separacion },
  tarjeta: {
    flexDirection: 'row',
    width: CAJA_TARJETA.ancho,
    height: CAJA_TARJETA.alto,
    padding: M.rellenoTarjeta,
    borderWidth: M.borde,
    borderColor: COLOR_PDF.linea,
    borderRadius: M.radio,
  },
  foto: { ...recuadroFoto, objectFit: 'cover' },
  fotoVacia: {
    ...recuadroFoto,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: M.borde,
    borderStyle: 'dashed',
    borderColor: COLOR_PDF.linea,
    backgroundColor: COLOR_PDF.papelHundido,
  },
  textoVacio: { fontSize: TAMANO_TEXTO.secundario, color: COLOR_PDF.tenue },
  datos: { flex: 1, marginLeft: M.aireFoto },
  idArbol: {
    ...renglon,
    ...interlineado,
    height: M.altoIdArbol,
    fontFamily: FUENTE_PDF.mono,
    fontWeight: PESO_FUENTE.medio,
    fontSize: TAMANO_TEXTO.idTarjeta,
    color: COLOR_PDF.navy,
  },
  especie: {
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoEspecie + M.aireEspecie,
    paddingBottom: M.aireEspecie,
    marginBottom: M.aireEspecie,
    borderBottomWidth: M.borde,
    borderBottomColor: COLOR_PDF.linea,
  },
  punto: {
    width: M.punto,
    height: M.punto,
    borderRadius: M.punto / 2,
    marginRight: M.aireTrasPunto,
  },
  nombreEspecie: {
    ...renglon,
    ...interlineado,
    flex: 1,
    fontWeight: PESO_FUENTE.semibold,
    fontSize: TAMANO_TEXTO.especie,
    color: COLOR_PDF.tinta,
  },
  sinIdentificar: { color: COLOR_PDF.ambarTexto },
  dato: { flexDirection: 'row', alignItems: 'center', height: M.altoDato },
  etiqueta: { ...rotulo, ...renglon, width: M.anchoEtiqueta, paddingTop: M.aireSobreEtiqueta },
  valor: {
    ...renglon,
    ...interlineado,
    flex: 1,
    fontSize: TAMANO_TEXTO.dato,
    color: COLOR_PDF.tinta,
  },
  codigo: { fontFamily: FUENTE_PDF.mono, fontSize: TAMANO_TEXTO.datoMono, color: COLOR_PDF.navy },
  mono: { fontFamily: FUENTE_PDF.mono, fontSize: TAMANO_TEXTO.datoMono },
  apagado: { color: COLOR_PDF.apagado },

  encabezadoListado: {
    ...rotulo,
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoEncabezadoListado,
    borderBottomWidth: M.borde,
    borderBottomColor: COLOR_PDF.oliva,
  },
  filaListado: {
    ...interlineado,
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoFilaListado,
    fontSize: TAMANO_TEXTO.filaListado,
    color: COLOR_PDF.tinta,
    borderBottomWidth: M.bordeFino,
    borderBottomColor: COLOR_PDF.linea,
  },
  filaSombreada: { backgroundColor: COLOR_PDF.papelHundido },
  idListado: { fontFamily: FUENTE_PDF.mono, color: COLOR_PDF.navy },
  celdaEspecie: {
    ...columna(M.pesoColumna.especie),
    flexDirection: 'row',
    alignItems: 'center',
  },
  textoEspecie: { ...renglon, flex: 1 },
  centrado: { textAlign: 'center' },
});

/** Mismo ancho para el encabezado y para las celdas de cada columna. */
export const columnaListadoStyles = StyleSheet.create({
  idArbol: columna(M.pesoColumna.idArbol),
  especie: columna(M.pesoColumna.especie),
  parcela: columna(M.pesoColumna.parcela),
  grupo: columna(M.pesoColumna.grupo),
  posicion: columna(M.pesoColumna.posicion),
  registrado: columna(M.pesoColumna.registrado),
  gps: columna(M.pesoColumna.gps),
});
