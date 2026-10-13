import { StyleSheet } from '@react-pdf/renderer';
import { recuadroVacio } from '../arbol/PartesArbol.styles';
import { marcoDeMapa, puntoDeEspecie, rotuloEnMayusculas } from '../plantilla/comunes.styles';
import {
  altoDeRenglon,
  COLOR_PDF,
  ESTILO_FUENTE,
  FUENTE_PDF,
  MEDIDA_FICHA as M,
  PESO_FUENTE,
} from '../plantilla/tokens';

const { letra } = M;

/** A la medida de la letra grande de la ficha de hoja entera: nada reparte hojas con ellos. */
const INTERLINEADO = { titulo: 1.25, id: 1.2, dato: 1.35 } as const;

const imagen = {
  width: M.ladoImagen,
  height: M.ladoImagen,
  borderRadius: M.radioRecuadro,
  overflow: 'hidden',
} as const;

const mono = { fontFamily: FUENTE_PDF.mono, fontSize: letra.datoMono } as const;

export const fichaStyles = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between' },
  filaFoto: { marginBottom: M.huecoImagenes },
  texto: { width: M.anchoTexto, marginRight: M.huecoColumnas },
  filaEspecie: { flexDirection: 'row', alignItems: 'flex-start' },
  punto: puntoDeEspecie(M.punto, altoDeRenglon(letra.especie, INTERLINEADO.titulo)),
  nombreEspecie: {
    flex: 1,
    fontWeight: PESO_FUENTE.semibold,
    fontSize: letra.especie,
    lineHeight: INTERLINEADO.titulo,
    color: COLOR_PDF.tinta,
  },
  cientifico: {
    marginTop: M.aireBajoTitulo,
    fontStyle: ESTILO_FUENTE.italica,
    fontSize: letra.cientifico,
    color: COLOR_PDF.cuerpo,
  },
  clasificacion: { ...rotuloEnMayusculas(letra.clasificacion), marginTop: M.aireBajoTitulo },
  id: { marginTop: M.separacionBloques },
  rotulo: rotuloEnMayusculas(letra.rotulo),
  idArbol: {
    marginTop: M.aireRotulo,
    fontFamily: FUENTE_PDF.mono,
    fontWeight: PESO_FUENTE.medio,
    lineHeight: INTERLINEADO.id,
    color: COLOR_PDF.navy,
  },
  foto: imagen,
  mapa: { ...imagen, ...marcoDeMapa },
  vacio: { ...imagen, ...recuadroVacio },
  textoVacio: { marginTop: M.aireIcono, fontSize: letra.vacio, color: COLOR_PDF.tenue },
  // Debajo del mapa, en el aire hasta el pie.
  llamada: { top: M.ladoImagen },
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
  tenue: { color: COLOR_PDF.tenue },
});
