import { View, Text } from 'react-native';
import { grupoDeAvisoStyles as styles } from './GrupoDeAviso.styles';

type Props = { titulo: string; nombres: string[]; explicacion: string };

/** Aviso del resumen del sync que afecta a varias plantaciones. Null si no hay ninguna. */
export default function GrupoDeAviso({ titulo, nombres, explicacion }: Props) {
  if (nombres.length === 0) return null;
  return (
    <View style={styles.item}>
      <Text style={styles.titulo}>{titulo}</Text>
      {nombres.map((nombre, i) => (
        <Text key={`${nombre}-${i}`} style={styles.nombre}>{nombre}</Text>
      ))}
      <Text style={styles.explicacion}>{explicacion}</Text>
    </View>
  );
}
