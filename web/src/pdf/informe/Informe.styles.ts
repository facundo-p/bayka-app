import { StyleSheet } from '@react-pdf/renderer';
import {
  aireCentrado,
  ALTO_RENGLON_INFORME as ALTO,
  COLOR_PDF,
  FUENTE_PDF,
  LETRA_INFORME,
  MEDIDA_FICHA,
  MEDIDA_INFORME as M,
  PESO_FUENTE,
  TAMANO_TEXTO,
} from '../plantilla/tokens';

const rotulo = {
  fontSize: TAMANO_TEXTO.rotuloIndicador,
  color: COLOR_PDF.apagado,
  textTransform: 'uppercase',
  letterSpacing: MEDIDA_FICHA.espaciadoMayusculas,
} as const;

const numero = { textAlign: 'right' } as const;

const barra = { borderRadius: M.radioBarra, overflow: 'hidden' } as const;

const titulo = {
  fontFamily: FUENTE_PDF.titulo,
  fontWeight: PESO_FUENTE.bold,
  color: COLOR_PDF.navy,
} as const;

const punto = {
  width: M.puntoEspecie,
  height: M.puntoEspecie,
  borderRadius: M.puntoEspecie / 2,
  marginRight: MEDIDA_FICHA.aireTrasPunto,
} as const;

/*
 * Los textos que se parten van arriba, con el aire que los dejaba centrados en
 * su renglón: con uno solo quedan donde estaban, y con más crecen hacia abajo.
 * El punto y lo demás de la fila se centran en el primero.
 */
const aireFila = aireCentrado(M.altoFilaEspecie, ALTO.fila);

export const informeStyles = StyleSheet.create({
  titulo: { marginBottom: M.separacionBloques },
  tituloTexto: { ...titulo, fontSize: TAMANO_TEXTO.tituloInforme, height: M.altoTitulo },
  linea: {
    ...LETRA_INFORME.linea,
    lineHeight: M.interlineado,
    marginTop: M.aireTitulo,
    paddingBottom: M.altoLineaTitulo - ALTO.linea,
    color: COLOR_PDF.apagado,
  },

  indicadores: {
    flexDirection: 'row',
    height: M.altoIndicadores,
    marginBottom: M.separacionBloques,
  },
  indicador: {
    flexGrow: 1,
    flexBasis: 0,
    marginLeft: M.separacionIndicadores,
    paddingVertical: M.rellenoIndicador.vertical,
    paddingHorizontal: M.rellenoIndicador.horizontal,
    borderWidth: MEDIDA_FICHA.borde,
    borderColor: COLOR_PDF.linea,
    borderRadius: M.radio,
  },
  indicadorPrincipal: { flexGrow: M.pesoIndicadorPrincipal, marginLeft: 0 },
  rotulo,
  valorIndicador: {
    ...titulo,
    fontSize: TAMANO_TEXTO.indicador,
    marginTop: M.aireIndicador,
  },
  meta: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.filaInforme,
    color: COLOR_PDF.apagado,
  },
  detalleIndicador: {
    fontSize: TAMANO_TEXTO.detalleIndicador,
    color: COLOR_PDF.apagado,
    marginTop: M.aireIndicador,
  },
  barraAvance: {
    ...barra,
    height: M.altoBarraAvance,
    marginTop: M.aireIndicador,
    backgroundColor: COLOR_PDF.tinte,
  },
  rellenoAvance: { height: '100%', backgroundColor: COLOR_PDF.oliva },

  encabezadoBloque: {
    ...titulo,
    fontSize: TAMANO_TEXTO.bloque,
    height: M.altoEncabezadoBloque + M.aireEncabezadoBloque,
    paddingBottom: M.aireEncabezadoBloque,
    marginBottom: M.separacionEncabezadoBloque,
    borderBottomWidth: MEDIDA_FICHA.borde,
    borderBottomColor: COLOR_PDF.linea,
  },
  mensaje: {
    height: M.altoMensaje,
    lineHeight: M.interlineado,
    fontSize: TAMANO_TEXTO.filaInforme,
    color: COLOR_PDF.tenue,
  },

  filaEspecie: {
    ...LETRA_INFORME.fila,
    lineHeight: M.interlineado,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: M.altoFilaEspecie,
    marginBottom: M.separacionFilaEspecie,
    color: COLOR_PDF.tinta,
  },
  nombreEspecie: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: M.anchoNombreEspecie,
    paddingVertical: aireFila,
  },
  tituloEspecie: { flexShrink: 1 },
  puntoFila: { ...punto, marginTop: aireCentrado(ALTO.fila, M.puntoEspecie) },
  barraEspecie: {
    ...barra,
    flexGrow: 1,
    height: M.altoBarraEspecie,
    marginTop: aireCentrado(M.altoFilaEspecie, M.altoBarraEspecie),
    marginHorizontal: M.separacionColumnas,
    backgroundColor: COLOR_PDF.papelHundido,
  },
  rellenoBarra: { height: '100%' },
  cantidad: { ...numero, marginTop: aireFila, width: M.anchoCantidad },
  porcentajeEspecie: {
    ...numero,
    marginTop: aireFila,
    width: M.anchoPorcentaje,
    color: COLOR_PDF.apagado,
  },

  // Margen arriba del mapa y no relleno al pie de las especies: un relleno que no
  // entra en la hoja la parte y manda solo ese hueco a una hoja en blanco.
  bloqueMapa: { marginTop: M.separacionBloques },
  tituloMapa: { ...titulo, fontSize: TAMANO_TEXTO.tituloSeccion, height: M.altoTituloMapa },
  notaTitulo: {
    lineHeight: M.interlineado,
    marginTop: M.aireTitulo,
    marginBottom: M.aireTituloMapa,
    height: M.altoLineaTitulo,
    fontSize: TAMANO_TEXTO.lineaInforme,
    color: COLOR_PDF.apagado,
  },
  mapa: { alignSelf: 'center' },
  imagenMapa: {
    width: '100%',
    height: '100%',
    borderRadius: MEDIDA_FICHA.radioRecuadro,
    borderWidth: MEDIDA_FICHA.bordeFino,
    borderColor: COLOR_PDF.linea,
  },
  // En el aire entre la imagen y la leyenda: no suma alto.
  llamada: {
    position: 'absolute',
    top: '100%',
    right: 0,
    lineHeight: MEDIDA_FICHA.interlineadoLlamada,
  },
  leyenda: {
    marginTop: M.aireMapa,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: M.separacionLeyenda,
  },
  itemLeyenda: {
    ...LETRA_INFORME.leyenda,
    lineHeight: M.interlineado,
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: M.anchoItemLeyenda,
    minHeight: M.altoRenglonLeyenda,
    paddingVertical: aireCentrado(M.altoRenglonLeyenda, ALTO.leyenda),
    color: COLOR_PDF.tinta,
  },
  puntoLeyenda: { ...punto, marginTop: aireCentrado(ALTO.leyenda, M.puntoEspecie) },
  codigoLeyenda: { flexShrink: 1 },
  notaMapa: {
    lineHeight: M.interlineado,
    marginTop: M.aireMapa,
    height: M.altoNotaMapa,
    fontSize: TAMANO_TEXTO.secundario,
    color: COLOR_PDF.apagado,
  },
});
