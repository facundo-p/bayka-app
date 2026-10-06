import { Text, type Styles } from '@react-pdf/renderer';
import { CAPA_SATELITE } from '../../lib/capaSatelite';
import { atribucionSateliteStyles as styles } from './AtribucionSatelite.styles';

/** La atribución que piden los términos de Esri, al pie de cada mapa con satélite. */
export function AtribucionSatelite({ style }: { style: Styles[string] }) {
  return <Text style={[styles.texto, style]}>{CAPA_SATELITE.atribucion}</Text>;
}
