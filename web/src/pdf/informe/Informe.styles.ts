import { StyleSheet } from '@react-pdf/renderer';
import { letraDeTitulo, puntoDeEspecie, rotuloEnMayusculas } from '../plantilla/comunes.styles';
import {
  aireCentrado,
  ALTO_RENGLON_INFORME as ALTO,
  COLOR_PDF,
  FUENTE_PDF,
  LETRA_INFORME,
  MEDIDA_INFORME as M,
  PESO_FUENTE,
  TAMANO_TEXTO,
} from '../plantilla/tokens';

const numero = { textAlign: 'right' } as const;

const barra = { borderRadius: M.radioBarra, overflow: 'hidden' } as const;

/*
 * Los textos que se parten van arriba, con el aire que los dejaba centrados en
 * su renglón: con uno solo quedan donde estaban, y con más crecen hacia abajo.
 * El punto y lo demás de la fila se centran en el primero.
 */
const aireFila = aireCentrado(M.altoFilaEspecie, ALTO.fila);

export const informeStyles = StyleSheet.create({
  titulo: { marginBottom: M.separacionBloques },
  tituloTexto: { ...letraDeTitulo, fontSize: TAMANO_TEXTO.tituloInforme, height: M.altoTitulo },
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
    borderWidth: M.borde,
    borderColor: COLOR_PDF.linea,
    borderRadius: M.radio,
  },
  indicadorPrincipal: { flexGrow: M.pesoIndicadorPrincipal, marginLeft: 0 },
  rotulo: rotuloEnMayusculas(TAMANO_TEXTO.rotuloIndicador),
  valorIndicador: {
    ...letraDeTitulo,
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
    ...letraDeTitulo,
    fontSize: TAMANO_TEXTO.bloque,
    height: M.altoEncabezadoBloque + M.aireEncabezadoBloque,
    paddingBottom: M.aireEncabezadoBloque,
    marginBottom: M.separacionEncabezadoBloque,
    borderBottomWidth: M.borde,
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
  puntoFila: puntoDeEspecie(M.punto, ALTO.fila),
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
  tituloMapa: { ...letraDeTitulo, fontSize: TAMANO_TEXTO.tituloSeccion, height: M.altoTituloMapa },
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
    borderRadius: M.radioRecuadro,
    borderWidth: M.bordeFino,
    borderColor: COLOR_PDF.linea,
  },
  // En el aire entre la imagen y la leyenda.
  llamada: { top: '100%' },
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
  puntoLeyenda: puntoDeEspecie(M.punto, ALTO.leyenda),
  codigoLeyenda: { flexShrink: 1 },
  notaMapa: {
    lineHeight: M.interlineado,
    marginTop: M.aireMapa,
    height: M.altoNotaMapa,
    fontSize: TAMANO_TEXTO.secundario,
    color: COLOR_PDF.apagado,
  },
});
