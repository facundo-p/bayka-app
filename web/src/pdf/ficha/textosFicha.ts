import { TEXTO_PLANTILLA } from '../plantilla/textos';

/** Textos visibles que solo tiene la ficha; los del árbol están en TEXTO_ARBOL. */
export const TEXTO_FICHA = {
  documentoUno: 'Ficha de árbol',
  documentoVarias: 'Fichas de árboles',
  tecnico: 'Técnico',
  sinPuntoGps: 'Sin punto GPS',
  mapaNoDisponible: 'Mapa no disponible',
  sinPunto: 'Sin punto',
  separador: TEXTO_PLANTILLA.separador,
} as const;
