import { Circle, Path, Svg } from '@react-pdf/renderer';
import { COLOR_PDF, MEDIDA_FICHA } from '../plantilla/tokens';
import { iconoFichaStyles as styles } from './IconoFicha.styles';

/** Trazos de Lucide (ISC) en su caja de 24: un contorno y un círculo. */
const CAJA_ICONO = '0 0 24 24';

export const ICONO_FICHA = {
  camara: {
    contorno:
      'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z',
    circulo: { cx: 12, cy: 13, r: 3 },
  },
  pin: {
    contorno:
      'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
    circulo: { cx: 12, cy: 10, r: 3 },
  },
} as const;

export type TrazosIcono = (typeof ICONO_FICHA)[keyof typeof ICONO_FICHA];

const TRAZO = {
  stroke: COLOR_PDF.tenue,
  strokeWidth: MEDIDA_FICHA.trazoIcono,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** Acompaña el texto de una foto o un mapa que falta: que se lea como dato, no como error. */
export function IconoFicha({ icono }: { icono: TrazosIcono }) {
  return (
    <Svg style={styles.icono} viewBox={CAJA_ICONO}>
      <Path d={icono.contorno} {...TRAZO} />
      <Circle {...icono.circulo} {...TRAZO} />
    </Svg>
  );
}
