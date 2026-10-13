/*
 * Tokens de marca de los PDF. react-pdf no lee custom properties: los colores
 * repiten los hex de theme.css (la paridad la cuida un test), y cambiar la
 * estética de los PDF es editar este archivo.
 */
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
  tenue: '#6e6a5e',
  linea: '#e7e1d4',
  // Más oscuro que --color-warn-fg-strong: el texto ámbar chico tiene que leerse impreso.
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

/** Un texto que no pasa de un renglón: lo que no entra termina en «…». */
export const UN_RENGLON = { maxLines: 1, textOverflow: 'ellipsis' } as const;

/** Tamaños de letra en pt. */
export const TAMANO_TEXTO = {
  pie: 7,
  pieMarca: 8,
  etiqueta: 7.2,
  secundario: 7.5,
  dato: 8.3,
  datoMono: 7.8,
  especie: 9.5,
  encabezado: 14,
  idTarjeta: 12,
  filaListado: 7.8,
  tituloInforme: 22,
  tituloSeccion: 16,
  bloque: 11.5,
  lineaInforme: 8.5,
  indicador: 18,
  rotuloIndicador: 6.8,
  detalleIndicador: 7,
  filaInforme: 8,
  leyenda: 7.5,
  /** El asterisco debajo del mapa satelital. */
  llamada: 7,
  notaAlPie: 4.5,
} as const;

/**
 * La letra de los textos del reporte que se parten o se cortan antes del
 * render (#876): la usan sus estilos y la medición, así no se desfasan.
 */
export const LETRA_REPORTE = {
  fila: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.filaListado,
  },
  dato: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.dato,
  },
  especieTarjeta: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.semibold,
    fontSize: TAMANO_TEXTO.especie,
  },
  codigo: {
    fontFamily: FUENTE_PDF.mono,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.datoMono,
  },
  idFila: {
    fontFamily: FUENTE_PDF.mono,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.filaListado,
  },
  idTarjeta: {
    fontFamily: FUENTE_PDF.mono,
    fontWeight: PESO_FUENTE.medio,
    fontSize: TAMANO_TEXTO.idTarjeta,
  },
} as const;

/** Cómo se gira la hoja: los valores son los de `orientation` de react-pdf. */
export const ORIENTACION_HOJA = {
  vertical: 'portrait',
  horizontal: 'landscape',
} as const;

export type OrientacionHoja = (typeof ORIENTACION_HOJA)[keyof typeof ORIENTACION_HOJA];

/**
 * Medidas de la hoja A4 en pt, parada. Ancho y alto son los del A4 de react-pdf,
 * no los redondeados: con 842, un renglón que llegaba justo al borde parecía entrar.
 */
