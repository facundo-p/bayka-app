import { StyleSheet } from '@react-pdf/renderer';
import {
  COLOR_PDF,
  FUENTE_PDF,
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

/** Un renglón de alto fijo: lo que no entra termina en «…» en vez de perderse. */
const recortado = { maxLines: 1, textOverflow: 'ellipsis' } as const;

const celda = { paddingHorizontal: M.rellenoCelda } as const;

const titulo = {
  fontFamily: FUENTE_PDF.titulo,
  fontWeight: PESO_FUENTE.bold,
  color: COLOR_PDF.navy,
} as const;

export const informeStyles = StyleSheet.create({
  titulo: { marginBottom: M.separacionBloques },
  tituloTexto: { ...titulo, fontSize: TAMANO_TEXTO.tituloInforme, height: M.altoTitulo },
  linea: {
    ...recortado,
    lineHeight: M.interlineado,
    marginTop: M.aireTitulo,
    height: M.altoLineaTitulo,
    fontSize: TAMANO_TEXTO.lineaInforme,
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
  valorAlerta: { color: COLOR_PDF.ambarTexto },
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

  // Relleno y no margen: react-pdf manda entero a la hoja siguiente un bloque que
  // entra en la hoja pero cuyo margen inferior no, y deja la anterior en blanco.
  bloque: { paddingBottom: M.separacionBloques },
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
    lineHeight: M.interlineado,
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoFilaEspecie,
    marginBottom: M.separacionFilaEspecie,
    fontSize: TAMANO_TEXTO.filaInforme,
    color: COLOR_PDF.tinta,
  },
  recortado: { ...recortado, flexShrink: 1 },
  nombreEspecie: { flexDirection: 'row', alignItems: 'center', width: M.anchoNombreEspecie },
  punto: {
    width: M.puntoEspecie,
    height: M.puntoEspecie,
    borderRadius: M.puntoEspecie / 2,
    marginRight: MEDIDA_FICHA.aireTrasPunto,
  },
  barraEspecie: {
    ...barra,
    flexGrow: 1,
    height: M.altoBarraEspecie,
    marginHorizontal: M.separacionColumnas,
    backgroundColor: COLOR_PDF.papelHundido,
  },
  rellenoBarra: { height: '100%' },
  cantidad: { ...numero, width: M.anchoCantidad },
  porcentajeEspecie: { ...numero, width: M.anchoPorcentaje, color: COLOR_PDF.apagado },

  filaTabla: {
    lineHeight: M.interlineado,
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoFilaTabla,
    fontSize: TAMANO_TEXTO.filaInforme,
    color: COLOR_PDF.tinta,
    borderBottomWidth: MEDIDA_FICHA.bordeFino,
    borderBottomColor: COLOR_PDF.linea,
  },
  encabezadoTabla: {
    ...rotulo,
    lineHeight: M.interlineado,
    flexDirection: 'row',
    alignItems: 'center',
    height: M.altoEncabezadoTabla,
    borderBottomWidth: MEDIDA_FICHA.borde,
    borderBottomColor: COLOR_PDF.linea,
  },
  filaTotal: { fontWeight: PESO_FUENTE.semibold, borderBottomWidth: 0 },
  celdaParcela: { ...celda, ...recortado, flexGrow: 1, flexBasis: 0 },
  celdaNumero: { ...celda, ...numero, width: M.anchoColumnaNumero },
  celdaBarra: { ...celda, width: M.anchoBarraParcela },
  codigo: { fontFamily: FUENTE_PDF.mono, color: COLOR_PDF.navy },
  barraParcela: { ...barra, height: M.altoBarraParcela, backgroundColor: COLOR_PDF.papelHundido },
  rellenoParcela: { height: '100%', backgroundColor: COLOR_PDF.navy },

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
    lineHeight: M.interlineado,
    flexDirection: 'row',
    alignItems: 'center',
    width: M.anchoItemLeyenda,
    height: M.altoRenglonLeyenda,
    fontSize: TAMANO_TEXTO.leyenda,
    color: COLOR_PDF.tinta,
  },
  notaMapa: {
    lineHeight: M.interlineado,
    marginTop: M.aireMapa,
    height: M.altoNotaMapa,
    fontSize: TAMANO_TEXTO.secundario,
    color: COLOR_PDF.apagado,
  },
});
