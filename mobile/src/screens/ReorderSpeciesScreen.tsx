/**
 * ReorderSpeciesScreen — drag-and-drop species reorder with grid preview.
 *
 * Shows a draggable list (single column) for reordering, plus a live preview
 * of the 3-column grid matching the real species button layout.
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
  ScrollView,
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

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_PADDING = spacing.xxl;
const PREVIEW_GAP = spacing.md;
const PREVIEW_BTN_WIDTH = (SCREEN_WIDTH - PREVIEW_PADDING * 2 - PREVIEW_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

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
      setItems([...config].sort((a, b) => a.ordenVisual - b.ordenVisual));
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
      await saveSpeciesConfig(plantacionId, items.map((i) => ({ especieId: i.especieId, ordenVisual: i.ordenVisual })));
      router.back();
    } catch (e: any) {
      showInfoDialog(confirm.show, 'Error', e?.message ?? 'No se pudo guardar el orden.', 'alert-circle-outline', colors.danger);
    } finally {
      setSaving(false);
    }
  }

  // Render draggable list item
  function renderDragItem({ item, drag, isActive }: RenderItemParams<SpeciesButton>) {
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          style={[styles.dragRow, isActive && styles.dragRowActive]}
        >
          <Ionicons name="menu" size={20} color={colors.textMuted} />
          <View style={styles.dragRowButton}>
            <Text style={styles.dragRowCode}>{item.codigo}</Text>
          </View>
          <Text style={styles.dragRowName} numberOfLines={1}>{item.nombre}</Text>
          <Text style={styles.dragRowOrder}>#{item.ordenVisual + 1}</Text>
        </Pressable>
      </ScaleDecorator>
    );
  }

  // Grid preview — shows how the botonera will look
  function renderGridPreview() {
    const rows: SpeciesButton[][] = [];
    for (let i = 0; i < items.length; i += NUM_COLUMNS) {
      rows.push(items.slice(i, i + NUM_COLUMNS));
    }
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Vista previa de la botonera</Text>
        <View style={styles.previewGrid}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.previewRow}>
              {row.map((item) => (
                <View key={item.especieId} style={styles.previewButton}>
                  <Text style={styles.previewCode}>{item.codigo}</Text>
                  <Text style={styles.previewName} numberOfLines={1}>{item.nombre}</Text>
                </View>
              ))}
              {/* Fill empty slots in last row */}
              {row.length < NUM_COLUMNS &&
                Array.from({ length: NUM_COLUMNS - row.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={[styles.previewButton, styles.previewButtonEmpty]} />
                ))
              }
            </View>
          ))}
        </View>
      </View>
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
      </View>
    );
  }

  return (
    <>
      <GestureHandlerRootView style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Live grid preview */}
        {renderGridPreview()}

        {/* Drag list for reordering */}
        <View style={styles.dragSection}>
          <Text style={styles.dragHint}>Mantene presionado para reordenar</Text>
        </View>

        <DraggableFlatList
          data={items}
          keyExtractor={(item) => item.especieId}
          onDragEnd={handleDragEnd}
          renderItem={renderDragItem}
          contentContainerStyle={styles.dragListContent}
        />

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.8 }, saving && { opacity: 0.6 }]}
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
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl, backgroundColor: colors.background },
  loadingText: { fontSize: fontSize.base, color: colors.textMuted },

  // Grid preview
  previewContainer: {
    paddingHorizontal: PREVIEW_PADDING,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  previewTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  previewGrid: {
    gap: PREVIEW_GAP,
  },
  previewRow: {
    flexDirection: 'row',
    gap: PREVIEW_GAP,
  },
  previewButton: {
    width: PREVIEW_BTN_WIDTH,
    height: 52,
    backgroundColor: colors.primaryBg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  previewButtonEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  previewCode: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.primary,
  },
  previewName: {
    fontSize: fontSize.xxs,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Drag section
  dragSection: {
    paddingHorizontal: PREVIEW_PADDING,
    paddingBottom: spacing.sm,
  },
  dragHint: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  dragListContent: {
    paddingHorizontal: PREVIEW_PADDING,
    paddingBottom: spacing['5xl'],
  },
  dragRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
  },
  dragRowActive: {
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderColor: colors.primary,
    backgroundColor: colors.primaryBgLight,
  },
  dragRowButton: {
    width: 40,
    height: 32,
    backgroundColor: colors.primaryBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragRowCode: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.primary,
  },
  dragRowName: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
  },
  dragRowOrder: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // Footer
  footer: { padding: spacing.xxl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.xl, gap: spacing.sm },
  saveButtonText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '600' },
});
