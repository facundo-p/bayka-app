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

/** Hash determinístico simple: mismo styleId → mismo color en todo export. */
function hashToPaletteIndex(styleId: string): number {
  let hash = 0;
  for (const char of styleId) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash % KML_COLOR_PALETTE.length;
}

/** Id de <Style> válido y estable para la especie (sin espacios/acentos).
 *  Nombres que slugifican igual (p.ej. "Pino A" / "Pino-A") comparten id, y
 *  por eso el color se deriva del slug —no del nombre crudo— para que NUNCA
 *  queden dos <Style> con el mismo id y distinto color. */
export function getSpeciesStyleId(especieNombre: string): string {
  const slug = especieNombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `especie-${slug || 'sin-nombre'}`;
}

/** Bloques <Style> compartidos: uno por styleId (no por nombre ni por
 *  placemark), deduplicados para no emitir ids repetidos en el documento. */
export function buildSpeciesStyles(especies: string[]): string {
  const styleIds = [...new Set(especies.map(getSpeciesStyleId))];
  return styleIds
    .map((styleId) => {
      const color = KML_COLOR_PALETTE[hashToPaletteIndex(styleId)];
      return [
        `    <Style id="${styleId}">`,
        '      <IconStyle>',
        `        <color>${color}</color>`,
        `        <Icon><href>${PLACEMARK_ICON_HREF}</href></Icon>`,
        '      </IconStyle>',
        '    </Style>',
      ].join('\n');
    })
    .join('\n');
}
