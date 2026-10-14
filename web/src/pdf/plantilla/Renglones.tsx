import { Text, View, type Styles } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { TextoEnRenglones } from './partirTexto';
import { renglonesStyles as styles } from './Renglones.styles';

type Estilo = Styles[string] | Styles[string][];

type RenglonesProps = {
  renglones: TextoEnRenglones;
  /** El de la caja: los renglones heredan de ella la letra y el color. */
  style?: Estilo;
  /** Arma el primero, que puede llevar algo delante, como el código de una parcela. */
  primero?: (renglon: string) => ReactNode;
};

const igual = (renglon: string) => renglon;

/** Un `Text` por renglón ya partido: textkit no los vuelve a partir ni a justificar. */
export function Renglones({ renglones, style, primero = igual }: RenglonesProps) {
  return (
    <View style={style}>
      {renglones.map((renglon, indice) => (
        <Text key={indice} style={styles.renglon}>
          {indice === 0 ? primero(renglon) : renglon}
        </Text>
      ))}
    </View>
  );
}

/** Un texto que acomoda textkit, o ya partido en renglones. */
export type TextoPdf = string | TextoEnRenglones;

export function Texto({ texto, style }: { texto: TextoPdf; style?: Estilo }) {
  if (typeof texto === 'string') return <Text style={style}>{texto}</Text>;
  return <Renglones renglones={texto} style={style} />;
}
