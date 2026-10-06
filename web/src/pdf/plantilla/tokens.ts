/*
 * Tokens de marca de los PDF. react-pdf no lee custom properties: los hex que
 * coinciden con un token de theme.css lo nombran, y cambiar la estética de los
 * PDF es editar este archivo.
 */
import { COLOR_GRAFICO_NN } from '../../theme/chartColors';

export const COLOR_PDF = {
  navy: '#0a3760', // --color-primary
  oliva: '#99b95b', // --color-secondary
  papel: '#ffffff', // --color-surface
  papelHundido: '#faf8f1', // --color-surface-sunken
  tinta: '#2a2d27', // --color-text-primary
  cuerpo: '#3a3d36', // --color-text-body
  apagado: '#6e6a5e', // --color-text-secondary
  tenue: '#9a927e', // --color-text-muted
  linea: '#e7e1d4', // --color-border
  ambar: COLOR_GRAFICO_NN, // --color-warn-dot
  ambarFondo: '#fffaf0', // --color-warn-bg
  // Más oscuro que --color-warn-fg-strong: el texto ámbar de 6,5 pt tiene que leerse impreso.
  ambarTexto: '#9a6b12',
  mapaFondo: '#f6f9f0', // --color-secondary-bg
  // Solo del PDF: la grilla y las insignias del mapa no tienen par en la web.
  mapaGrilla: '#e6edd8',
  mapaInsignia: 'rgba(255, 255, 255, 0.85)',
  blanco: '#ffffff',
} as const;

export const FUENTE_PDF = {
  titulo: 'Linux Biolinum',
  cuerpo: 'Poppins',
  mono: 'IBM Plex Mono',
} as const;

export const PESO_FUENTE = {
  regular: 400,
  medio: 500,
  semibold: 600,
  bold: 700,
} as const;

export const ESTILO_FUENTE = { normal: 'normal', italica: 'italic' } as const;

/** Tamaños de letra en pt. */
export const TAMANO_TEXTO = {
  pie: 7,
  pieMarca: 8,
  etiqueta: 7.2,
  clasificacion: 7,
  secundario: 7.5,
  marca: 6.5,
  dato: 8.3,
  datoMono: 7.8,
  cientifico: 8,
  especie: 9.5,
  encabezado: 14,
  idArbol: 14,
} as const;

/** Medidas de la hoja A4 en pt (595 × 842). */
export const MEDIDA_HOJA = {
  margenSuperior: 34,
  margenInferior: 22,
  margenLateral: 30,
  altoLogo: 26,
  /** Alto que reserva el cuerpo para el encabezado fijo, filete y aire incluidos. */
  reservaEncabezado: 54,
  reservaPie: 28,
  fileteEncabezado: 1.5,
  filetePie: 0.75,
  aireFilete: 10,
  airePie: 6,
} as const;

/** Medidas de la ficha en pt: tres entran en una hoja A4. */
export const MEDIDA_FICHA = {
  rellenoVertical: 10,
  rellenoHorizontal: 12,
  aireSuperior: 7,
  separacionSuperior: 8,
  separacionDatos: 3,
  radioRecuadro: 3,
  anchoFoto: 120,
  altoFoto: 90,
  ladoMapa: 128,
  separacion: 14,
  hueco: 12,
  radio: 6,
  borde: 0.75,
  punto: 8,
  anchoEtiqueta: 54,
} as const;
