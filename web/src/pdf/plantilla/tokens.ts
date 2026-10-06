/*
 * Tokens de marca de los PDF. react-pdf no lee custom properties: los colores
 * repiten los hex de theme.css (la paridad la cuida un test), y cambiar la
 * estética de los PDF es editar este archivo.
 */
import { COLOR_GRAFICO_NN } from '../../theme/chartColors';

export const COLOR_PDF = {
  navy: '#0a3760',
  oliva: '#99b95b',
  papel: '#ffffff',
  papelHundido: '#faf8f1',
  tinta: '#2a2d27',
  cuerpo: '#3a3d36',
  apagado: '#6e6a5e',
  tenue: '#9a927e',
  linea: '#e7e1d4',
  ambar: COLOR_GRAFICO_NN,
  ambarFondo: '#fffaf0',
  // Más oscuro que --color-warn-fg-strong: el texto ámbar de 6,5 pt tiene que leerse impreso.
  ambarTexto: '#9a6b12',
  mapaFondo: '#f6f9f0',
  // Solo del PDF: la grilla y las insignias del mapa no tienen par en la web.
  mapaGrilla: '#e6edd8',
  mapaInsignia: 'rgba(255, 255, 255, 0.85)',
  blanco: '#ffffff',
} as const;

/** Token de theme.css al que corresponde cada color del PDF que tiene par en la web. */
export const TOKEN_CSS_DE_COLOR_PDF = {
  navy: '--color-primary',
  oliva: '--color-secondary',
  papel: '--color-surface',
  papelHundido: '--color-surface-sunken',
  tinta: '--color-text-primary',
  cuerpo: '--color-text-body',
  apagado: '--color-text-secondary',
  tenue: '--color-text-muted',
  linea: '--color-border',
  ambar: '--color-warn-dot',
  ambarFondo: '--color-warn-bg',
  mapaFondo: '--color-secondary-bg',
} as const satisfies Partial<Record<keyof typeof COLOR_PDF, `--color-${string}`>>;

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
  rellenoVertical: 8,
  rellenoHorizontal: 12,
  aireSuperior: 6,
  separacionSuperior: 6,
  separacionDatos: 3,
  radioRecuadro: 3,
  anchoFoto: 120,
  altoFoto: 90,
  ladoMapa: 128,
  separacion: 12,
  hueco: 12,
  radio: 6,
  borde: 0.75,
  bordeFino: 0.5,
  punto: 8,
  aireTrasPunto: 5,
  rellenoMarca: { vertical: 1, horizontal: 4 },
  /** Espaciado de letras de los rótulos en mayúsculas. */
  espaciadoMayusculas: 0.4,
  anchoEtiqueta: 54,
} as const;
