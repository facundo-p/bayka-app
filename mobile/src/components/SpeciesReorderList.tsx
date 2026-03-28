/**
 * Reusable draggable species list for reordering.
 * Used by both admin ReorderSpeciesScreen and user config modal.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { colors, fontSize, spacing, borderRadius } from '../theme';

export type ReorderItem = {
  especieId: string;
  nombre: string;
  codigo: string;
  ordenVisual: number;
};

type Props = {
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
};

export default function SpeciesReorderList({ items, onReorder }: Props) {
  function handleDragEnd({ data }: { data: ReorderItem[] }) {
    onReorder(data.map((item, idx) => ({ ...item, ordenVisual: idx })));
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<ReorderItem>) {
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          delayLongPress={150}
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

  return (
    <DraggableFlatList
      data={items}
      keyExtractor={(item) => item.especieId}
      onDragEnd={handleDragEnd}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      dragItemOverflow={true}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
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
});
