import { StyleSheet } from '@react-pdf/renderer';
import { recuadroVacio } from '../arbol/PartesArbol.styles';
import { puntoDeEspecie, rotuloEnMayusculas } from '../plantilla/comunes.styles';
import {
  aireCentrado,
  ALTO_RENGLON_REPORTE as ALTO,
  CAJA_TARJETA,
  COLOR_PDF,
  LADO_FOTO_TARJETA,
  LETRA_REPORTE,
  MEDIDA_REPORTE as M,
  TAMANO_TEXTO,
  UN_RENGLON,
} from '../plantilla/tokens';

/**
 * Los textos de formato fijo: rótulo, fecha, GPS, posición. Entran en su
 * renglón, salvo el GPS del listado con una precisión de 100 m o más.
 */
const renglon = UN_RENGLON;

/**
 * Va junto al `fontSize`: react-pdf multiplica el interlineado por el tamaño del
 * mismo estilo, y sin él usa 18 pt y el renglón no entra en su caja.
 */
const interlineado = { lineHeight: M.interlineado } as const;

const mayusculas = { ...interlineado, ...rotuloEnMayusculas(TAMANO_TEXTO.etiqueta) } as const;

const recuadroFoto = {
  width: LADO_FOTO_TARJETA,
  height: LADO_FOTO_TARJETA,
  borderRadius: M.radioRecuadro,
} as const;

const celda = { ...renglon, flexBasis: 0, paddingHorizontal: M.rellenoCelda } as const;

const columna = (peso: number) => ({ ...celda, flexGrow: peso });

const mono = LETRA_REPORTE.codigo;

/** Lo que la tarjeta y la fila del listado pintan igual. */
const deArbol = { codigo: { ...mono, color: COLOR_PDF.navy }, mono } as const;

/** Lo que el filete de abajo deja para el nombre de la especie. */
const aireEspecie = aireCentrado(M.altoEspecie - M.borde, ALTO.especieTarjeta);

export const tarjetaStyles = StyleSheet.create({
  ...deArbol,
  grilla: { rowGap: M.separacion },
  fila: { flexDirection: 'row', columnGap: M.separacion },
  tarjeta: {
    flexDirection: 'row',
    width: CAJA_TARJETA.ancho,
    minHeight: CAJA_TARJETA.alto,
    padding: M.rellenoTarjeta,
    borderWidth: M.borde,
    borderColor: COLOR_PDF.linea,
    borderRadius: M.radio,
  },
  foto: { ...recuadroFoto, objectFit: 'cover' },
  vacio: { ...recuadroFoto, ...recuadroVacio },
  textoVacio: { fontSize: TAMANO_TEXTO.secundario, color: COLOR_PDF.tenue },
  datos: { flex: 1, marginLeft: M.aireFoto },
  idArbol: {
    ...interlineado,
    ...LETRA_REPORTE.idTarjeta,
    paddingBottom: M.altoIdArbol - ALTO.idTarjeta,
    color: COLOR_PDF.navy,
  },
  filaEspecie: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: aireEspecie,
    paddingBottom: M.aireEspecie + aireEspecie,
    marginBottom: M.aireEspecie,
    borderBottomWidth: M.borde,
    borderBottomColor: COLOR_PDF.linea,
  },
  punto: puntoDeEspecie(M.punto, ALTO.especieTarjeta),
  nombreEspecie: {
    ...interlineado,
    ...LETRA_REPORTE.especieTarjeta,
    flex: 1,
    color: COLOR_PDF.tinta,
  },
  dato: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: aireCentrado(M.altoDato, ALTO.dato),
  },
  // Con su aire, centrado en el primer renglón del valor: no le suma alto al dato.
  rotulo: {
    ...mayusculas,
    ...renglon,
    width: M.anchoEtiqueta,
    paddingTop: M.aireSobreEtiqueta,
    marginVertical: aireCentrado(ALTO.dato, ALTO.etiqueta + M.aireSobreEtiqueta),
  },
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
    alignItems: 'flex-start',
    minHeight: M.altoFilaListado,
    paddingVertical: aireCentrado(M.altoFilaListado - M.bordeFino, ALTO.fila),
    color: COLOR_PDF.tinta,
    borderBottomWidth: M.bordeFino,
    borderBottomColor: COLOR_PDF.linea,
  },
  sombreada: { backgroundColor: COLOR_PDF.papelHundido },
  idArbol: { ...LETRA_REPORTE.idFila, color: COLOR_PDF.navy },
  filaEspecie: {
    ...columna(M.pesoColumna.especie),
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  punto: puntoDeEspecie(M.punto, ALTO.fila),
  nombreEspecie: { flex: 1 },
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
