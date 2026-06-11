/**
 * Mapa especie → estilo KML. ÚNICO lugar que decide cómo se ve una especie en
 * el export: para migrar a íconos por especie (KMZ con PNGs empaquetados) solo
 * se cambia este módulo (el <Style> pasaría de color a <Icon><href> propio).
 */

/** Colores KML en formato aabbggrr (alpha-blue-green-red), opacos. */
const KML_COLOR_PALETTE = [
  'ff0000ff', // rojo
  'ff00aa00', // verde
  'ffff0000', // azul
  'ff00aaff', // naranja
  'ffff00aa', // violeta
  'ff00ffff', // amarillo
  'ffffaa00', // celeste
  'ff8800aa', // bordó
  'ff88ff00', // turquesa
  'ffaaaaff', // rosa
];

/** Ícono blanco tintable de Google Earth (el <color> del IconStyle lo pinta). */
const PLACEMARK_ICON_HREF = 'http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png';

/** Hash determinístico simple: misma especie → mismo color en todo export. */
function hashToPaletteIndex(especieNombre: string): number {
  let hash = 0;
  for (const char of especieNombre) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash % KML_COLOR_PALETTE.length;
}

/** Id de <Style> válido y estable para la especie (sin espacios/acentos). */
export function getSpeciesStyleId(especieNombre: string): string {
  const slug = especieNombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
  return `especie-${slug}`;
}

/** Bloques <Style> compartidos (uno por especie, no uno por placemark). */
export function buildSpeciesStyles(especies: string[]): string {
  return especies
    .map((especie) => {
      const color = KML_COLOR_PALETTE[hashToPaletteIndex(especie)];
      return [
        `    <Style id="${getSpeciesStyleId(especie)}">`,
        '      <IconStyle>',
        `        <color>${color}</color>`,
        `        <Icon><href>${PLACEMARK_ICON_HREF}</href></Icon>`,
        '      </IconStyle>',
        '    </Style>',
      ].join('\n');
    })
    .join('\n');
}
