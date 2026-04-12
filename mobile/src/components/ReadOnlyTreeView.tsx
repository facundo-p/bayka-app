import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import TreeRowItem from './TreeRowItem';
import type { TreeItemData } from './TreeRowItem';

export type { TreeItemData as ReadOnlyTreeItem };

interface Props {
  trees: TreeItemData[];
  canReactivate: boolean;
  onReactivate: () => void;
  onViewPhoto: (treeId: string, uri: string) => void;
}

export default function ReadOnlyTreeView({ trees, canReactivate, onReactivate, onViewPhoto }: Props) {
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
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay árboles</Text>}
      />
    </>
  );
}

const styles = StyleSheet.create({
  reactivateBar: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.plantationBg, alignItems: 'flex-start',
  },
  reactivateButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl, paddingVertical: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.plantation,
  },
  reactivateText: { color: colors.plantation, fontFamily: fonts.semiBold, fontSize: fontSize.base },
  listContent: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['6xl'], fontSize: fontSize.lg },
});
