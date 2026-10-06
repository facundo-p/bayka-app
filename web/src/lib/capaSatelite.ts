const SERVICIO = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';

/**
 * Imagen satelital del mapa de la web y de los PDF (#757): Esri World Imagery,
 * sin API key y con CORS `*`. Los términos piden la atribución junto al mapa.
 */
export const CAPA_SATELITE = {
  url: `${SERVICIO}/tile/{z}/{y}/{x}`,
  /** Qué tiles de un rectángulo tienen imagen: donde no hay, Esri sirve un tile gris. */
  urlDisponibilidad: `${SERVICIO}/tilemap/{z}/{y}/{x}/{ancho}/{alto}`,
  atribucion: 'Imágenes © Esri, Maxar',
  zoomMaximo: 19,
} as const;