export const MEDIDA_HOJA = {
  ancho: 595.28,
  alto: 841.89,
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

/** Medidas en pt que comparten los PDF: cada documento las suma a las suyas. */
export const MEDIDA_PDF = {
  borde: 0.75,
  bordeFino: 0.5,
  /** Radio de los recuadros de foto y de mapa. */
  radioRecuadro: 3,
  /** Espaciado de letras de los rótulos en mayúsculas. */
  espaciadoMayusculas: 0.4,
  /** Interlineado justo: la llamada bajo el mapa satelital no suma alto. */
  interlineadoLlamada: 1,
} as const;

/** El punto de color de la especie y el aire que lo separa del nombre. */
export type MedidaPunto = { diametro: number; aire: number };

/** Lo que ocupa el punto, con su aire, a lo ancho de un renglón. */
const anchoDePunto = ({ diametro, aire }: MedidaPunto) => diametro + aire;

/** Medidas de la ficha en pt: un árbol por hoja A4. */
export const MEDIDA_FICHA = {
  ...MEDIDA_PDF,
  /**
   * Foto arriba y minimapa abajo, cuadrados, a la derecha; los datos a la
   * izquierda. Columna, hueco e imagen llenan el ancho del cuerpo.
   */
  ladoImagen: 300,
  anchoTexto: 215,
  huecoColumnas: 20,
  huecoImagenes: 16,
  punto: { diametro: 11, aire: 8 },
  aireBajoTitulo: 2,
  separacionBloques: 22,
  rellenoDato: 8,
  aireRotulo: 3,
  aireIcono: 10,
  ladoIcono: 30,
  trazoIcono: 1.3,
  /** Tamaños de letra: los de la ficha de hoja entera, más grandes que los de TAMANO_TEXTO. */
  letra: {
    especie: 18,
    cientifico: 11.5,
    clasificacion: 8,
    rotulo: 7.5,
    idArbol: 18,
    dato: 11,
    datoMono: 10.5,
    vacio: 10.5,
  },
} as const;

type Medidas = { ancho: number; alto: number };

/** Acostada, el ancho y el alto de la A4 se cruzan. */
const DIMENSIONES_HOJA: Record<OrientacionHoja, Medidas> = {
  [ORIENTACION_HOJA.vertical]: { ancho: MEDIDA_HOJA.ancho, alto: MEDIDA_HOJA.alto },
  [ORIENTACION_HOJA.horizontal]: { ancho: MEDIDA_HOJA.alto, alto: MEDIDA_HOJA.ancho },
};

/** Lo que queda para el cuerpo de una hoja, entre encabezado y pie y entre márgenes. */
export function cuerpoDeHoja(orientacion: OrientacionHoja): Medidas {
  const { ancho, alto } = DIMENSIONES_HOJA[orientacion];
  return {
    ancho: ancho - MEDIDA_HOJA.margenLateral * 2,
    alto:
      alto -
      MEDIDA_HOJA.margenSuperior -
      MEDIDA_HOJA.reservaEncabezado -
      MEDIDA_HOJA.margenInferior -
      MEDIDA_HOJA.reservaPie,
  };
}

export const CUERPO_HOJA = cuerpoDeHoja(ORIENTACION_HOJA.vertical);

/**
 * Medidas del informe en pt. Los altos de la línea, de las filas de especie y
 * de la leyenda son los de un renglón: un texto partido en más suma el alto de
 * cada renglón de más. Con eso `planificarInforme` sabe cuánto ocupa cada
 * bloque sin renderizar.
 */
export const MEDIDA_INFORME = {
  ...MEDIDA_PDF,
  separacionBloques: 14,
  /**
   * Interlineado de los renglones: el de Poppins por defecto no entra en los
   * bloques de alto fijo, y react-pdf no dibuja una línea que no entra en su caja.
   */
  interlineado: 1.25,
  altoTitulo: 26,
  altoLineaTitulo: 12,
  aireTitulo: 2,
  altoIndicadores: 66,
  separacionIndicadores: 8,
  /** El de árboles es más ancho que los porcentajes. */
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
  punto: { diametro: 7, aire: 5 },
  separacionFilaEspecie: 3,
  anchoNombreEspecie: 140,
  anchoCantidad: 46,
  anchoPorcentaje: 30,
  altoBarraEspecie: 7,
  radioBarra: 2,
  separacionColumnas: 8,
  altoMensaje: 14,
  altoTituloMapa: 20,
  aireTituloMapa: 8,
  aireMapa: 4,
  altoRenglonLeyenda: 11,
  anchoItemLeyenda: 44,
  separacionLeyenda: 10,
  altoNotaMapa: 11,
  /** Horizontal, como el mapa del dashboard. */
  proporcionMapa: { ancho: 16, alto: 9 },
  /** Colchón contra los redondeos del layout: si el cálculo se queda corto, el mapa salta solo. */
  holgura: 8,
  /** Aire dentro del marco del mapa: las etiquetas, el norte y la escala no tocan los puntos. */
  margenMapa: 24,
  /** Radio de los puntos del mapa: sigue a la separación entre vecinos, dentro de estos topes. */
  radioPuntoMapa: { minimo: 1.1, maximo: 4 },
} as const;

/** El mapa del informe: al ancho del cuerpo y con proporción fija; los puntos se encuadran adentro. */
export const CAJA_MAPA_INFORME = {
  ancho: CUERPO_HOJA.ancho,
  alto:
    (CUERPO_HOJA.ancho * MEDIDA_INFORME.proporcionMapa.alto) / MEDIDA_INFORME.proporcionMapa.ancho,
} as const;

const ANCHO_PUNTO_INFORME = anchoDePunto(MEDIDA_INFORME.punto);

/** Ancho en pt de los renglones del informe que se parten o se cortan antes del render (#883). */
export const ANCHO_TEXTO_INFORME = {
  linea: CUERPO_HOJA.ancho,
  especie: MEDIDA_INFORME.anchoNombreEspecie - ANCHO_PUNTO_INFORME,
  leyenda: MEDIDA_INFORME.anchoItemLeyenda - ANCHO_PUNTO_INFORME,
} as const;

/** La letra de los textos del informe que se parten o se cortan antes del render (#883). */
export const LETRA_INFORME = {
  linea: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.lineaInforme,
  },
  fila: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.filaInforme,
  },
  leyenda: {
    fontFamily: FUENTE_PDF.cuerpo,
    fontWeight: PESO_FUENTE.regular,
    fontSize: TAMANO_TEXTO.leyenda,
  },
} as const;

