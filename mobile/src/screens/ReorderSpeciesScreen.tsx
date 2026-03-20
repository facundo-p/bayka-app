/**
 * ReorderSpeciesScreen — drag-and-drop species button grid.
 * Shows enabled species as buttons matching the real registration grid layout.
 * Admin can drag buttons to reorder. Saves orden_visual on confirm.
 *
 * Covers requirement: PLAN-05
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors, fontSize, spacing, borderRadius } from '../theme';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import { showInfoDialog } from '../utils/alertHelpers';
import { getPlantationSpeciesConfig } from '../queries/adminQueries';
import { saveSpeciesConfig } from '../repositories/PlantationRepository';

const COLUMNS = 4;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_GAP = spacing.md;
const PADDING = spacing.xxl;
const BUTTON_WIDTH = (SCREEN_WIDTH - PADDING * 2 - BUTTON_GAP * (COLUMNS - 1)) / COLUMNS;

type SpeciesButton = {
  especieId: string;
  nombre: string;
  codigo: string;
  ordenVisual: number;
};

export default function ReorderSpeciesScreen() {
  const { plantacionId } = useLocalSearchParams<{ plantacionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();

  const [items, setItems] = useState<SpeciesButton[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!plantacionId) return;
    setLoading(true);
    try {
      const config = await getPlantationSpeciesConfig(plantacionId);
      const sorted = [...config].sort((a, b) => a.ordenVisual - b.ordenVisual);
      setItems(sorted);
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudieron cargar las especies.', 'alert-circle-outline', colors.danger);
    } finally {
      setLoading(false);
    }
  }, [plantacionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleDragEnd({ data }: { data: SpeciesButton[] }) {
    setItems(data.map((item, idx) => ({ ...item, ordenVisual: idx })));
  }

  async function handleSave() {
    if (!plantacionId) return;
    setSaving(true);
    try {
      const config = items.map((i) => ({ especieId: i.especieId, ordenVisual: i.ordenVisual }));
      await saveSpeciesConfig(plantacionId, config);
      router.back();
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudo guardar el orden.', 'alert-circle-outline', colors.danger);
    } finally {
      setSaving(false);
    }
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<SpeciesButton>) {
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.speciesButton,
            isActive && styles.speciesButtonDragging,
          ]}
        >
          <Text style={styles.speciesCode}>{item.codigo}</Text>
          <Text style={styles.speciesName} numberOfLines={1}>{item.nombre}</Text>
          <Ionicons name="menu" size={14} color={colors.primaryFaded} style={styles.dragHandle} />
        </Pressable>
      </ScaleDecorator>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando botonera...</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No hay especies configuradas</Text>
        <Text style={styles.hintText}>Primero habilitá especies desde "Configurar especies"</Text>
      </View>
    );
  }

  return (
    <>
      <GestureHandlerRootView style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ordenar botonera</Text>
          <Text style={styles.headerHint}>Mantene presionado un boton para arrastrarlo</Text>
        </View>

        <DraggableFlatList
          data={items}
          keyExtractor={(item) => item.especieId}
          onDragEnd={handleDragEnd}
          renderItem={renderItem}
          numColumns={COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
        />

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && { opacity: 0.8 },
              saving && { opacity: 0.6 },
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                <Text style={styles.saveButtonText}>Guardar orden</Text>
              </>
            )}
          </Pressable>
        </View>
      </GestureHandlerRootView>
      <ConfirmModal {...confirm.confirmProps} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textLight,
  },
  header: {
    paddingHorizontal: PADDING,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  gridContent: {
    paddingHorizontal: PADDING,
    paddingBottom: spacing['5xl'],
  },
  gridRow: {
    gap: BUTTON_GAP,
    marginBottom: BUTTON_GAP,
  },
  speciesButton: {
    width: BUTTON_WIDTH,
    height: 70,
    backgroundColor: colors.primaryBg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  speciesButtonDragging: {
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBgLight,
  },
  speciesCode: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  speciesName: {
    fontSize: fontSize.xxs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  dragHandle: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  footer: {
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
