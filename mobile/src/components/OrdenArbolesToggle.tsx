import { Pressable, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { useOrdenArboles } from '../hooks/useOrdenArboles';
import { esDescendente } from '../utils/ordenArboles';
import { ordenArbolesToggleStyles as styles } from './OrdenArbolesToggle.styles';

/** Botón que alterna el orden del listado de árboles y muestra el actual. */
export default function OrdenArbolesToggle() {
  const { orden, alternar } = useOrdenArboles();
  const desc = esDescendente(orden);
  return (
    <Pressable
      testID="orden-arboles-toggle"
      style={styles.button}
      onPress={alternar}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={desc
        ? 'Orden descendente, de mayor a menor. Tocar para ordenar ascendente'
        : 'Orden ascendente, de menor a mayor. Tocar para ordenar descendente'}
    >
      <Ionicons name={desc ? 'arrow-down' : 'arrow-up'} size={16} color={colors.primary} />
      <Text style={styles.label}>{desc ? 'N→1' : '1→N'}</Text>
    </Pressable>
  );
}
