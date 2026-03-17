import { View, FlatList, StyleSheet } from 'react-native';
import SpeciesButton from './SpeciesButton';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';

interface Props {
  species: PlantationSpeciesItem[];
  onSelectSpecies: (item: { especieId: string; especieCodigo: string }) => void;
  onNNPress: () => void;
  disabled?: boolean;
}

export default function SpeciesButtonGrid({ species, onSelectSpecies, onNNPress, disabled = false }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.nnRow}>
        <SpeciesButton
          codigo="N/N"
          nombre="No identificado"
          onPress={onNNPress}
          isNN
          disabled={disabled}
        />
      </View>
      <FlatList
        data={species}
        numColumns={4}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <SpeciesButton
              codigo={item.codigo}
              nombre={item.nombre}
              onPress={() => onSelectSpecies({ especieId: item.especieId, especieCodigo: item.codigo })}
              disabled={disabled}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nnRow: { paddingHorizontal: 8, paddingBottom: 4 },
  grid: { paddingHorizontal: 8, paddingBottom: 8 },
  row: { gap: 6, marginBottom: 6 },
  cell: { flex: 1 },
});
