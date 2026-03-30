import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { colors, fontSize, fonts } from '../theme';

interface Props {
  color: string;
  size: number;
}

/**
 * Centralized "Plantaciones" tab icon.
 * Change here to update in both admin and tecnico tab bars.
 * Shows an orange badge with the total pending sync count when > 0.
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

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.secondary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: fontSize.xxs,
    fontFamily: fonts.bold,
  },
});