const altoEnInforme = (tamano: number) => tamano * MEDIDA_INFORME.interlineado;

/** Alto en pt de un renglón de cada letra del informe que se parte. */
export const ALTO_RENGLON_INFORME = {
  linea: altoEnInforme(LETRA_INFORME.linea.fontSize),
  fila: altoEnInforme(LETRA_INFORME.fila.fontSize),
  leyenda: altoEnInforme(LETRA_INFORME.leyenda.fontSize),
} as const;

/**
 * Medidas del reporte de árboles en pt, en hoja horizontal. Los altos son los
 * de un renglón: un texto partido en más suma el alto de cada renglón de más, y
 * la hoja se llena por alto acumulado.
 */
export const MEDIDA_REPORTE = {
  ...MEDIDA_PDF,
  columnasTarjetas: 2,
  filasTarjetas: 3,
  /** Entre tarjetas, a lo ancho y a lo alto. */
  separacion: 10,
  /** Colchón contra los redondeos del layout: sin él, la última fila podría saltar de hoja. */
  holgura: 2,
  rellenoTarjeta: 8,
  radio: 6,
  aireFoto: 12,
  /** Interlineado de los renglones: con el de Poppins por defecto no se dibujan. */
  interlineado: 1.25,
  altoIdArbol: 16,
  altoEspecie: 13,
  aireEspecie: 6,
  altoDato: 16,
  anchoEtiqueta: 62,
  /** Baja el rótulo, más chico que el valor, a la línea del valor. */
  aireSobreEtiqueta: 2,
  punto: { diametro: 7, aire: 4 },
  altoEncabezadoListado: 18,
  altoFilaListado: 14,
  rellenoCelda: 4,
  /** Ancho relativo de cada columna del listado. */
  pesoColumna: {
    idArbol: 18,
    especie: 18,
    parcela: 16,
    grupo: 16,
    posicion: 6,
    registrado: 8,
    gps: 18,
  },
} as const;

export const CUERPO_REPORTE = cuerpoDeHoja(ORIENTACION_HOJA.horizontal);

/** Lo que mide cada tarjeta para que entren justas en la grilla de la hoja. */
export const CAJA_TARJETA = {
  ancho:
    (CUERPO_REPORTE.ancho - MEDIDA_REPORTE.separacion * (MEDIDA_REPORTE.columnasTarjetas - 1)) /
    MEDIDA_REPORTE.columnasTarjetas,
  alto:
    (CUERPO_REPORTE.alto -
      MEDIDA_REPORTE.holgura -
      MEDIDA_REPORTE.separacion * (MEDIDA_REPORTE.filasTarjetas - 1)) /
    MEDIDA_REPORTE.filasTarjetas,
} as const;

