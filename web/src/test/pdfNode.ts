import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ArchivosFuentes } from '../pdf/plantilla/fuentes';

/*
 * Recursos para renderizar PDF en node: rutas de archivo en lugar de las URL
 * del navegador. Los tests de documentos van con `@vitest-environment node`.
 */

const WEB = `${resolve(__dirname, '../..')}/`;
const POPPINS = `${WEB}node_modules/@fontsource/poppins/files/poppins-latin`;

export const FUENTES_NODE: ArchivosFuentes = {
  biolinum: `${WEB}public/fonts/LinBiolinum_R.otf`,
  biolinumBold: `${WEB}public/fonts/LinBiolinum_RB.otf`,
  poppins: `${POPPINS}-400-normal.woff`,
  poppinsItalica: `${POPPINS}-400-italic.woff`,
  poppinsMedio: `${POPPINS}-500-normal.woff`,
  poppinsSemibold: `${POPPINS}-600-normal.woff`,
  poppinsBold: `${POPPINS}-700-normal.woff`,
  plexMono: `${WEB}public/fonts/ibm-plex-mono-latin-400-normal.ttf`,
  plexMonoMedio: `${WEB}public/fonts/ibm-plex-mono-latin-500-normal.ttf`,
};

export const LOGO_NODE = `${WEB}public/logo-bayka.png`;

/** Una imagen cualquiera como data URL, para fotos y mapas ya rasterizados. */
export const PNG_DE_PRUEBA = `data:image/png;base64,${readFileSync(LOGO_NODE).toString('base64')}`;

export function paginasDelPdf(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
}
