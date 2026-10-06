/*
 * Raster del mapa de puntos: con miles de árboles, una imagen pesa y tarda menos en
 * el PDF que un círculo vectorial por árbol.
 */
import { contexto2d, crearCanvas, exportarYLiberar, liberarCanvas } from '../canvas';
import { COLOR_PDF, FUENTE_PDF, PESO_FUENTE } from '../plantilla/tokens';
import {
  planificarMapa,
  type ContenidoMapa,
  type EtiquetaUbicada,
  type PlanMapa,
  type PuntoUbicado,
} from './planMapa';
import type { Encuadre } from './proyeccion';

/**
 * Una imagen lista para ir sobre el fondo liso y debajo de los puntos. El
 * contexto ya está escalado a pt; `escalaRender` dice cuántos px reales hay por
 * pt. `liberar` suelta la imagen se haya pintado o no.
 */
export type FondoListo = {
  pintar: (contexto: CanvasRenderingContext2D, escalaRender: number) => void;
  liberar: () => void;
};

/** Prepara la imagen del encuadre (#757: satélite); null si no se pudo y el mapa sale liso. */
export type CapaFondo = (encuadre: Encuadre) => Promise<FondoListo | null>;

export type OpcionesMapa = ContenidoMapa & {
  /** px por pt del PNG: 2,5 da nitidez de impresión sin inflar el archivo. */
  escalaRender?: number;
  /** Radio de los puntos en pt: más chico cuanto más denso el mapa. */
  radioPunto?: number;
  fondo?: CapaFondo;
  /** Sin fondo, PNG por defecto; JPEG achica el archivo de un mapa grande. Con fondo, siempre JPEG. */
  formato?: FormatoMapa;
};

/** `conFondo`: la capa de fondo se pintó; si no, el mapa salió liso. */
export type MapaDibujado = { src: string; conFondo: boolean };

/** Tipo de imagen del mapa, con la calidad si comprime con pérdida. */
export type FormatoMapa = { tipo: string; calidad?: number };

export const FORMATO_MAPA = {
  png: { tipo: 'image/png' },
  jpeg: { tipo: 'image/jpeg', calidad: 0.85 },
} as const satisfies Record<string, FormatoMapa>;

const ESCALA_RENDER = 2.5;
const VUELTA = Math.PI * 2;

/** Medidas en pt. */
const ESTILO_MAPA = {
  pasoGrilla: 16,
  grosorGrilla: 0.4,
  radioPunto: 1.4,
  bordePunto: 0.3,
  radioAnillo: 5,
  grosorAnillo: 1,
  radioResaltado: 2.4,
  bordeResaltado: 0.9,
  rellenoInsignia: 3,
  margen: 6,
  letra: 5,
  letraEtiqueta: 7,
  rellenoEtiqueta: { vertical: 1.5, horizontal: 3 },
  radioEtiqueta: 2,
  topeEscala: 1.5,
  grosorEscala: 0.7,
  radioNorte: 6,
  letraNorte: 3.6,
  /** Alturas relativas al centro de la insignia: la N arriba, la flecha abajo. */
  alturaLetraNorte: -3.3,
  flechaNorte: { medioAncho: 2, punta: -1, muesca: 3, base: 4 },
} as const;

const LETRA_NORTE = 'N';

/** Colores de lo que va sobre el fondo: sobre una imagen, insignias oscuras y texto blanco. */
type TemaMapa = {
  insignia: string;
  insigniaEtiqueta: string;
  tinta: string;
  textoEtiqueta: string;
  anillo: string;
  opacidadPunto: number;
};

const TEMA_MAPA = {
  liso: {
    insignia: COLOR_PDF.mapaInsignia,
    insigniaEtiqueta: COLOR_PDF.mapaInsignia,
    tinta: COLOR_PDF.cuerpo,
    textoEtiqueta: COLOR_PDF.navy,
    anillo: COLOR_PDF.navy,
    opacidadPunto: 0.85,
  },
  sobreImagen: {
    insignia: COLOR_PDF.mapaVeloInsignia,
    insigniaEtiqueta: COLOR_PDF.mapaVeloEtiqueta,
    tinta: COLOR_PDF.blanco,
    textoEtiqueta: COLOR_PDF.blanco,
    // Blanco: el navy se pierde sobre el monte oscuro.
    anillo: COLOR_PDF.blanco,
    opacidadPunto: 0.95,
  },
} as const satisfies Record<string, TemaMapa>;

function pintarFondoLiso(contexto: CanvasRenderingContext2D, { ancho, alto }: Encuadre) {
  contexto.fillStyle = COLOR_PDF.mapaFondo;
  contexto.fillRect(0, 0, ancho, alto);
  contexto.strokeStyle = COLOR_PDF.mapaGrilla;
  contexto.lineWidth = ESTILO_MAPA.grosorGrilla;
  contexto.beginPath();
  for (let x = ESTILO_MAPA.pasoGrilla; x < ancho; x += ESTILO_MAPA.pasoGrilla) {
    contexto.moveTo(x, 0);
    contexto.lineTo(x, alto);
  }
  for (let y = ESTILO_MAPA.pasoGrilla; y < alto; y += ESTILO_MAPA.pasoGrilla) {
    contexto.moveTo(0, y);
    contexto.lineTo(ancho, y);
  }
  contexto.stroke();
}

