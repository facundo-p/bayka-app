import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useTrees } from '../../../../src/hooks/useTrees';
import { usePlantationSpecies } from '../../../../src/hooks/usePlantationSpecies';
import {
  insertTree,
  deleteLastTree,
  reverseTreeOrder,
  updateTreePhoto,
} from '../../../../src/repositories/TreeRepository';
import { finalizeSubGroup } from '../../../../src/repositories/SubGroupRepository';
import { captureNNPhoto, attachTreePhoto } from '../../../../src/services/PhotoService';
import { supabase, isSupabaseConfigured } from '../../../../src/supabase/client';
import SpeciesButtonGrid from '../../../../src/components/SpeciesButtonGrid';
import TreeRow from '../../../../src/components/TreeRow';

export default function TreeRegistrationScreen() {
  const { id: subgrupoId } = useLocalSearchParams<{
    id: string;
    plantacionId: string;
    subgrupoCodigo: string;
    subgrupoNombre: string;
  }>();
  const { plantacionId, subgrupoCodigo, subgrupoNombre } = useLocalSearchParams<{
    plantacionId: string;
    subgrupoCodigo: string;
    subgrupoNombre: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();

  const [userId, setUserId] = useState<string>('');
  const [finalizing, setFinalizing] = useState(false);
  const [reversing, setReversing] = useState(false);

  const { allTrees, lastThree, totalCount, unresolvedNN } = useTrees(subgrupoId ?? '');
  const { species, loading: speciesLoading } = usePlantationSpecies(plantacionId ?? '');

  // Set screen header title
  useEffect(() => {
    if (subgrupoNombre) {
      navigation.setOptions({ title: subgrupoNombre });
    }
  }, [subgrupoNombre, navigation]);

  // Resolve userId once
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  async function handleSpeciesPress(especieId: string, especieCodigo: string) {
    await insertTree({
      subgrupoId: subgrupoId ?? '',
      subgrupoCodigo: subgrupoCodigo ?? '',
      especieId,
      especieCodigo,
      userId,
    });
    // useLiveQuery fires automatically — no setState needed
  }

  async function handleNNPress() {
    const photoUri = await captureNNPhoto();
    if (!photoUri) return; // user cancelled — do NOT register
    await insertTree({
      subgrupoId: subgrupoId ?? '',
      subgrupoCodigo: subgrupoCodigo ?? '',
      especieId: null,
      especieCodigo: 'NN',
      fotoUrl: photoUri,
      userId,
    });
  }

  async function handleUndo() {
    await deleteLastTree(subgrupoId ?? '');
  }

  async function handleAddPhotoToTree(treeId: string) {
    const photoUri = await attachTreePhoto('camera');
    if (!photoUri) return;
    await updateTreePhoto(treeId, photoUri);
  }

  function handleReverseOrder() {
    Alert.alert(
      'Revertir Orden',
      '¿Revertir el orden de los árboles? Se recalcularán todas las posiciones y códigos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revertir',
          style: 'destructive',
          onPress: async () => {
            setReversing(true);
            try {
              await reverseTreeOrder(subgrupoId ?? '', subgrupoCodigo ?? '');
            } finally {
              setReversing(false);
            }
          },
        },
      ]
    );
  }

  function handleFinalizar() {
    if (unresolvedNN > 0) {
      Alert.alert(
        'No se puede finalizar',
        `Hay ${unresolvedNN} árbol${unresolvedNN > 1 ? 'es' : ''} N/N sin resolver. Resolver árboles N/N antes de finalizar.`
      );
      return;
    }

    Alert.alert(
      'Finalizar SubGrupo',
      '¿Confirmar finalización? No podrás registrar más árboles.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setFinalizing(true);
            try {
              const result = await finalizeSubGroup(subgrupoId ?? '');
              if (!result.success && result.error === 'unresolved_nn') {
                Alert.alert(
                  'No se puede finalizar',
                  `Hay ${result.count} árbol${result.count > 1 ? 'es' : ''} N/N sin resolver. Resolver árboles N/N antes de finalizar.`
                );
              } else if (result.success) {
                router.back();
              }
            } finally {
              setFinalizing(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      {/* Header bar: subgroup name + tree count */}
      <View style={styles.headerBar}>
        <Text style={styles.headerName}>{subgrupoNombre ?? subgrupoCodigo}</Text>
        <Text style={styles.headerCount}>{totalCount} árbol{totalCount !== 1 ? 'es' : ''}</Text>
      </View>

      {/* Unresolved N/N warning */}
      {unresolvedNN > 0 && (
        <Pressable
          style={styles.nnWarning}
          onPress={() =>
            router.push(
              `/(tecnico)/plantation/subgroup/nn-resolution?subgrupoId=${subgrupoId}&subgrupoCodigo=${subgrupoCodigo}&plantacionId=${plantacionId}`
            )
          }
        >
          <Text style={styles.nnWarningText}>
            {unresolvedNN} N/N sin resolver — Toca para revisar
          </Text>
        </Pressable>
      )}

      {/* Last 3 trees */}
      {lastThree.length > 0 && (
        <View style={styles.lastThreeContainer}>
          {lastThree.map((tree, index) => (
            <TreeRow
              key={tree.id}
              posicion={tree.posicion}
              especieCodigo={tree.especieId === null ? 'N/N' : tree.subId.replace(/^.*?([A-Z]+)\d+$/, '$1')}
              subId={tree.subId}
              fotoUrl={tree.fotoUrl}
              isLast={index === 0}
              onDelete={index === 0 ? handleUndo : undefined}
              onAttachPhoto={() => handleAddPhotoToTree(tree.id)}
            />
          ))}
        </View>
      )}

      {/* Species button grid */}
      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContent}>
        {speciesLoading ? (
          <ActivityIndicator size="large" color="#2d6a2d" style={styles.loader} />
        ) : (
          <SpeciesButtonGrid
            species={species}
            onSelectSpecies={({ especieId, especieCodigo }) =>
              handleSpeciesPress(especieId, especieCodigo)
            }
            onNNPress={handleNNPress}
          />
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        <Pressable
          style={[styles.reverseButton, reversing && styles.buttonDisabled]}
          onPress={handleReverseOrder}
          disabled={reversing}
        >
          {reversing ? (
            <ActivityIndicator size="small" color="#e65100" />
          ) : (
            <Text style={styles.reverseButtonText}>Revertir Orden</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.finalizarButton, finalizing && styles.buttonDisabled]}
          onPress={handleFinalizar}
          disabled={finalizing}
        >
          {finalizing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.finalizarButtonText}>Finalizar</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerBar: {
    backgroundColor: '#2d6a2d',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  headerCount: {
    color: '#c8e6c9',
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  nnWarning: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffcc02',
  },
  nnWarningText: {
    color: '#e65100',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  lastThreeContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  gridScroll: {
    flex: 1,
  },
  gridContent: {
    paddingTop: 8,
    flexGrow: 1,
  },
  loader: {
    marginTop: 40,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  reverseButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e65100',
    alignItems: 'center',
  },
  reverseButtonText: {
    color: '#e65100',
    fontWeight: '600',
    fontSize: 15,
  },
  finalizarButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2d6a2d',
    alignItems: 'center',
  },
  finalizarButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
