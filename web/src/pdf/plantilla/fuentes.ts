import { Font } from '@react-pdf/renderer';
import { ESTILO_FUENTE, FUENTE_PDF, PESO_FUENTE } from './tokens';
import {
  dibujableEnTodas,
  saneadorDeTexto,
  sanearTextos,
  type FuenteConGlifos,
  type PilaDeFuentes,
} from './sanearTextos';

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

const estiloDe = (variante: Variante) =>
  'estilo' in variante ? variante.estilo : ESTILO_FUENTE.normal;

let registradas = false;

/**
 * fontkit guarda sin su carácter los glifos que un PDF usó como parte de otro
 * («.» en «·», «a» en «á»): el PDF siguiente los perdería. Solo las nuestras:
 * Helvetica, el respaldo de textkit, se lee una vez al cargar react-pdf y nadie
 * la relee; sin ella, un carácter que no tiene la fuente tira el PDF (#882).
 */
function descartarFuentesLeidas(): void {
  const fuentesRegistradas = Font.getRegisteredFonts();
  for (const familia of FAMILIAS) {
    for (const fuente of fuentesRegistradas[familia].sources) {
      fuente.data = null;
      fuente.loadResultPromise = null;
    }
  }
}

/**
 * Se llama antes de cada documento. Registra las familias una sola vez
 * (react-pdf acumula registros si se repite) y descarta las ya leídas.
 */
export function registrarFuentes(archivos: ArchivosFuentes): void {
  if (registradas) {
    descartarFuentesLeidas();
    return;
  }
  for (const familia of FAMILIAS) {
    const fonts = VARIANTES.filter((variante) => variante.familia === familia).map(
      (variante: Variante) => ({
        src: archivos[variante.archivo],
        fontWeight: variante.peso,
        fontStyle: estiloDe(variante),
      }),
    );
    Font.register({ family: familia, fonts });
  }
  // Sin guiones automáticos: cortarían IDs y nombres propios.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  registradas = true;
}

/** La letra de un renglón, con los nombres de sus propiedades de estilo. */
export type LetraDeRenglon = {
  fontFamily: string;
  fontWeight: number;
  fontStyle?: (typeof ESTILO_FUENTE)[keyof typeof ESTILO_FUENTE];
  fontSize: number;
};

/** Una fuente registrada, ya leída. */
export async function leerFuente({
  fontFamily,
  fontWeight,
  fontStyle,
}: Omit<LetraDeRenglon, 'fontSize'>) {
  const fuente = Font.getFont({ fontFamily, fontWeight, fontStyle });
  await fuente.load();
  return fuente.data!;
}

let enCurso: Promise<unknown> = Promise.resolve();

/** Un documento por vez: releer las fuentes en medio de otro render lo rompería. */
export function renderizarEnSerie<T>(
  archivos: ArchivosFuentes,
  renderizar: () => Promise<T>,
): Promise<T> {
  const turno = enCurso.then(() => {
    registrarFuentes(archivos);
    return renderizar();
  });
  enCurso = turno.catch(() => undefined);
  return turno;
}

/** La que @react-pdf/layout agrega al final de toda pila de fuentes. */
const RESPALDO_TEXTKIT = 'Helvetica';

/** El tipo de @react-pdf/font pierde el de fontkit, que no viene instalado: es la misma fuente. */
const leerConGlifos = async (letra: Omit<LetraDeRenglon, 'fontSize'>) =>
  (await leerFuente(letra)) as unknown as FuenteConGlifos;

/** Para cada variante registrada, las fuentes que prueba textkit: ella y su Helvetica. */
function pilasDeTextkit(): Promise<PilaDeFuentes[]> {
  return Promise.all(
    VARIANTES.map((variante) => {
      const letra = {
        fontFamily: variante.familia,
        fontWeight: variante.peso,
        fontStyle: estiloDe(variante),
      };
      return Promise.all([
        leerConGlifos(letra),
        leerConGlifos({ ...letra, fontFamily: RESPALDO_TEXTKIT }),
      ]);
    }),
  );
}

/** `renderizarEnSerie` con los textos de `props` saneados contra las fuentes recién leídas (#882). */
export function renderizarSaneado<P, T>(
  archivos: ArchivosFuentes,
  props: P,
  renderizar: (saneadas: P) => Promise<T>,
): Promise<T> {
  return renderizarEnSerie(archivos, async () => {
    const sanearTexto = saneadorDeTexto(dibujableEnTodas(await pilasDeTextkit()));
    return renderizar(sanearTextos(props, sanearTexto));
  });
}