function circulo(contexto: CanvasRenderingContext2D, { x, y }: PuntoUbicado, radio: number) {
  contexto.beginPath();
  contexto.arc(x, y, radio, 0, VUELTA);
}

function pintarPuntos(
  contexto: CanvasRenderingContext2D,
  puntos: PuntoUbicado[],
  radio: number,
  opacidad: number,
) {
  contexto.strokeStyle = COLOR_PDF.blanco;
  contexto.lineWidth = ESTILO_MAPA.bordePunto;
  for (const punto of puntos) {
    circulo(contexto, punto, radio);
    contexto.globalAlpha = opacidad;
    contexto.fillStyle = punto.color;
    contexto.fill();
    contexto.globalAlpha = 1;
    contexto.stroke();
  }
}

function pintarResaltado(contexto: CanvasRenderingContext2D, punto: PuntoUbicado, anillo: string) {
  circulo(contexto, punto, ESTILO_MAPA.radioAnillo);
  contexto.strokeStyle = anillo;
  contexto.lineWidth = ESTILO_MAPA.grosorAnillo;
  contexto.stroke();
  circulo(contexto, punto, ESTILO_MAPA.radioResaltado);
  contexto.fillStyle = punto.color;
  contexto.fill();
  contexto.strokeStyle = COLOR_PDF.blanco;
  contexto.lineWidth = ESTILO_MAPA.bordeResaltado;
  contexto.stroke();
}

function fuente(peso: number, tamano: number, familia: string): string {
  return `${peso} ${tamano}px "${familia}"`;
}

const FUENTES_DEL_MAPA = [
  fuente(PESO_FUENTE.medio, ESTILO_MAPA.letra, FUENTE_PDF.cuerpo),
  fuente(PESO_FUENTE.semibold, ESTILO_MAPA.letraNorte, FUENTE_PDF.cuerpo),
  fuente(PESO_FUENTE.medio, ESTILO_MAPA.letraEtiqueta, FUENTE_PDF.mono),
];

/** Las fuentes de la página cargan recién cuando algo las usa: el canvas no espera solo. */
async function esperarFuentes(): Promise<void> {
  try {
    await Promise.all(FUENTES_DEL_MAPA.map((descriptor) => document.fonts.load(descriptor)));
  } catch {
    // Con la fuente de respaldo el mapa se lee igual.
  }
}

/** Insignia detrás de la etiqueta: sobre los puntos, el texto solo no se lee. */
function pintarInsignia(
  contexto: CanvasRenderingContext2D,
  { x, y, texto }: EtiquetaUbicada,
  color: string,
) {
  const { letraEtiqueta: letra, rellenoEtiqueta: relleno } = ESTILO_MAPA;
  const ancho = contexto.measureText(texto).width + relleno.horizontal * 2;
  const alto = letra + relleno.vertical * 2;
  contexto.fillStyle = color;
  contexto.beginPath();
  contexto.roundRect(x - ancho / 2, y - alto / 2, ancho, alto, ESTILO_MAPA.radioEtiqueta);
  contexto.fill();
}

function pintarEtiquetas(
  contexto: CanvasRenderingContext2D,
  { etiquetas }: PlanMapa,
  tema: TemaMapa,
) {
  contexto.font = fuente(PESO_FUENTE.medio, ESTILO_MAPA.letraEtiqueta, FUENTE_PDF.mono);
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  for (const etiqueta of etiquetas) {
    pintarInsignia(contexto, etiqueta, tema.insigniaEtiqueta);
    contexto.fillStyle = tema.textoEtiqueta;
    contexto.fillText(etiqueta.texto, etiqueta.x, etiqueta.y);
  }
}

type Trazo = { desde: number; largo: number; y: number; tinta: string };

function pintarBarra(contexto: CanvasRenderingContext2D, { desde, largo, y, tinta }: Trazo) {
  const { topeEscala } = ESTILO_MAPA;
  contexto.strokeStyle = tinta;
  contexto.lineWidth = ESTILO_MAPA.grosorEscala;
  contexto.beginPath();
  contexto.moveTo(desde, y - topeEscala);
  contexto.lineTo(desde, y);
  contexto.lineTo(desde + largo, y);
  contexto.lineTo(desde + largo, y - topeEscala);
  contexto.stroke();
}

