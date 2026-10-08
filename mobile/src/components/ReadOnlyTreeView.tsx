import { View, Text, FlatList, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import TreeRowItem from './TreeRowItem';
import OrdenArbolesToggle from './OrdenArbolesToggle';
import { useOrdenArboles } from '../hooks/useOrdenArboles';
import { ordenarArbolesParaVista } from '../utils/ordenArboles';
import type { TreeItemData } from './TreeRowItem';
import { readOnlyTreeViewStyles as styles } from './ReadOnlyTreeView.styles';

export type { TreeItemData as ReadOnlyTreeItem };

interface Props {
  trees: TreeItemData[];
  canReactivate: boolean;
  /** Árboles con conflictos de sincronización sin resolver. */
  arbolesConCambios?: ReadonlySet<string>;
  onReactivate: () => void;
  onViewPhoto: (treeId: string, uri: string) => void;
  onSelectTree: (treeId: string) => void;
}

export default function ReadOnlyTreeView({ trees, canReactivate, arbolesConCambios, onReactivate, onViewPhoto, onSelectTree }: Props) {
  const { orden } = useOrdenArboles();
  return (
    <>
      <View style={styles.toolbar}>
        {canReactivate ? (
          <Pressable style={styles.reactivateButton} onPress={onReactivate}>
            <Ionicons name="refresh-outline" size={18} color={colors.plantation} />
            <Text style={styles.reactivateText}>Editar</Text>
          </Pressable>
        ) : <View />}
        <OrdenArbolesToggle />
      </View>
      <FlatList
        data={ordenarArbolesParaVista(trees, orden)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TreeRowItem
            item={item}
            isReadOnly={true}
            conCambiosPorResolver={arbolesConCambios?.has(item.id)}
            onViewPhoto={onViewPhoto}
            onPress={onSelectTree}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay árboles</Text>}
      />
    </>
  );
}
