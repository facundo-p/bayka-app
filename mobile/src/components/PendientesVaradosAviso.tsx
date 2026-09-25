/**
 * Aviso de la tarjeta: cambios que no pudieron subir, por qué, y cómo descartarlos (#638).
 */
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, hitSlops, iconSizes } from '../theme';
import { pendientesVaradosAvisoStyles as styles } from './PendientesVaradosAviso.styles';

type Props = {
  titulo: string;
  motivo: string;
  onDescartar: () => void;
};

export default function PendientesVaradosAviso({ titulo, motivo, onDescartar }: Props) {
  return (
    <View style={styles.aviso} testID="pendientes-varados-aviso">
      <Ionicons name="cloud-offline-outline" size={iconSizes.stat} color={colors.conflictoText} style={styles.icono} />
      <View style={styles.textos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.motivo}>{motivo}</Text>
        <Pressable
          onPress={(e) => { e?.stopPropagation?.(); onDescartar(); }}
          hitSlop={hitSlops.chip}
          style={({ pressed }) => [styles.descartar, pressed && styles.descartarPresionado]}
          accessibilityRole="button"
          accessibilityLabel="Descartar cambios sin subir"
        >
          <Text style={styles.descartarTexto}>Descartar</Text>
        </Pressable>
      </View>
    </View>
  );
}
