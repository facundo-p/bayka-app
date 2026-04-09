import { Modal, View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { getSpeciesCode, getSpeciesName } from '../utils/speciesHelpers';

export interface TreeListItem {
  id: string;
  posicion: number;
  especieId: string | null;
  especieCodigo?: string | null;
  especieNombre?: string | null;
  subId: string;
  fotoUrl?: string | null;
  createdAt: string;
  subgrupoId: string;
  usuarioRegistro: string;
}

interface Props {
  visible: boolean;
  trees: TreeListItem[];
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
          renderItem={({ item }) => {
            const isDeleting = deletingTreeId === item.id;
            return (
              <View style={styles.row}>
                <Text style={styles.pos}>{item.posicion}</Text>
                <Text style={[styles.name, item.especieId === null && styles.nameNN]} numberOfLines={1}>
                  {getSpeciesName(item)}
                </Text>
                <Text style={styles.code} numberOfLines={1}>{getSpeciesCode(item)}</Text>
                <View style={styles.actions}>
                  {item.fotoUrl
                    ? <Pressable onPress={() => onViewPhoto(item.id, item.fotoUrl!)} hitSlop={8} style={styles.btn}>
                        <Ionicons name="image" size={18} color={colors.plantation} />
                      </Pressable>
                    : <Pressable onPress={() => onAttachPhoto(item.id)} hitSlop={8} style={styles.btn}>
                        <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
                      </Pressable>}
                  {!isReadOnly && (
                    <Pressable onPress={() => onDeleteTree(item.id, item.posicion)}
                      hitSlop={8} style={styles.btn} disabled={isDeleting}>
                      {isDeleting
                        ? <ActivityIndicator size="small" color={colors.danger} />
                        : <Ionicons name="trash-outline" size={18} color={colors.danger} />}
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
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
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  pos: { fontSize: fontSize.base, fontFamily: fonts.bold, color: colors.textMedium, width: 26, textAlign: 'center' },
  name: { fontSize: fontSize.md, fontFamily: fonts.semiBold, color: colors.plantation, flex: 1 },
  nameNN: { color: colors.secondary },
  code: { fontSize: fontSize.sm, color: colors.textSecondary, fontFamily: 'monospace', minWidth: 40 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: { padding: spacing.xs },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['6xl'], fontSize: fontSize.lg },
});
