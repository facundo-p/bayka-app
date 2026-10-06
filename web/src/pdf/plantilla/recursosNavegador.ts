/*
 * Dónde encuentra el navegador las fuentes y el logo del PDF. Vite emite los WOFF
 * de Poppins (@fontsource) como assets propios; el resto sale de `public/`.
 * IBM Plex Mono va en TTF, convertido del WOFF de @fontsource con fonttools: el
 * lector de WOFF de react-pdf falla con los glifos vacíos de ese archivo, como
 * el espacio.
 */
import poppins from '@fontsource/poppins/files/poppins-latin-400-normal.woff?url';
import poppinsItalica from '@fontsource/poppins/files/poppins-latin-400-italic.woff?url';
import poppinsMedio from '@fontsource/poppins/files/poppins-latin-500-normal.woff?url';
import poppinsSemibold from '@fontsource/poppins/files/poppins-latin-600-normal.woff?url';
import poppinsBold from '@fontsource/poppins/files/poppins-latin-700-normal.woff?url';
import type { ArchivosFuentes } from './fuentes';

const RUTA_PUBLICA = {
  biolinum: '/fonts/LinBiolinum_R.otf',
  biolinumBold: '/fonts/LinBiolinum_RB.otf',
  plexMono: '/fonts/ibm-plex-mono-latin-400-normal.ttf',
  plexMonoMedio: '/fonts/ibm-plex-mono-latin-500-normal.ttf',
  logo: '/logo-bayka.png',
} as const;

/** react-pdf baja los recursos con fetch: la URL va absoluta. */
function absoluta(ruta: string): string {
  return new URL(ruta, window.location.origin).href;
}

export function archivosFuentesNavegador(): ArchivosFuentes {
  return {
    biolinum: absoluta(RUTA_PUBLICA.biolinum),
    biolinumBold: absoluta(RUTA_PUBLICA.biolinumBold),
    poppins: absoluta(poppins),
    poppinsItalica: absoluta(poppinsItalica),
    poppinsMedio: absoluta(poppinsMedio),
    poppinsSemibold: absoluta(poppinsSemibold),
    poppinsBold: absoluta(poppinsBold),
    plexMono: absoluta(RUTA_PUBLICA.plexMono),
    plexMonoMedio: absoluta(RUTA_PUBLICA.plexMonoMedio),
  };
}

export function logoNavegador(): string {
  return absoluta(RUTA_PUBLICA.logo);
}
