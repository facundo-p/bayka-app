import { StyleSheet } from '@react-pdf/renderer';
import { recuadroVacio } from '../arbol/PartesArbol.styles';
import {
  interlineadoDeRenglon,
  puntoDeEspecie,
  rotuloEnMayusculas,
} from '../plantilla/comunes.styles';
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

const mayusculas = {
  ...interlineadoDeRenglon,
  ...rotuloEnMayusculas(TAMANO_TEXTO.etiqueta),
} as const;

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

/** Lo que el filete de abajo deja para el ID. */
const aireId = aireCentrado(M.altoIdArbol - M.borde, ALTO.idTarjeta);

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
  filaEspecie: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: M.altoEspecie - ALTO.especieTarjeta,
  },
  punto: puntoDeEspecie(M.punto, ALTO.especieTarjeta),
  nombreEspecie: {
    ...interlineadoDeRenglon,
    ...LETRA_REPORTE.especieTarjeta,
    flex: 1,
    color: COLOR_PDF.navy,
  },
  idArbol: {
    ...interlineadoDeRenglon,
    ...LETRA_REPORTE.idTarjeta,
    paddingTop: aireId,
    paddingBottom: M.aireFilete + aireId,
    marginBottom: M.aireFilete,
    borderBottomWidth: M.borde,
    borderBottomColor: COLOR_PDF.linea,
    color: COLOR_PDF.apagado,
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
    ...interlineadoDeRenglon,
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
    ...interlineadoDeRenglon,
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
