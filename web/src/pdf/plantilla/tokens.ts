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
  /** Fondo de la barra de avance hacia la meta. */
  tinte: '#edf4f9',
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
  // Sobre el satélite (#757), las insignias oscurecen la imagen y el texto va blanco.
  mapaVeloEtiqueta: 'rgba(0, 0, 0, 0.45)',
  mapaVeloInsignia: 'rgba(0, 0, 0, 0.35)',
  blanco: '#ffffff',
} as const;

/** Token de theme.css al que corresponde cada color del PDF que tiene par en la web. */
export const TOKEN_CSS_DE_COLOR_PDF = {
  navy: '--color-primary',
  oliva: '--color-secondary',
  papel: '--color-surface',
  papelHundido: '--color-surface-sunken',
  tinte: '--color-primary-bg',
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
  tituloInforme: 22,
  tituloSeccion: 16,
  bloque: 11.5,
  lineaInforme: 8.5,
  indicador: 18,
  rotuloIndicador: 6.8,
  detalleIndicador: 7,
  filaInforme: 8,
  leyenda: 7.5,
  atribucion: 5.5,
} as const;

/** Medidas de la hoja A4 en pt (595 × 842). */
export const MEDIDA_HOJA = {
  ancho: 595,
  alto: 842,
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

/** Lo que queda para el cuerpo de una hoja, entre encabezado y pie y entre márgenes. */
export const CUERPO_HOJA = {
  ancho: MEDIDA_HOJA.ancho - MEDIDA_HOJA.margenLateral * 2,
  alto:
    MEDIDA_HOJA.alto -
    MEDIDA_HOJA.margenSuperior -
    MEDIDA_HOJA.reservaEncabezado -
    MEDIDA_HOJA.margenInferior -
    MEDIDA_HOJA.reservaPie,
} as const;

/**
 * Medidas del informe en pt. Los renglones tienen alto fijo: con eso
 * `planificarInforme` sabe cuánto ocupa cada bloque sin renderizar.
 */
export const MEDIDA_INFORME = {
  separacionBloques: 14,
  /**
   * Interlineado de los renglones de alto fijo: el de Poppins por defecto no
   * entra, y react-pdf no dibuja una línea que no entra en su caja.
   */
  interlineado: 1.25,
  altoTitulo: 26,
  altoLineaTitulo: 12,
  aireTitulo: 2,
  altoIndicadores: 66,
  separacionIndicadores: 8,
  /** El de árboles es más ancho que los otros tres. */
  pesoIndicadorPrincipal: 1.6,
  rellenoIndicador: { vertical: 8, horizontal: 10 },
  aireIndicador: 3,
  altoBarraAvance: 5,
  radio: 5,
  altoEncabezadoBloque: 15,
  /** Lo que tiene que entrar después de un título de bloque para que no quede huérfano. */
  presenciaTrasEncabezado: 40,
  aireEncabezadoBloque: 3,
  separacionEncabezadoBloque: 6,
  altoFilaEspecie: 11,
  puntoEspecie: 7,
  separacionFilaEspecie: 3,
  anchoNombreEspecie: 140,
  anchoCantidad: 46,
  anchoPorcentaje: 30,
  altoBarraEspecie: 7,
  radioBarra: 2,
  separacionColumnas: 8,
  altoEncabezadoTabla: 14,
  altoFilaTabla: 16,
  altoBarraParcela: 4,
  anchoColumnaNumero: 44,
  anchoBarraParcela: 90,
  rellenoCelda: 4,
  altoMensaje: 14,
  altoTituloMapa: 20,
  aireTituloMapa: 8,
  aireMapa: 4,
  altoRenglonLeyenda: 11,
  anchoItemLeyenda: 44,
  separacionLeyenda: 10,
  /** Columna de la atribución del satélite, a la derecha de la leyenda. */
  anchoAtribucion: 80,
  /** Baja la atribución, de letra más chica, al centro del renglón de la leyenda. */
  aireAtribucion: 2,
  altoNotaMapa: 11,
  /** Lo mínimo que tiene que medir el mapa para ir al pie de la última hoja: 7 cm. */
  altoMinimoMapa: 198,
  /** Colchón contra los redondeos del layout: si el cálculo se queda corto, el mapa salta solo. */
  holgura: 8,
  /** Aire dentro del marco del mapa: las etiquetas, el norte y la escala no tocan los puntos. */
  margenMapa: 24,
  /** Radio de los puntos del mapa: sigue a la separación entre vecinos, dentro de estos topes. */
  radioPuntoMapa: { minimo: 1.1, maximo: 4 },
  /** Fracción de la distancia al vecino más cercano: deja aire entre dos puntos vecinos. */
  factorRadioPunto: 0.35,
} as const;
