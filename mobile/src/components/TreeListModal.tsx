import { Modal, View, Text, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import TreeRowItem from './TreeRowItem';
import type { TreeItemData } from './TreeRowItem';
import { treeListModalStyles as styles } from './TreeListModal.styles';

export type { TreeItemData as TreeListItem };

interface Props {
  visible: boolean;
  trees: TreeItemData[];
  isReadOnly: boolean;
  deletingTreeId: string | null;
  onClose: () => void;
  onViewPhoto: (treeId: string, uri: string) => void;
  onAttachPhoto: (treeId: string) => void;
  onDeleteTree: (treeId: string, posicion: number) => void;
  onSelectTree: (treeId: string) => void;
}

export default function TreeListModal({
  visible,
  trees,
  isReadOnly,
  deletingTreeId,
  onClose,
  onViewPhoto,
  onAttachPhoto,
  onDeleteTree,
  onSelectTree,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.title}>Árboles ({trees.length})</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textMedium} />
          </Pressable>
        </View>
        <FlatList
          data={trees}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TreeRowItem
              item={item}
              isReadOnly={isReadOnly}
              isDeleting={deletingTreeId === item.id}
              onViewPhoto={onViewPhoto}
              onAttachPhoto={onAttachPhoto}
              onDeleteTree={onDeleteTree}
              onPress={onSelectTree}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay árboles</Text>}
        />
      </View>
    </Modal>
  );
}
