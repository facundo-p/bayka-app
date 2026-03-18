import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useTrees } from '../../../../src/hooks/useTrees';
import { usePlantationSpecies } from '../../../../src/hooks/usePlantationSpecies';
import { resolveNNTree } from '../../../../src/repositories/TreeRepository';
import { useLiveData } from '../../../../src/database/liveQuery';
import { db } from '../../../../src/database/client';
import { trees, subgroups } from '../../../../src/database/schema';
import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../../../../src/theme';

interface NNTree {
  id: string;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  especieId: string | null;
  subgrupoId: string;
  subgrupoCodigo?: string;
  subgrupoNombre?: string;
}

export default function NNResolutionScreen() {
  const { subgrupoId, subgrupoCodigo, plantacionId } = useLocalSearchParams<{
    subgrupoId?: string;
    subgrupoCodigo?: string;
    plantacionId: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  // Determine mode: single subgroup or plantation-wide
  const isPlantationMode = !subgrupoId;

  // Single subgroup mode: use existing hook
  const singleSubgroupTrees = useTrees(subgrupoId ?? '');

  // Plantation-wide mode: query all N/N trees across subgroups
  const { data: plantationNNTrees } = useLiveData(
    () => {
      if (!isPlantationMode) return Promise.resolve([]);
      return db.select({
        id: trees.id,
        posicion: trees.posicion,
        subId: trees.subId,
        fotoUrl: trees.fotoUrl,
        especieId: trees.especieId,
        subgrupoId: trees.subgrupoId,
        subgrupoCodigo: subgroups.codigo,
        subgrupoNombre: subgroups.nombre,
      })
        .from(trees)
        .innerJoin(subgroups, eq(trees.subgrupoId, subgroups.id))
        .where(and(
          isNull(trees.especieId),
          eq(subgroups.plantacionId, plantacionId ?? '')
        ))
        .orderBy(asc(subgroups.nombre), asc(trees.posicion));
    },
    [plantacionId, isPlantationMode]
  );

  // Build unified unresolved list
  let unresolvedTrees: NNTree[];
  if (isPlantationMode) {
    unresolvedTrees = (plantationNNTrees ?? []) as NNTree[];
  } else {
    unresolvedTrees = singleSubgroupTrees.allTrees
      .filter((t) => t.especieId === null)
      .map((t) => ({ ...t, subgrupoCodigo: subgrupoCodigo ?? '', subgrupoNombre: undefined }));
  }

  const { species, loading: speciesLoading } = usePlantationSpecies(plantacionId ?? '');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Hide default header, use custom
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  if (unresolvedTrees.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay arboles N/N pendientes</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  // Clamp currentIndex
  const safeIndex = Math.min(currentIndex, unresolvedTrees.length - 1);
  const currentTree = unresolvedTrees[safeIndex];
  const total = unresolvedTrees.length;

  // Determine the subgrupoCodigo for resolving
  const currentSubgrupoCodigo = currentTree.subgrupoCodigo ?? subgrupoCodigo ?? '';

  async function handleGuardar() {
    if (!selectedSpeciesId) {
      Alert.alert('Seleccionar especie', 'Debes seleccionar una especie antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      await resolveNNTree(currentTree.id, selectedSpeciesId, currentSubgrupoCodigo);
      setSelectedSpeciesId(null);

      if (safeIndex >= unresolvedTrees.length - 1) {
        router.back();
      } else {
        setCurrentIndex((prev) => Math.min(prev, unresolvedTrees.length - 2));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAnterior() {
    if (safeIndex > 0) {
      setCurrentIndex(safeIndex - 1);
      setSelectedSpeciesId(null);
    }
  }

  function handleSiguiente() {
    if (safeIndex < total - 1) {
      setCurrentIndex(safeIndex + 1);
      setSelectedSpeciesId(null);
    }
  }

  return (
    <View style={styles.container}>
      {/* Custom header */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.headerBackButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Resolver N/N</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Fixed info row */}
      <View style={styles.infoRow}>
        <Text style={styles.counterText}>
          N/N {safeIndex + 1} de {total}
        </Text>
        <View style={styles.infoRight}>
          {isPlantationMode && currentTree.subgrupoNombre && (
            <Text style={styles.subgrupoLabel}>{currentTree.subgrupoNombre}</Text>
          )}
          {isPlantationMode && currentTree.subgrupoCodigo && (
            <Text style={styles.subgrupoCodeLabel}>{currentTree.subgrupoCodigo}</Text>
          )}
          <Text style={styles.posicionText}>Posicion {currentTree.posicion}</Text>
        </View>
      </View>

      {/* Scrollable middle content */}
      <View style={styles.scrollWrapper}>
        <FlatList
          data={[currentTree]}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
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

              {/* Species picker label */}
              <Text style={styles.pickerLabel}>Seleccionar especie:</Text>
            </>
          }
          renderItem={() => null}
          ListFooterComponent={
            <>
              {speciesLoading ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
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
                  style={[styles.navButton, safeIndex === 0 && styles.navButtonDisabled]}
                  onPress={handleAnterior}
                  disabled={safeIndex === 0}
                >
                  <Text style={styles.navButtonText}>Anterior</Text>
                </Pressable>

                <Pressable
                  style={[styles.navButton, safeIndex >= total - 1 && styles.navButtonDisabled]}
                  onPress={handleSiguiente}
                  disabled={safeIndex >= total - 1}
                >
                  <Text style={styles.navButtonText}>Siguiente</Text>
                </Pressable>
              </View>
            </>
          }
        />
      </View>

      {/* Fixed bottom: Guardar button */}
      <View style={styles.fixedBottom}>
        <Pressable
          style={[styles.guardarButton, saving && styles.guardarButtonDisabled]}
          onPress={handleGuardar}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.guardarButtonText}>Guardar</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    paddingTop: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    padding: spacing.xs,
    marginRight: spacing.md,
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  subgrupoLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textMedium,
  },
  subgrupoCodeLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  counterText: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  posicionText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  scrollWrapper: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['5xl'],
  },
  emptyText: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
    marginBottom: spacing['4xl'],
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  backButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.lg,
  },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xxl,
    marginTop: spacing.xxl,
    marginHorizontal: 0,
    backgroundColor: colors.border,
  },
  photoPlaceholder: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xxl,
    marginTop: spacing.xxl,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: colors.textMuted,
    fontSize: fontSize.xl,
  },
  pickerLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textMedium,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  loader: {
    marginVertical: spacing['4xl'],
  },
  speciesGrid: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  speciesRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  speciesButton: {
    flex: 1,
    minHeight: 60,
    backgroundColor: colors.primaryBgLight,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  speciesButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  speciesCode: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.primaryDark,
  },
  speciesCodeSelected: {
    color: colors.white,
  },
  speciesName: {
    fontSize: fontSize.xxs,
    color: colors.primaryMedium,
    textAlign: 'center',
    marginTop: 2,
  },
  speciesNameSelected: {
    color: colors.primaryBorder,
  },
  navigationRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
  navButton: {
    flex: 1,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  navButtonDisabled: {
    borderColor: colors.borderMuted,
    opacity: 0.4,
  },
  navButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.base,
  },
  fixedBottom: {
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  guardarButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xxl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  guardarButtonDisabled: {
    opacity: 0.5,
  },
  guardarButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.xl,
  },
});
