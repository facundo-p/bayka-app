import { TEXTO_PLANTILLA } from '../plantilla/textos';

/** Rótulos y textos de un árbol: los mismos en la ficha y en el reporte. */
export const TEXTO_ARBOL = {
  idArbol: 'ID Árbol',
  especie: 'Especie',
  parcela: 'Parcela',
  grupo: 'Grupo',
  posicion: 'Posición',
  registrado: 'Registrado',
  gps: 'GPS',
  sinFoto: 'Sin foto',
  fotoNoDisponible: 'Foto no disponible',
  separador: TEXTO_PLANTILLA.separador,
  precision: '±',
  metros: 'm',
} as const;
