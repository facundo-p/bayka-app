/*
 * Raster del mapa de puntos: con miles de árboles, un PNG pesa y tarda menos en
 * el PDF que un círculo vectorial por árbol.
 */
import { contexto2d, crearCanvas } from '../canvas';
import { COLOR_PDF, FUENTE_PDF, PESO_FUENTE } from '../plantilla/tokens';
import { planificarMapa, type ContenidoMapa, type PlanMapa, type PuntoUbicado } from './planMapa';
import type { Encuadre } from './proyeccion';

/**
 * Capa que se pinta sobre el fondo liso y debajo de los puntos (#757: satélite).
 * El contexto ya está escalado a pt; `escalaRender` dice cuántos px reales hay por pt.
 */
export type CapaFondo = (
  contexto: CanvasRenderingContext2D,
  encuadre: Encuadre,
  escalaRender: number,
) => Promise<void>;

export type OpcionesMapa = ContenidoMapa & {
  /** px por pt del PNG: 2,5 da nitidez de impresión sin inflar el archivo. */
  escalaRender?: number;
  /** Radio de los puntos en pt: más chico cuanto más denso el mapa. */
  radioPunto?: number;
  fondo?: CapaFondo;
};

const ESCALA_RENDER = 2.5;
const TIPO_PNG = 'image/png';
const VUELTA = Math.PI * 2;

/** Medidas en pt. */
const ESTILO_MAPA = {
  pasoGrilla: 16,
  grosorGrilla: 0.4,
  radioPunto: 1.4,
  bordePunto: 0.3,
  opacidadPunto: 0.85,
  radioAnillo: 5,
  grosorAnillo: 1,
  radioResaltado: 2.4,
  bordeResaltado: 0.9,
  rellenoInsignia: 3,
  margen: 6,
  letra: 5,
  letraEtiqueta: 6,
  topeEscala: 1.5,
  grosorEscala: 0.7,
  radioNorte: 6,
  letraNorte: 3.6,
  /** Alturas relativas al centro de la insignia: la N arriba, la flecha abajo. */
  alturaLetraNorte: -3.3,
  flechaNorte: { medioAncho: 2, punta: -1, muesca: 3, base: 4 },
} as const;

const LETRA_NORTE = 'N';

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

function pintarPuntos(contexto: CanvasRenderingContext2D, puntos: PuntoUbicado[], radio: number) {
  contexto.strokeStyle = COLOR_PDF.blanco;
  contexto.lineWidth = ESTILO_MAPA.bordePunto;
  for (const punto of puntos) {
    circulo(contexto, punto, radio);
    contexto.globalAlpha = ESTILO_MAPA.opacidadPunto;
    contexto.fillStyle = punto.color;
    contexto.fill();
    contexto.globalAlpha = 1;
    contexto.stroke();
  }
}

function pintarResaltado(contexto: CanvasRenderingContext2D, punto: PuntoUbicado) {
  circulo(contexto, punto, ESTILO_MAPA.radioAnillo);
  contexto.strokeStyle = COLOR_PDF.navy;
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

function pintarEtiquetas(contexto: CanvasRenderingContext2D, { etiquetas }: PlanMapa) {
  contexto.font = fuente(PESO_FUENTE.medio, ESTILO_MAPA.letraEtiqueta, FUENTE_PDF.mono);
  contexto.fillStyle = COLOR_PDF.navy;
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  for (const { x, y, texto } of etiquetas) contexto.fillText(texto, x, y);
}

function pintarBarra(contexto: CanvasRenderingContext2D, desde: number, largo: number, y: number) {
  const { topeEscala } = ESTILO_MAPA;
  contexto.strokeStyle = COLOR_PDF.cuerpo;
  contexto.lineWidth = ESTILO_MAPA.grosorEscala;
  contexto.beginPath();
  contexto.moveTo(desde, y - topeEscala);
  contexto.lineTo(desde, y);
  contexto.lineTo(desde + largo, y);
  contexto.lineTo(desde + largo, y - topeEscala);
  contexto.stroke();
}

/** Abajo a la izquierda: barra con topes y la distancia a la derecha, sobre una insignia. */
function pintarEscala(contexto: CanvasRenderingContext2D, { escala, encuadre }: PlanMapa) {
  const { margen, letra, rellenoInsignia: relleno } = ESTILO_MAPA;
  contexto.font = fuente(PESO_FUENTE.medio, letra, FUENTE_PDF.cuerpo);
  const anchoTexto = contexto.measureText(escala.texto).width;
  const y = encuadre.alto - margen - letra / 2;
  contexto.fillStyle = COLOR_PDF.mapaInsignia;
  const anchoInsignia = escala.largo + anchoTexto + relleno * 3;
  contexto.fillRect(margen - relleno, y - letra, anchoInsignia, letra * 2);
  pintarBarra(contexto, margen, escala.largo, y);
  contexto.fillStyle = COLOR_PDF.cuerpo;
  contexto.textAlign = 'left';
  contexto.textBaseline = 'middle';
  contexto.fillText(escala.texto, margen + escala.largo + relleno, y);
}

function pintarFlecha(contexto: CanvasRenderingContext2D, cx: number, cy: number) {
  const { medioAncho, punta, muesca, base } = ESTILO_MAPA.flechaNorte;
  contexto.fillStyle = COLOR_PDF.cuerpo;
  contexto.beginPath();
  contexto.moveTo(cx, cy + punta);
  contexto.lineTo(cx + medioAncho, cy + base);
  contexto.lineTo(cx, cy + muesca);
  contexto.lineTo(cx - medioAncho, cy + base);
  contexto.closePath();
  contexto.fill();
}

/** Arriba a la derecha: flecha al norte con la N encima, sobre una insignia redonda. */
function pintarNorte(contexto: CanvasRenderingContext2D, { ancho }: Encuadre) {
  const { radioNorte: radio, margen } = ESTILO_MAPA;
  const cx = ancho - margen - radio;
  const cy = margen + radio;
  contexto.beginPath();
  contexto.arc(cx, cy, radio, 0, VUELTA);
  contexto.fillStyle = COLOR_PDF.mapaInsignia;
  contexto.fill();
  pintarFlecha(contexto, cx, cy);
  contexto.font = fuente(PESO_FUENTE.semibold, ESTILO_MAPA.letraNorte, FUENTE_PDF.cuerpo);
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  contexto.fillText(LETRA_NORTE, cx, cy + ESTILO_MAPA.alturaLetraNorte);
}

/** PNG del mapa como data URL; null si no hay ningún punto que mostrar. */
export async function dibujarMapa(opciones: OpcionesMapa): Promise<string | null> {
  const plan = planificarMapa(opciones);
  if (!plan) return null;
  const escalaRender = opciones.escalaRender ?? ESCALA_RENDER;
  const canvas = crearCanvas(opciones.ancho * escalaRender, opciones.alto * escalaRender);
  const contexto = contexto2d(canvas);
  contexto.scale(escalaRender, escalaRender);
  pintarFondoLiso(contexto, plan.encuadre);
  if (opciones.fondo) await opciones.fondo(contexto, plan.encuadre, escalaRender);
  pintarPuntos(contexto, plan.puntos, opciones.radioPunto ?? ESTILO_MAPA.radioPunto);
  if (plan.resaltado) pintarResaltado(contexto, plan.resaltado);
  pintarEtiquetas(contexto, plan);
  pintarEscala(contexto, plan);
  pintarNorte(contexto, plan.encuadre);
  return canvas.toDataURL(TIPO_PNG);
}
