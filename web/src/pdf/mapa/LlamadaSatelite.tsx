import { Text, type Styles } from '@react-pdf/renderer';
import { CAPA_SATELITE } from '../../lib/capaSatelite';
import { llamadaSateliteStyles as styles } from './LlamadaSatelite.styles';

const LLAMADA = '*';

/** La atribución que piden los términos de Esri, como nota al pie de la hoja del mapa. */
export const NOTA_SATELITE = `${LLAMADA} ${CAPA_SATELITE.atribucion}`;

/** Debajo de cada mapa con satélite: remite a la nota al pie. */
export function LlamadaSatelite({ style }: { style: Styles[string] }) {
  return <Text style={[styles.llamada, style]}>{LLAMADA}</Text>;
}
