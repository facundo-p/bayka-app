/*
 * Renglones armados con el motor de textkit y las opciones de @react-pdf/layout:
 * react-pdf no expone el ancho que calcula.
 */
import layoutEngine, {
  bidi,
  fontSubstitution,
  fromFragments,
  justification,
  linebreaker,
  scriptItemizer,
  textDecoration,
  wordHyphenation,
  type AttributedString,
  type Font,
} from '@react-pdf/textkit';
import type { FuenteLeida } from '../pdf/plantilla/fuenteLeida';
import type { EstiloMedido } from '../pdf/plantilla/medirTexto';

const motorTextkit = layoutEngine({
  bidi,
  linebreaker,
  justification,
  textDecoration,
  scriptItemizer,
  wordHyphenation,
  fontSubstitution,
});

const OPCIONES_LAYOUT = { shrinkWhitespaceFactor: { before: -0.5, after: -0.5 } };

type Caja = {
  ancho: number;
  /** Como las celdas del reporte con el texto cortado: un renglón y «…». */
  unRenglon?: boolean;
  /** Las que siguen a la del estilo, como la Helvetica que react-pdf suma al final. */
  respaldo?: FuenteLeida[];
};

/** Los renglones que arma textkit con `texto` en una caja de `ancho` pt. */
export function renglonesDeTextkit(
  texto: string,
  fuente: FuenteLeida,
  estilo: EstiloMedido,
  { ancho, unRenglon = false, respaldo = [] }: Caja,
): AttributedString[] {
  const attributes = {
    // Las que leyó react-pdf: las mismas que recibe textkit en el render.
    font: [fuente, ...respaldo] as unknown as Font[],
    fontSize: estilo.tamano,
    characterSpacing: estilo.espaciado,
  };
  const cadena = fromFragments([{ string: texto, attributes }]);
  const caja = { x: 0, y: 0, width: ancho, height: Infinity };
  const truncado = unRenglon ? { maxLines: 1, truncateMode: 'ellipsis' as const } : {};
  return motorTextkit(cadena, { ...caja, ...truncado }, OPCIONES_LAYOUT).flat();
}

export const anchoDelRenglon = (renglon: AttributedString) =>
  renglon.runs.flatMap((run) => run.positions ?? []).reduce((ancho, p) => ancho + p.xAdvance, 0);
