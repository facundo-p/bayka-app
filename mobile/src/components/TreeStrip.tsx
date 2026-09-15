import { memo, useCallback, type ReactNode } from 'react';
import { FlatList, Pressable, Text, View, type ListRenderItem } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { useStripAutoScroll } from '../hooks/useStripAutoScroll';
import { getSpeciesCode } from '../utils/speciesHelpers';
import {
  CHIP_DELETE_HIT_SLOP,
  CHIP_STRIDE,
  CHIP_TEXT_MIN_SCALE,
  MIN_VISIBLE_SLOTS,
  STRIP_PADDING,
  treeStripStyles as styles,
} from './TreeStrip.styles';

export interface TreeChipItem {
  id: string;
  posicion: number;
  especieId: string | null;
  especieCodigo?: string | null;
  especieNombre?: string | null;
  subId: string;
  fotoUrl?: string | null;
  createdAt: string;
  grupoId: string;
  usuarioRegistro: string;
  /** Punto GPS capturado; null/ausente = árbol sin coordenadas. */
  latitude?: number | null;
  gpsAccuracy?: number | null;
}

interface Props {
  /** Todos los árboles del grupo, por posición ascendente. */
  trees: TreeChipItem[];
  selectedId: string | null;
  onSelect: (treeId: string) => void;
  /** Tachito del chip seleccionado. */
  onDelete: (tree: TreeChipItem) => void;
  /** Row bajo los chips (señal GPS y captura del seleccionado). */
  footer?: ReactNode;
}

const keyExtractor = (tree: TreeChipItem) => tree.id;

const getItemLayout = (_: ArrayLike<TreeChipItem> | null | undefined, index: number) => ({
  length: CHIP_STRIDE,
  offset: STRIP_PADDING + CHIP_STRIDE * index,
  index,
});

/** Tira deslizable con todos los árboles del grupo; el tachito y el GPS actúan sobre el seleccionado. */
export default function TreeStrip({ trees, selectedId, onSelect, onDelete, footer }: Props) {
  const { listRef, onChipPress, onContentSizeChange } = useStripAutoScroll<TreeChipItem>(selectedId, onSelect);

  const renderItem = useCallback<ListRenderItem<TreeChipItem>>(({ item }) => {
    const selected = item.id === selectedId;
    return (
      <TreeChip tree={item} selected={selected} onPress={onChipPress} onDelete={selected ? onDelete : undefined} />
    );
  }, [selectedId, onChipPress, onDelete]);

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.container}>
      <FlatList
        ref={listRef}
        testID="tree-strip"
        horizontal
        data={trees}
        extraData={selectedId}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListFooterComponent={<EmptySlots count={MIN_VISIBLE_SLOTS - trees.length} />}
        onContentSizeChange={onContentSizeChange}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.footer}>{footer}</View>
    </Animated.View>
  );
}

interface ChipProps {
  tree: TreeChipItem;
  selected: boolean;
  onPress: (treeId: string) => void;
  onDelete?: (tree: TreeChipItem) => void;
}

const TreeChip = memo(function TreeChip({ tree, selected, onPress, onDelete }: ChipProps) {
  return (
    <Pressable
      testID={`tree-chip-${tree.id}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(tree.id)}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {tree.latitude != null && (
        <Ionicons testID={`chip-gps-pin-${tree.id}`} name="location" size={12} color={colors.plantation} />
      )}
      <Text
        style={[styles.chipText, selected && styles.chipTextSelected]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={CHIP_TEXT_MIN_SCALE}
      >
        {tree.posicion} {getSpeciesCode(tree)}
      </Text>
      {onDelete && (
        <Pressable
          testID="delete-tree-button"
          onPress={() => onDelete(tree)}
          hitSlop={CHIP_DELETE_HIT_SLOP}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={14} color={colors.danger} />
        </Pressable>
      )}
    </Pressable>
  );
});

/** Con menos de 3 árboles se completan los lugares: la tira no se ve vacía ni cambia de alto. */
function EmptySlots({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.emptySlots}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} testID="tree-strip-empty-slot" style={[styles.chip, styles.chipEmpty]} />
      ))}
    </View>
  );
}
