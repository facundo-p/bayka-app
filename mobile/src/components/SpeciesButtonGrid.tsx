import { View, FlatList, StyleSheet } from 'react-native';
import SpeciesButton from './SpeciesButton';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import { spacing } from '../theme';

interface Props {
  species: PlantationSpeciesItem[];
  onSelectSpecies: (item: { especieId: string; especieCodigo: string }) => void;
  onNNPress?: () => void;
  disabled?: boolean;
  /** When set, shows the grid in selection mode (no N/N, highlights selected) */
  selectedId?: string | null;
}

const NUM_COLUMNS = 3;

const NN_ITEM = { _nn: true, id: '__nn__' };

export default function SpeciesButtonGrid({ species, onSelectSpecies, onNNPress, disabled = false, selectedId }: Props) {
  const isSelectionMode = selectedId !== undefined;

  // Build data: species + N/N (if not selection mode) + placeholders
  const allItems = isSelectionMode ? [...species] : [...species, NN_ITEM];
  const remainder = allItems.length % NUM_COLUMNS;
  const placeholderCount = remainder === 0 ? 0 : NUM_COLUMNS - remainder;
  const data = [
    ...allItems,
    ...Array.from({ length: placeholderCount }, (_, i) => ({ _placeholder: true, id: `placeholder-${i}` })),
  ];

  return (
    <FlatList
      data={data}
      numColumns={NUM_COLUMNS}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => {
        if ('_placeholder' in item) {
          return <View style={styles.cell} />;
        }
        if ('_nn' in item) {
          return (
            <View style={styles.cell}>
              <SpeciesButton
                codigo="N/N"
                nombre="No identificado"
                onPress={onNNPress ?? (() => {})}
                isNN
                disabled={disabled}
              />
            </View>
          );
        }
        const speciesItem = item as PlantationSpeciesItem;
        return (
          <View style={styles.cell}>
            <SpeciesButton
              codigo={speciesItem.codigo}
              nombre={speciesItem.nombre}
              onPress={() => onSelectSpecies({ especieId: speciesItem.especieId, especieCodigo: speciesItem.codigo })}
              disabled={disabled}
              selected={isSelectionMode && selectedId === speciesItem.especieId}
            />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  cell: { flex: 1 },
});
