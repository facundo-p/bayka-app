/**
 * FilterCards -- reusable horizontal filter card row.
 * Shows estado-based filter cards with count, icon, and label.
 * Used by AdminScreen, PlantacionesScreen, and PlantationDetailScreen.
 */
import { View, Text, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../theme';

type FilterConfig = {
  key: string;
  label: string;
  count: number;
  color: string;
  icon: string; // Ionicons name
};

type Props = {
  filters: FilterConfig[];
  activeFilter: string | null;
  onToggleFilter: (key: string) => void;
};

export default function FilterCards({ filters, activeFilter, onToggleFilter }: Props) {
  return (
    <View style={styles.row}>
      {filters.map((filter) => {
        const isActive = activeFilter === filter.key;
        return (
          <Pressable
            key={filter.key}
            style={[
              styles.card,
              {
                borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? filter.color : filter.color + '30',
                backgroundColor: filter.color + (isActive ? '25' : '15'),
                transform: [{ scale: isActive ? 1.03 : 1 }],
              },
            ]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onToggleFilter(filter.key);
            }}
          >
            <Ionicons
              name={filter.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color={filter.color}
            />
            <Text style={[styles.count, { color: filter.color }]}>
              {filter.count}
            </Text>
            <Text style={[styles.label, { color: filter.color }]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  count: {
    fontSize: fontSize.heading,
    fontWeight: 'bold',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
