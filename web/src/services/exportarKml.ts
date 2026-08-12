/*
 * Genera un archivo KML con los puntos GPS de los árboles de una plantación,
 * importable en Google Maps / Google Earth. La construcción del XML es una
 * función pura y testeable (`construirKml`); la descarga usa un helper aparte.
 *
 * Color por especie: reutiliza el ÚNICO mapeo código→color de la app
 * (`colorEspeciePorCodigo`), el mismo que pinta el mapa Leaflet y el dashboard,
 * para que los puntos en Earth coincidan con los de la web. El hex #rrggbb se
 * traduce al formato KML `aabbggrr` (alfa + BGR).
 */
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from '../queries/especiesConstantes';
import type { PuntoGps } from '../queries/mapaQueries';
import { colorEspeciePorCodigo } from '../theme/coloresEspecie';
import { nombreArchivoDescarga } from './descargas';

/** MIME de KML; extensión del archivo descargado. */
export const TIPO_MIME_KML = 'application/vnd.google-earth.kml+xml';
const EXTENSION_KML = 'kml';

/** Opacidad total en el byte alfa del color KML (aabbggrr). */
const ALFA_KML_OPACO = 'ff';

export type OpcionesKml = {
  /** `<name>` del documento raíz (título visible en Earth). */
  nombreDocumento: string;
};

/** Escapa los caracteres reservados de XML en texto libre (nombres/descripciones). */
function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** #rrggbb → color KML `aabbggrr` (alfa opaco + azul/verde/rojo). */
function hexAColorKml(hex: string): string {
  const rgb = hex.replace('#', '');
  const rojo = rgb.slice(0, 2);
  const verde = rgb.slice(2, 4);
  const azul = rgb.slice(4, 6);
  return `${ALFA_KML_OPACO}${azul}${verde}${rojo}`;
}

/** id de `<Style>` estable y XML-safe derivado del código de especie. */
function idEstilo(codigo: string): string {
  const seguro = codigo.replace(/[^a-zA-Z0-9]/g, '-') || ESPECIE_SIN_IDENTIFICAR;
  return `especie-${seguro}`;
}

type GrupoEspecie = { codigo: string; nombre: string; puntos: PuntoGps[] };

/** Agrupa los puntos por código de especie, preservando el orden de aparición. */
function agruparPorEspecie(puntos: PuntoGps[]): GrupoEspecie[] {
  const grupos = new Map<string, GrupoEspecie>();
  for (const punto of puntos) {
    const grupo = grupos.get(punto.codigo);
    if (grupo) grupo.puntos.push(punto);
    else grupos.set(punto.codigo, { codigo: punto.codigo, nombre: punto.nombre, puntos: [punto] });
  }
  return [...grupos.values()];
}

/** `<Style>` con el color de la especie aplicado al ícono del punto. */
function bloqueEstilo(grupo: GrupoEspecie): string {
  const color = hexAColorKml(colorEspeciePorCodigo(grupo.codigo));
  return `    <Style id="${idEstilo(grupo.codigo)}">
      <IconStyle><color>${color}</color></IconStyle>
    </Style>`;
}

/** `<Placemark>` de un árbol: nombre de especie + punto en orden lng,lat,0. */
function bloquePlacemark(punto: PuntoGps, styleId: string): string {
  return `      <Placemark>
        <name>${escaparXml(punto.nombre)}</name>
        <description>${escaparXml(punto.codigo)}</description>
        <styleUrl>#${styleId}</styleUrl>
        <Point><coordinates>${punto.lng},${punto.lat},0</coordinates></Point>
      </Placemark>`;
}

/** `<Folder>` por especie con un placemark por árbol. */
function bloqueCarpeta(grupo: GrupoEspecie): string {
  const styleId = idEstilo(grupo.codigo);
  const nombre = grupo.codigo === ESPECIE_SIN_IDENTIFICAR ? NOMBRE_SIN_IDENTIFICAR : grupo.nombre;
  const placemarks = grupo.puntos.map((punto) => bloquePlacemark(punto, styleId)).join('\n');
  return `    <Folder>
      <name>${escaparXml(nombre)}</name>
${placemarks}
    </Folder>`;
}

/**
 * KML válido con un `<Placemark>` por árbol, agrupados en un `<Folder>` por
 * especie y coloreados con el color estable de cada especie. Función pura:
 * mismos puntos → misma cadena, sin efectos de red ni de DOM.
 */
export function construirKml(puntos: PuntoGps[], opciones: OpcionesKml): string {
  const grupos = agruparPorEspecie(puntos);
  const estilos = grupos.map(bloqueEstilo).join('\n');
  const carpetas = grupos.map(bloqueCarpeta).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escaparXml(opciones.nombreDocumento)}</name>
${estilos}
${carpetas}
  </Document>
</kml>`;
}

/** Nombre de archivo descriptivo: `puntos-gps-<lugar>-<periodo>.kml`. */
export function nombreArchivoKml(lugar: string, periodo: string): string {
  return nombreArchivoDescarga('puntos-gps', lugar, periodo, EXTENSION_KML);
}
