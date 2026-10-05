import { View, FlatList } from 'react-native';
import SpeciesButton from './SpeciesButton';
import { BOTON_NN } from '../constants/especies';
import type { EstiloBotonera } from '../constants/estiloBotonera';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import { speciesButtonGridStyles as styles, COLUMNAS_BOTONERA } from './SpeciesButtonGrid.styles';

interface Props {
  species: PlantationSpeciesItem[];
  estilo: EstiloBotonera;
  onSelectSpecies: (item: { especieId: string; especieCodigo: string }) => void;
  onNNPress?: () => void;
  disabled?: boolean;
  /** When set, shows the grid in selection mode (no N/N, highlights selected) */
  selectedId?: string | null;
}

const NN_ITEM = { _nn: true, id: '__nn__' };

export default function SpeciesButtonGrid({ species, estilo, onSelectSpecies, onNNPress, disabled = false, selectedId }: Props) {
  const isSelectionMode = selectedId !== undefined;

  // Build data: species + N/N (if not selection mode) + placeholders
  const allItems = isSelectionMode ? [...species] : [...species, NN_ITEM];
  const remainder = allItems.length % COLUMNAS_BOTONERA;
  const placeholderCount = remainder === 0 ? 0 : COLUMNAS_BOTONERA - remainder;
  const data = [
    ...allItems,
    ...Array.from({ length: placeholderCount }, (_, i) => ({ _placeholder: true, id: `placeholder-${i}` })),
  ];

  return (
    <FlatList
      data={data}
      numColumns={COLUMNAS_BOTONERA}
      extraData={estilo}
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
                {...BOTON_NN}
                estilo={estilo}
                onPress={onNNPress ?? (() => {})}
                isNN
                disabled={disabled}
                testID="nn-button"
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
              estilo={estilo}
              onPress={() => onSelectSpecies({ especieId: speciesItem.especieId, especieCodigo: speciesItem.codigo })}
              disabled={disabled}
              selected={isSelectionMode && selectedId === speciesItem.especieId}
              testID={`species-btn-${speciesItem.codigo}`}
            />
          </View>
        );
      }}
    />
  );
}
