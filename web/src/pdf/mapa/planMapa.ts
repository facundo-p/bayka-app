import { barraDeEscala, type BarraEscala } from './escala';
import { encuadrar, proyectar, type Encuadre, type LatLng, type Pixel } from './proyeccion';

export type PuntoMapa = LatLng & { color: string };
export type EtiquetaMapa = LatLng & { texto: string };

/** Lo que va en el mapa, en pt. */
export type ContenidoMapa = {
  puntos: readonly PuntoMapa[];
  /** El árbol de la ficha: va encima de todo, con un anillo. */
  resaltado?: PuntoMapa;
  /** Textos sobre el mapa, ej. el código de cada parcela. */
  etiquetas?: readonly EtiquetaMapa[];
  ancho: number;
  alto: number;
  /** Aire mínimo entre lo encuadrado y el borde, en pt; por defecto `ENCUADRE_MAPA.margenPt`. */
  margen?: number;
};

export type PuntoUbicado = Pixel & { color: string };
export type EtiquetaUbicada = Pixel & { texto: string };

export type PlanMapa = {
  encuadre: Encuadre;
  puntos: PuntoUbicado[];
  resaltado: PuntoUbicado | null;
  etiquetas: EtiquetaUbicada[];
  escala: BarraEscala;
};

export const ENCUADRE_MAPA = {
  margenPt: 10,
  /** Un árbol solo se ve con unos 60 m alrededor, no a zoom de calle. */
  minimoMetros: 60,
  /** La barra de escala ocupa a lo sumo un tercio del ancho. */
  fraccionEscala: 1 / 3,
} as const;

function todasLasPosiciones(contenido: ContenidoMapa): LatLng[] {
  const { puntos, resaltado, etiquetas = [] } = contenido;
  return [...puntos, ...(resaltado ? [resaltado] : []), ...etiquetas];
}

/** Encuadre, posiciones y escala, sin dibujar nada; null si no hay nada que ubicar. */
export function planificarMapa(contenido: ContenidoMapa): PlanMapa | null {
  const posiciones = todasLasPosiciones(contenido);
  if (posiciones.length === 0) return null;
  const encuadre = encuadrar(posiciones, contenido.ancho, contenido.alto, {
    margen: contenido.margen ?? ENCUADRE_MAPA.margenPt,
    minimoMetros: ENCUADRE_MAPA.minimoMetros,
  });
  const ubicar = (punto: PuntoMapa) => ({ ...proyectar(encuadre, punto), color: punto.color });
  return {
    encuadre,
    puntos: contenido.puntos.map(ubicar),
    resaltado: contenido.resaltado ? ubicar(contenido.resaltado) : null,
    etiquetas: (contenido.etiquetas ?? []).map((etiqueta) => ({
      ...proyectar(encuadre, etiqueta),
      texto: etiqueta.texto,
    })),
    escala: barraDeEscala(encuadre, contenido.ancho * ENCUADRE_MAPA.fraccionEscala),
  };
}