/** Abajo a la izquierda: barra con topes y la distancia a la derecha, sobre una insignia. */
function pintarEscala(
  contexto: CanvasRenderingContext2D,
  { escala, encuadre }: PlanMapa,
  tema: TemaMapa,
) {
  const { margen, letra, rellenoInsignia: relleno } = ESTILO_MAPA;
  contexto.font = fuente(PESO_FUENTE.medio, letra, FUENTE_PDF.cuerpo);
  const anchoTexto = contexto.measureText(escala.texto).width;
  const y = encuadre.alto - margen - letra / 2;
  contexto.fillStyle = tema.insignia;
  const anchoInsignia = escala.largo + anchoTexto + relleno * 3;
  contexto.fillRect(margen - relleno, y - letra, anchoInsignia, letra * 2);
  pintarBarra(contexto, { desde: margen, largo: escala.largo, y, tinta: tema.tinta });
  contexto.fillStyle = tema.tinta;
  contexto.textAlign = 'left';
  contexto.textBaseline = 'middle';
  contexto.fillText(escala.texto, margen + escala.largo + relleno, y);
}

/** Con el color de relleno ya puesto: la N usa el mismo. */
function pintarFlecha(contexto: CanvasRenderingContext2D, cx: number, cy: number) {
  const { medioAncho, punta, muesca, base } = ESTILO_MAPA.flechaNorte;
  contexto.beginPath();
  contexto.moveTo(cx, cy + punta);
  contexto.lineTo(cx + medioAncho, cy + base);
  contexto.lineTo(cx, cy + muesca);
  contexto.lineTo(cx - medioAncho, cy + base);
  contexto.closePath();
  contexto.fill();
}

/** Arriba a la derecha: flecha al norte con la N encima, sobre una insignia redonda. */
function pintarNorte(contexto: CanvasRenderingContext2D, { ancho }: Encuadre, tema: TemaMapa) {
  const { radioNorte: radio, margen } = ESTILO_MAPA;
  const cx = ancho - margen - radio;
  const cy = margen + radio;
  contexto.beginPath();
  contexto.arc(cx, cy, radio, 0, VUELTA);
  contexto.fillStyle = tema.insignia;
  contexto.fill();
  contexto.fillStyle = tema.tinta;
  pintarFlecha(contexto, cx, cy);
  contexto.font = fuente(PESO_FUENTE.semibold, ESTILO_MAPA.letraNorte, FUENTE_PDF.cuerpo);
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  contexto.fillText(LETRA_NORTE, cx, cy + ESTILO_MAPA.alturaLetraNorte);
}

/** Puntos, árbol resaltado, etiquetas, escala y norte, con los colores del tema. */
function pintarEncima(
  contexto: CanvasRenderingContext2D,
  plan: PlanMapa,
  { radioPunto = ESTILO_MAPA.radioPunto }: OpcionesMapa,
  tema: TemaMapa,
) {
  pintarPuntos(contexto, plan.puntos, radioPunto, tema.opacidadPunto);
  if (plan.resaltado) pintarResaltado(contexto, plan.resaltado, tema.anillo);
  pintarEtiquetas(contexto, plan, tema);
  pintarEscala(contexto, plan, tema);
  pintarNorte(contexto, plan.encuadre, tema);
}

/** Una imagen de fondo comprime mal en PNG: con fondo, el mapa sale en JPEG. */
function formatoDe({ formato = FORMATO_MAPA.png }: OpcionesMapa, conFondo: boolean): FormatoMapa {
  return conFondo ? FORMATO_MAPA.jpeg : formato;
}

/** El fondo liso y, encima, la imagen si la hay; si pintarla falla, queda el liso solo. */
function pintarFondos(
  contexto: CanvasRenderingContext2D,
  encuadre: Encuadre,
  fondo: FondoListo | null,
  escalaRender: number,
): boolean {
  pintarFondoLiso(contexto, encuadre);
  if (!fondo) return false;
  try {
    fondo.pintar(contexto, escalaRender);
    return true;
  } catch {
    pintarFondoLiso(contexto, encuadre);
    return false;
  }
}

function rasterizar(plan: PlanMapa, opciones: OpcionesMapa, fondo: FondoListo | null) {
  const escalaRender = opciones.escalaRender ?? ESCALA_RENDER;
  const canvas = crearCanvas(opciones.ancho * escalaRender, opciones.alto * escalaRender);
  try {
    const contexto = contexto2d(canvas);
    contexto.scale(escalaRender, escalaRender);
    const conFondo = pintarFondos(contexto, plan.encuadre, fondo, escalaRender);
    pintarEncima(contexto, plan, opciones, conFondo ? TEMA_MAPA.sobreImagen : TEMA_MAPA.liso);
    const { tipo, calidad } = formatoDe(opciones, conFondo);
    return { src: exportarYLiberar(canvas, tipo, calidad), conFondo };
  } finally {
    liberarCanvas(canvas);
  }
}

/** Imagen del mapa como data URL; null si no hay ningún punto que mostrar. */
export async function dibujarMapa(opciones: OpcionesMapa): Promise<MapaDibujado | null> {
  const plan = planificarMapa(opciones);
  if (!plan) return null;
  const [fondo] = await Promise.all([opciones.fondo?.(plan.encuadre) ?? null, esperarFuentes()]);
  try {
    return rasterizar(plan, opciones, fondo);
  } finally {
    fondo?.liberar();
  }
}
