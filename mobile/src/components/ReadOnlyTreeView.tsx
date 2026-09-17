import { View, Text, FlatList, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import TreeRowItem from './TreeRowItem';
import type { TreeItemData } from './TreeRowItem';
import { readOnlyTreeViewStyles as styles } from './ReadOnlyTreeView.styles';

export type { TreeItemData as ReadOnlyTreeItem };

interface Props {
  trees: TreeItemData[];
  canReactivate: boolean;
  onReactivate: () => void;
  onViewPhoto: (treeId: string, uri: string) => void;
  onSelectTree: (treeId: string) => void;
}

export default function ReadOnlyTreeView({ trees, canReactivate, onReactivate, onViewPhoto, onSelectTree }: Props) {
  return (
    <>
      {canReactivate && (
        <View style={styles.reactivateBar}>
          <Pressable style={styles.reactivateButton} onPress={onReactivate}>
            <Ionicons name="refresh-outline" size={18} color={colors.plantation} />
            <Text style={styles.reactivateText}>Editar</Text>
          </Pressable>
        </View>
      )}
      <FlatList
        data={trees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TreeRowItem
            item={item}
            isReadOnly={true}
            onViewPhoto={onViewPhoto}
            onPress={onSelectTree}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay árboles</Text>}
      />
    </>
  );
}
