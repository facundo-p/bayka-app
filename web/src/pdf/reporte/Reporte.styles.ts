import { StyleSheet } from '@react-pdf/renderer';
import { recuadroVacio } from '../arbol/PartesArbol.styles';
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

const mayusculas = {
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

/**
 * La letra de los renglones que se cortan antes del render (#876): la usan
 * estos estilos y la medición, así no se desfasan.
 */
export const LETRA_REPORTE = {
  fila: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.filaListado,
  },
  dato: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.dato,
  },
  especieTarjeta: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.semibold,
    fontSize: TAMANO_TEXTO.especie,
  },
  codigo: {
    fontFamily: FUENTE_PDF.mono,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.datoMono,
  },
} as const;

const mono = LETRA_REPORTE.codigo;

/** Lo que la tarjeta y la fila del listado pintan igual. */
const deArbol = {
  punto: {
    width: M.punto,
    height: M.punto,
    borderRadius: M.punto / 2,
    marginRight: M.aireTrasPunto,
  },
  codigo: { ...mono, color: COLOR_PDF.navy },
  mono,
} as const;

export const tarjetaStyles = StyleSheet.create({
  ...deArbol,
  grilla: { rowGap: M.separacion },
  fila: { flexDirection: 'row', columnGap: M.separacion },
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
  vacio: { ...recuadroFoto, ...recuadroVacio, borderWidth: M.borde },
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
  filaEspecie: {
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoEspecie + M.aireEspecie,
    paddingBottom: M.aireEspecie,
    marginBottom: M.aireEspecie,
    borderBottomWidth: M.borde,
    borderBottomColor: COLOR_PDF.linea,
  },
  nombreEspecie: {
    ...renglon,
    ...interlineado,
    ...LETRA_REPORTE.especieTarjeta,
    flex: 1,
    color: COLOR_PDF.tinta,
  },
  dato: { flexDirection: 'row', alignItems: 'center', height: M.altoDato },
  rotulo: { ...mayusculas, ...renglon, width: M.anchoEtiqueta, paddingTop: M.aireSobreEtiqueta },
  valor: {
    ...renglon,
    ...interlineado,
    ...LETRA_REPORTE.dato,
    flex: 1,
    color: COLOR_PDF.tinta,
  },
});

export const listadoStyles = StyleSheet.create({
  ...deArbol,
  encabezado: {
    ...mayusculas,
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoEncabezadoListado,
    borderBottomWidth: M.borde,
    borderBottomColor: COLOR_PDF.oliva,
  },
  fila: {
    ...interlineado,
    ...LETRA_REPORTE.fila,
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoFilaListado,
    color: COLOR_PDF.tinta,
    borderBottomWidth: M.bordeFino,
    borderBottomColor: COLOR_PDF.linea,
  },
  sombreada: { backgroundColor: COLOR_PDF.papelHundido },
  idArbol: { fontFamily: FUENTE_PDF.mono, color: COLOR_PDF.navy },
  filaEspecie: {
    ...columna(M.pesoColumna.especie),
    flexDirection: 'row',
    alignItems: 'center',
  },
  nombreEspecie: { ...renglon, flex: 1 },
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
