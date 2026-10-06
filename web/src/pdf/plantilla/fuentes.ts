import { Font } from '@react-pdf/renderer';
import { ESTILO_FUENTE, FUENTE_PDF, PESO_FUENTE } from './tokens';

/** Cada archivo de fuente que usa el PDF. react-pdf lee OTF, TTF y WOFF, no WOFF2. */
const VARIANTES = [
  { archivo: 'biolinum', familia: FUENTE_PDF.titulo, peso: PESO_FUENTE.regular },
  { archivo: 'biolinumBold', familia: FUENTE_PDF.titulo, peso: PESO_FUENTE.bold },
  { archivo: 'poppins', familia: FUENTE_PDF.cuerpo, peso: PESO_FUENTE.regular },
  {
    archivo: 'poppinsItalica',
    familia: FUENTE_PDF.cuerpo,
    peso: PESO_FUENTE.regular,
    estilo: ESTILO_FUENTE.italica,
  },
  { archivo: 'poppinsMedio', familia: FUENTE_PDF.cuerpo, peso: PESO_FUENTE.medio },
  { archivo: 'poppinsSemibold', familia: FUENTE_PDF.cuerpo, peso: PESO_FUENTE.semibold },
  { archivo: 'poppinsBold', familia: FUENTE_PDF.cuerpo, peso: PESO_FUENTE.bold },
  { archivo: 'plexMono', familia: FUENTE_PDF.mono, peso: PESO_FUENTE.regular },
  { archivo: 'plexMonoMedio', familia: FUENTE_PDF.mono, peso: PESO_FUENTE.medio },
] as const;

type Variante = (typeof VARIANTES)[number];

export type ArchivoFuente = Variante['archivo'];

/** URL (navegador) o ruta (Node) de cada archivo de fuente. */
export type ArchivosFuentes = Record<ArchivoFuente, string>;

const FAMILIAS = Object.values(FUENTE_PDF);

let registradas = false;

/** Registra las familias una sola vez: react-pdf acumula registros si se repite. */
export function registrarFuentes(archivos: ArchivosFuentes): void {
  if (registradas) return;
  for (const familia of FAMILIAS) {
    const fonts = VARIANTES.filter((variante) => variante.familia === familia).map(
      (variante: Variante) => ({
        src: archivos[variante.archivo],
        fontWeight: variante.peso,
        fontStyle: 'estilo' in variante ? variante.estilo : ESTILO_FUENTE.normal,
      }),
    );
    Font.register({ family: familia, fonts });
  }
  // Sin guiones automáticos: cortarían IDs y nombres propios.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  registradas = true;
}
