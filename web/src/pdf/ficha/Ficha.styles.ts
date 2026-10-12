import { StyleSheet } from '@react-pdf/renderer';
import {
  COLOR_PDF,
  ESTILO_FUENTE,
  FUENTE_PDF,
  MEDIDA_FICHA as M,
  PESO_FUENTE,
} from '../plantilla/tokens';

const { letra } = M;

const INTERLINEADO = { titulo: 1.25, id: 1.2, dato: 1.35 } as const;

const imagen = {
  width: M.ladoImagen,
  height: M.ladoImagen,
  borderRadius: M.radioRecuadro,
  overflow: 'hidden',
} as const;

const rotulo = {
  fontSize: letra.rotulo,
  color: COLOR_PDF.apagado,
  textTransform: 'uppercase',
  letterSpacing: M.espaciadoMayusculas,
} as const;

const mono = { fontFamily: FUENTE_PDF.mono, fontSize: letra.datoMono } as const;

export const fichaStyles = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between' },
  filaFoto: { marginBottom: M.huecoImagenes },
  texto: { width: M.anchoTexto },
  filaEspecie: { flexDirection: 'row', alignItems: 'flex-start' },
  punto: {
    width: M.punto,
    height: M.punto,
    borderRadius: M.punto / 2,
    // Centrado en el primer renglón: si el nombre se parte, el punto no baja.
    marginTop: (letra.especie * INTERLINEADO.titulo - M.punto) / 2,
    marginRight: M.aireTrasPuntoEspecie,
  },
  nombreEspecie: {
    flex: 1,
    fontWeight: PESO_FUENTE.semibold,
    fontSize: letra.especie,
    lineHeight: INTERLINEADO.titulo,
    color: COLOR_PDF.tinta,
  },
  sinIdentificar: { color: COLOR_PDF.ambarTexto },
  cientifico: {
    marginTop: M.aireBajoTitulo,
    fontStyle: ESTILO_FUENTE.italica,
    fontSize: letra.cientifico,
    color: COLOR_PDF.cuerpo,
  },
  clasificacion: { ...rotulo, marginTop: M.aireBajoTitulo, fontSize: letra.clasificacion },
  id: { marginTop: M.separacionBloques },
  rotulo,
  idArbol: {
    marginTop: M.aireRotulo,
    fontFamily: FUENTE_PDF.mono,
    fontWeight: PESO_FUENTE.medio,
    lineHeight: INTERLINEADO.id,
    color: COLOR_PDF.navy,
  },
  foto: imagen,
  mapa: { ...imagen, borderWidth: M.bordeFino, borderColor: COLOR_PDF.linea },
  vacio: {
    ...imagen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: M.borde,
    borderStyle: 'dashed',
    borderColor: COLOR_PDF.linea,
    backgroundColor: COLOR_PDF.papelHundido,
  },
  textoVacio: { marginTop: M.aireIcono, fontSize: letra.vacio, color: COLOR_PDF.tenue },
  // Debajo del mapa, en el aire hasta el pie: no suma alto.
  llamada: {
    position: 'absolute',
    top: M.ladoImagen,
    right: 0,
    lineHeight: M.interlineadoLlamada,
  },
  registro: { marginTop: M.separacionBloques },
  dato: {
    paddingVertical: M.rellenoDato,
    borderTopWidth: M.bordeFino,
    borderTopColor: COLOR_PDF.linea,
  },
  valor: {
    marginTop: M.aireRotulo,
    fontSize: letra.dato,
    lineHeight: INTERLINEADO.dato,
    color: COLOR_PDF.tinta,
  },
  codigo: { ...mono, color: COLOR_PDF.navy },
  mono,
  apagado: { color: COLOR_PDF.apagado },
  tenue: { color: COLOR_PDF.tenue },
});
