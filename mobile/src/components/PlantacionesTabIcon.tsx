import { View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { plantacionesTabIconStyles as styles } from './PlantacionesTabIcon.styles';

interface Props {
  color: string;
  size: number;
}

/**
 * Ícono centralizado del tab "Plantaciones" (admin y técnico comparten este).
 * Muestra un badge naranja con el total de pendientes de sync cuando es > 0.
 */
export default function PlantacionesTabIcon({ color, size }: Props) {
  const { pendingCount } = usePendingSyncCount();
  return (
    <View style={{ width: size, height: size }}>
      <MaterialCommunityIcons name="tree-outline" size={size} color={color} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {pendingCount > 99 ? '99+' : String(pendingCount)}
          </Text>
        </View>
      )}
    </View>
  );
}
