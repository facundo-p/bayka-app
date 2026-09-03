/**
 * Reusable draggable species list for reordering.
 * Used by both admin ReorderSpeciesScreen and user config modal.
 */
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { colors } from '../theme';
import { speciesReorderListStyles as styles } from './SpeciesReorderList.styles';

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
