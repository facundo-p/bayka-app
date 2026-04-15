import { Modal, View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, fonts } from '../theme';
import TreeRowItem from './TreeRowItem';
import type { TreeItemData } from './TreeRowItem';

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
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
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
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No hay árboles</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xxl, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: fontSize.xxl, fontFamily: fonts.heading, color: colors.text },
  listContent: { padding: spacing.xl, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['6xl'], fontSize: fontSize.lg, fontFamily: fonts.regular },
});