/** La foto es cuadrada y ocupa todo el alto de la tarjeta, adentro del relleno y del borde. */
export const LADO_FOTO_TARJETA =
  CAJA_TARJETA.alto - 2 * (MEDIDA_REPORTE.rellenoTarjeta + MEDIDA_REPORTE.borde);

/** Lo que deja una columna del listado: los rellenos de las celdas salen antes de repartir a peso. */
export function anchoDeColumna(columna: keyof typeof MEDIDA_REPORTE.pesoColumna): number {
  const { pesoColumna, rellenoCelda } = MEDIDA_REPORTE;
  const pesos = Object.values(pesoColumna);
  const libre = CUERPO_REPORTE.ancho - 2 * rellenoCelda * pesos.length;
  return (libre * pesoColumna[columna]) / pesos.reduce((suma, peso) => suma + peso, 0);
}

/** Lo que queda al lado de la foto, adentro del relleno y del borde de la tarjeta. */
export const ANCHO_DATOS_TARJETA =
  CAJA_TARJETA.ancho -
  2 * (MEDIDA_REPORTE.rellenoTarjeta + MEDIDA_REPORTE.borde) -
  LADO_FOTO_TARJETA -
  MEDIDA_REPORTE.aireFoto;

const ANCHO_PUNTO = anchoDePunto(MEDIDA_REPORTE.punto);

const ANCHO_VALOR_TARJETA = ANCHO_DATOS_TARJETA - MEDIDA_REPORTE.anchoEtiqueta;

/**
 * Ancho en pt de los renglones del reporte que se parten o se cortan antes del
 * render (#876). En parcela y grupo, el primero lleva también el código.
 */
export const ANCHO_TEXTO_REPORTE = {
  listado: {
    idArbol: anchoDeColumna('idArbol'),
    especie: anchoDeColumna('especie') - ANCHO_PUNTO,
    parcela: anchoDeColumna('parcela'),
    grupo: anchoDeColumna('grupo'),
  },
  tarjeta: {
    idArbol: ANCHO_DATOS_TARJETA,
    especie: ANCHO_DATOS_TARJETA - ANCHO_PUNTO,
    parcela: ANCHO_VALOR_TARJETA,
    grupo: ANCHO_VALOR_TARJETA,
  },
} as const;

const altoDeRenglon = (tamano: number) => tamano * MEDIDA_REPORTE.interlineado;

/** Alto en pt de un renglón de cada letra del reporte: lo que suma cada renglón de más. */
export const ALTO_RENGLON_REPORTE = {
  fila: altoDeRenglon(LETRA_REPORTE.fila.fontSize),
  idTarjeta: altoDeRenglon(LETRA_REPORTE.idTarjeta.fontSize),
  especieTarjeta: altoDeRenglon(LETRA_REPORTE.especieTarjeta.fontSize),
  dato: altoDeRenglon(LETRA_REPORTE.dato.fontSize),
  etiqueta: altoDeRenglon(TAMANO_TEXTO.etiqueta),
} as const;

/**
 * Lo que queda arriba de un renglón centrado en `alto`. Los bloques van
 * arriba, con este aire: un texto de un renglón queda donde quedaba centrado,
 * y uno de más crece hacia abajo.
 */
export const aireCentrado = (alto: number, altoRenglon: number) => (alto - altoRenglon) / 2;

/** El alto de una caja con un renglón, más el de cada renglón de más. */
export const altoConRenglones = (altoDeUno: number, altoRenglon: number, renglones: number) =>
  altoDeUno + (renglones - 1) * altoRenglon;
