import { useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTrees } from '../../../../src/hooks/useTrees';
import { usePlantationSpecies } from '../../../../src/hooks/usePlantationSpecies';
import { resolveNNTree } from '../../../../src/repositories/TreeRepository';

export default function NNResolutionScreen() {
  const { subgrupoId, subgrupoCodigo, plantacionId } = useLocalSearchParams<{
    subgrupoId: string;
    subgrupoCodigo: string;
    plantacionId: string;
  }>();
  const router = useRouter();

  const { allTrees } = useTrees(subgrupoId ?? '');
  const { species, loading: speciesLoading } = usePlantationSpecies(plantacionId ?? '');

  const unresolvedTrees = allTrees.filter((t) => t.especieId === null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (unresolvedTrees.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay árboles N/N pendientes</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const currentTree = unresolvedTrees[currentIndex];
  const total = unresolvedTrees.length;

  async function handleGuardar() {
    if (!selectedSpeciesId) {
      Alert.alert('Seleccionar especie', 'Debes seleccionar una especie antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      await resolveNNTree(currentTree.id, selectedSpeciesId, subgrupoCodigo ?? '');
      setSelectedSpeciesId(null);

      // If this was the last unresolved tree, go back
      if (currentIndex >= unresolvedTrees.length - 1) {
        router.back();
      } else {
        // Stay at same index — the resolved tree will disappear from the list
        // If index is now out of bounds, clamp
        setCurrentIndex((prev) => Math.min(prev, unresolvedTrees.length - 2));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAnterior() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedSpeciesId(null);
    }
  }

  function handleSiguiente() {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedSpeciesId(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Counter */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          N/N {currentIndex + 1} de {total}
        </Text>
        <Text style={styles.posicionText}>Posición {currentTree.posicion}</Text>
      </View>

      {/* Photo */}
      {currentTree.fotoUrl ? (
        <Image
          source={{ uri: currentTree.fotoUrl }}
          style={styles.photo}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>Sin foto</Text>
        </View>
      )}

      {/* Species picker */}
      <Text style={styles.pickerLabel}>Seleccionar especie:</Text>

      {speciesLoading ? (
        <ActivityIndicator size="large" color="#2d6a2d" style={styles.loader} />
      ) : (
        <FlatList
          data={species}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.speciesGrid}
          columnWrapperStyle={styles.speciesRow}
          renderItem={({ item }) => {
            const isSelected = selectedSpeciesId === item.especieId;
            return (
              <Pressable
                style={[styles.speciesButton, isSelected && styles.speciesButtonSelected]}
                onPress={() => setSelectedSpeciesId(item.especieId)}
              >
                <Text style={[styles.speciesCode, isSelected && styles.speciesCodeSelected]}>
                  {item.codigo}
                </Text>
                <Text style={[styles.speciesName, isSelected && styles.speciesNameSelected]} numberOfLines={2}>
                  {item.nombre}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Navigation */}
      <View style={styles.navigationRow}>
        <Pressable
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handleAnterior}
          disabled={currentIndex === 0}
        >
          <Text style={styles.navButtonText}>Anterior</Text>
        </Pressable>

        <Pressable
          style={[styles.navButton, currentIndex >= total - 1 && styles.navButtonDisabled]}
          onPress={handleSiguiente}
          disabled={currentIndex >= total - 1}
        >
          <Text style={styles.navButtonText}>Siguiente</Text>
        </Pressable>
      </View>

      {/* Save button */}
      <Pressable
        style={[styles.guardarButton, saving && styles.guardarButtonDisabled]}
        onPress={handleGuardar}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.guardarButtonText}>Guardar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#2d6a2d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  counterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e65100',
  },
  posicionText: {
    fontSize: 14,
    color: '#888',
  },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#e0e0e0',
  },
  photoPlaceholder: {
    width: '100%',
    height: 280,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: '#888',
    fontSize: 16,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  loader: {
    marginVertical: 24,
  },
  speciesGrid: {
    paddingBottom: 8,
  },
  speciesRow: {
    gap: 6,
    marginBottom: 6,
  },
  speciesButton: {
    flex: 1,
    minHeight: 60,
    backgroundColor: '#f0f7f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  speciesButtonSelected: {
    backgroundColor: '#2d6a2d',
    borderColor: '#1b5e20',
  },
  speciesCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  speciesCodeSelected: {
    color: '#fff',
  },
  speciesName: {
    fontSize: 10,
    color: '#388e3c',
    textAlign: 'center',
    marginTop: 2,
  },
  speciesNameSelected: {
    color: '#c8e6c9',
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 12,
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d6a2d',
    alignItems: 'center',
  },
  navButtonDisabled: {
    borderColor: '#ccc',
    opacity: 0.4,
  },
  navButtonText: {
    color: '#2d6a2d',
    fontWeight: '600',
    fontSize: 14,
  },
  guardarButton: {
    backgroundColor: '#2d6a2d',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  guardarButtonDisabled: {
    opacity: 0.5,
  },
  guardarButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
